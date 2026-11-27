"""Local-only design review using the English app and a fictional account."""

import argparse
import json
import mimetypes
import re
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlencode, urlsplit


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
THEMES = ('folio', 'atlas', 'signal')
CAMBRIDGE = ROOT / 'apps/cambridge'
PROFESOR = ROOT / 'apps/profesor'
STATIC = ROOT / 'backend/app/static'
LANDING = ROOT / 'marketing/app_landings_demo/cambridge.html'
ASSETS = {
    '/preview/': HERE,
    '/capturas/': HERE / 'capturas',
    '/assets/cambridge-studio/': CAMBRIDGE / 'assets/studio',
    '/assets/cambridge-games/': CAMBRIDGE / 'assets/games',
    '/assets/listening/': CAMBRIDGE / 'assets/listening',
    '/assets/brand/': STATIC / 'assets/brand',
    '/assets/study-appearance/': STATIC / 'assets/study-appearance',
    '/assets/': HERE / 'assets',
}
FILES = {
    '/': HERE / 'index.html',
    '/app-notifications.js': PROFESOR / 'app-notifications.js',
    '/app-session.js': PROFESOR / 'app-session.js',
    '/assets/app-notifications.css': PROFESOR / 'assets/app-notifications.css',
    '/favicon.ico': STATIC / 'assets/brand/ingles-simple.png',
}
ACCOUNT = {'id':'english-design', 'name':'Alex Morgan', 'email':'alex@example.invalid',
           'status':'active', 'total_credits':100, 'available_credits':82, 'license_key':'CAMB-DESIGN-PREVIEW'}
NOW = datetime.now(timezone.utc)
STUDY_POINT = {
    'title':'Choose the time frame first',
    'text':'Use the past simple for a finished time. Use the present perfect when the period continues or the present result matters. Compare “I sent it yesterday” with “I’ve already sent it.” Read the full sentence before deciding.',
    'datedInfo':[{'date':'Tip','text':'Look for yesterday, already or so far.'}],
    'vocab':[{'word':'so far','def':'hasta ahora'},{'word':'already','def':'ya'}],
}
WRITING_REPORT = {
    'summary':'Ejemplo de informe. La idea central está clara. Desarrolla el argumento con una comparación y una consecuencia concreta.',
    'scores':{
        'content':{'score':3,'comment':'La respuesta aborda el tema.'},
        'communicativeAchievement':{'score':3,'comment':'Mantén un tono adecuado para un ensayo.'},
        'organisation':{'score':2,'comment':'Desarrolla un argumento por párrafo.'},
        'language':{'score':3,'comment':'Introduce variedad con una subordinada.'},
    },
    'corrections':[],
    'improvedExcerpt':'A lending scheme would allow more students to take part, especially those who cannot afford specialist equipment.',
    'nextSteps':['Introduce una objeción concreta.', 'Relaciona la conclusión con tu argumento principal.'],
}


def demo_reply(payload):
    instruction = payload.get('messages', [{}])[0].get('content', '')
    if payload.get('purpose') == 'points':
        return json.dumps({'points':[STUDY_POINT]}, ensure_ascii=False)
    if 'four practice criteria' in instruction:
        return json.dumps(WRITING_REPORT, ensure_ascii=False)
    return 'Ejemplo de respuesta. En inglés, puedes matizar una recomendación con «It might be worth trying…». Explica después la condición: «It might be worth trying a shorter session if you have limited time.»'


def sample():
    topic = 'Present perfect y past simple'
    date = NOW.isoformat()
    return {
        'examLevel':'B2 First',
        'b2Progress':{'collocations':{'completed':True,'attempts':1,'at':date},
                      'open-cloze':{'completed':True,'attempts':2,'at':date}},
        'b2Games':{'editor':{'completed':True,'plays':1,'mistakes':0,'at':date}},
        'completedTopics':[topic],
        'history':[{'topic':title,'date':(NOW-timedelta(days=offset)).isoformat(),'points':[STUDY_POINT] if offset == 1 else []}
                   for title,offset in [(topic,1),('Making recommendations',2),('Reading for detail',4)]],
        'writingPractice':{'level':'B2 First','part':'1','taskType':'essay',
                           'prompt':'Should schools lend equipment instead of asking students to buy it?',
                           'answer':'School equipment can be expensive. A lending scheme could help more students take part.'},
    }


class PreviewServer(ThreadingHTTPServer):
    def __init__(self, address):
        super().__init__(address, PreviewHandler)
        self.state = {theme: sample() for theme in THEMES}
        self.revision = dict.fromkeys(THEMES, 1)
        self.dismissed = set()
        self.read = set()


class PreviewHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        if args[1] >= '400':
            super().log_message(format, *args)

    def send_data(self, body, content_type, status=200, **headers):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Robots-Tag','noindex, nofollow')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'")
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()
        if body:
            self.wfile.write(body)

    def send_json(self, data, **headers):
        self.send_data(json.dumps(data, ensure_ascii=False).encode(), 'application/json; charset=utf-8', **headers)

    def theme(self, url):
        design = parse_qs(url.query).get('design', [''])[0]
        if design in THEMES:
            return design
        referrer = urlsplit(self.headers.get('Referer', ''))
        design = parse_qs(referrer.query).get('design', [''])[0]
        return design if design in THEMES else 'folio'

    def do_GET(self):
        url = urlsplit(self.path)
        path = unquote(url.path)
        theme = self.theme(url)
        if path in ('/cambridge','/cambridge-info'):
            app = path == '/cambridge'
            source = (CAMBRIDGE / 'index.html' if app else LANDING).read_text(encoding='utf-8')
            source = re.sub(r'<html\b', f'<html data-design="{theme}"', source, count=1)
            source = source.replace('</head>', '<link rel="stylesheet" href="/preview/design.css">\n<script defer src="/preview/preview.js"></script>\n</head>', 1)
            if app:
                source = source.replace('\ninit();', '\nwindow.designPreviewReady = init();', 1)
            self.send_data(source.encode(), 'text/html; charset=utf-8')
        elif path == '/auth/google/login':
            self.send_data(b'', 'text/plain', 302, Location='/cambridge?' + urlencode({'design':theme}))
        elif path in ('/api/me','/api/status'):
            self.send_json({'ok':True,'user':ACCOUNT})
        elif path == '/api/state':
            self.send_json(self.server.state[theme], ETag=f'"demo-{theme}-{self.server.revision[theme]}"')
        elif path.startswith('/api/app-notifications/'):
            messages = [] if theme in self.server.dismissed else [{
                'id':'welcome','title':'Tu siguiente reto está listo',
                'body':'Prueba El mapa del museo desde el catálogo de juegos.',
                'created_at':NOW.isoformat(), 'read':theme in self.server.read,
            }]
            self.send_json({'messages':messages,'next':None,'unread':int(bool(messages) and theme not in self.server.read)})
        elif path in ('/api/study-appearance','/auth/google/status','/auth/google/drive-status','/api/public/app-availability'):
            self.send_json({'look':'original','enabled':True,'connected':False,'apps':{'CAMBRIDGE':{'paused':False}}})
        elif path in ('/auth/google/drive','/privacidad','/aviso-legal','/cookies'):
            self.send_data('<meta charset="utf-8"><title>Vista previa</title><p>Este enlace pertenece a la aplicación en producción.</p><a href="/">Volver a los diseños</a>'.encode(), 'text/html; charset=utf-8')
        else:
            self.static_file(path)

    def do_POST(self):
        url = urlsplit(self.path)
        theme = self.theme(url)
        length = int(self.headers.get('Content-Length', 0))
        if length > 12 * 1024 * 1024:
            self.send_error(413)
            return
        body = self.rfile.read(length)
        if url.path == '/api/state':
            self.server.state[theme] = json.loads(body or '{}')
            self.server.revision[theme] += 1
            self.send_json({'ok':True}, ETag=f'"demo-{theme}-{self.server.revision[theme]}"')
        elif url.path == '/api/chat':
            self.send_json({'content':demo_reply(json.loads(body or '{}'))})
        elif url.path.startswith('/api/app-notifications/'):
            if url.path.endswith('/dismiss'):
                self.server.dismissed.add(theme)
            self.server.read.add(theme)
            self.send_json({'ok':True,'unread':0})
        elif url.path in ('/api/ocr','/api/transcribe'):
            self.send_json({'text':'Sample text for the local design preview.'})
        else:
            self.send_json({'ok':True,'user':ACCOUNT,'look':'original'})

    def static_file(self, path):
        file = FILES.get(path)
        for prefix, folder in ASSETS.items():
            if file:
                break
            if path.startswith(prefix):
                candidate = (folder / path.removeprefix(prefix)).resolve()
                if candidate.is_relative_to(folder.resolve()):
                    file = candidate
                break
        if file and file.is_file():
            mime = mimetypes.guess_type(file)[0] or 'application/octet-stream'
            if file.suffix == '.wav':
                mime = 'audio/wav'
            self.send_data(file.read_bytes(), mime)
        else:
            self.send_error(404)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8780)
    args = parser.parse_args()
    with PreviewServer(('127.0.0.1', args.port)) as server:
        print(f'Comparador de Inglés: http://127.0.0.1:{args.port}/', flush=True)
        server.serve_forever()
