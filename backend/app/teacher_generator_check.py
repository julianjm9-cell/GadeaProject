"""Exercise the production generator with real AI in an isolated test database.

No customer state or application credits are touched. Provider tokens are billed
normally. Never print credentials or model content. Run --cases syntax first.
"""
import argparse
import asyncio
import json
import logging
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import Settings
from app.database.session import Base, SessionLocal
from app.models import User, Organization, License, AppSetting
from app.api import app_routes
from app.services.teacher_generator import TYPES


def cases(selection):
    if selection == 'syntax':
        return [('pasapalabra', 'Lengua', 'Sintaxis: funciones de los sintagmas y complementos de la oración', 18)]
    topics = {
        'timeline': ('Geografía e Historia', 'Hitos principales de la Segunda Guerra Mundial', 6),
        'sentence': ('Lengua', 'Construir una oración natural con sujeto, verbo y complementos', 6),
        'multigaps': ('Lengua', 'Un relato en pasado: imperfecto y pretérito perfecto simple', 10),
        'numeric': ('Matemáticas', 'Operaciones con números enteros', 6),
        'problem': ('Matemáticas', 'Ecuaciones de primer grado en problemas cotidianos', 3),
        'pasapalabra': ('Lengua', 'Sintaxis: funciones de los sintagmas y complementos de la oración', 18),
        'memory': ('Lengua', 'Conceptos de sintaxis y sus definiciones', 6),
        'crossword': ('Ciencias', 'Animales vertebrados', 6),
        'wordsearch': ('Ciencias', 'Animales vertebrados', 8),
        'dragdrop': ('Ciencias', 'Clasificación de animales vertebrados', 6),
        'order': ('Ciencias', 'Pasos del método científico', 6),
    }
    return [(kind, *topics.get(kind, ('Lengua', 'Sintaxis: sujeto, predicado y complementos', 6))) for kind in TYPES]


async def main(args):
    if args.configured:
        with SessionLocal() as db:
            key, url, provider = app_routes.chat_provider_config(db, product='PROFESOR_PARTICULAR')
            model = app_routes.chat_model_for_purpose(db, provider, 'chat', 'PROFESOR_PARTICULAR')
    else:
        settings = Settings(_env_file=args.env_file)
        provider = settings.ai_provider
        key = getattr(settings, provider + '_api_key', '')
        url = str(getattr(settings, provider + '_chat_url'))
        model = settings.chat_model
    if not key:
        raise SystemExit('No hay una clave configurada. Usa --env-file o --configured en el servidor.')
    # All model calls go through the same implementation as the real endpoint.
    old_config, old_model = app_routes.chat_provider_config, app_routes.chat_model_for_purpose
    app_routes.chat_provider_config = lambda *a, **kw: (key, url, provider)
    app_routes.chat_model_for_purpose = lambda *a, **kw: model
    report = []
    try:
        with tempfile.TemporaryDirectory(prefix='teacher-generator-check-') as directory:
            engine = create_engine('sqlite+pysqlite:///' + str(Path(directory) / 'isolated.sqlite'))
            Base.metadata.create_all(engine)
            with Session(engine) as db:
                org = Organization(name='Generator verification'); db.add(org); db.flush()
                user = User(organization_id=org.id, email='generator-check@example.invalid', password_hash='disabled', is_active=True)
                db.add(user); db.flush()
                stamp = datetime.now(timezone.utc)
                license_obj = License(organization_id=org.id, user_id=user.id, product_code='PROFESOR_PARTICULAR',
                                      starts_at=stamp-timedelta(days=1), expires_at=stamp+timedelta(days=1), usage_limit=1000)
                db.add(license_obj); db.commit()
                for run in range(args.runs):
                    selected = [case for case in cases(args.cases) if not args.types or case[0] in args.types.split(',')]
                    if not selected:
                        raise SystemExit('No se ha seleccionado ningún tipo válido.')
                    for kind, subject, topic, size in selected:
                        payload = dict(request_id=str(uuid4()), course='3.º ESO', subject=subject, topic=topic,
                                       activitySizes={kind: size}, qualityVersion=1, extent='standard',
                                       **{k: int(k == kind) for k in TYPES})
                        started = time.monotonic()
                        try:
                            result = await app_routes.generate_teacher_material_impl(payload, user, license_obj, db)
                            entry = dict(run=run+1, type=kind, success=True, questions=len(result['questions']),
                                         elements=len(result['questions'][0]['options']) if kind in ('pasapalabra', 'crossword', 'wordsearch', 'memory', 'dragdrop', 'order', 'timeline', 'sentence', 'multigaps') else len(result['questions']))
                            if args.artifacts:
                                output = Path(args.artifacts); output.mkdir(parents=True, exist_ok=True)
                                (output / f'{kind}-{run+1}.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
                        except Exception as exc:
                            db.rollback()
                            entry = dict(run=run+1, type=kind, success=False, error=str(getattr(exc, 'detail', type(exc).__name__)))
                        entry['seconds'] = round(time.monotonic()-started, 2)
                        report.append(entry)
                        print(json.dumps(entry, ensure_ascii=False), flush=True)
                        await asyncio.sleep(args.pause)
            engine.dispose()
    finally:
        app_routes.chat_provider_config, app_routes.chat_model_for_purpose = old_config, old_model
    if args.report:
        Path(args.report).write_text(json.dumps(dict(provider=provider, model=model, results=report), ensure_ascii=False, indent=2), encoding='utf-8')
    if any(not row['success'] for row in report):
        raise SystemExit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cases', choices=('syntax', 'all'), default='syntax')
    parser.add_argument('--runs', type=int, choices=range(1, 6), default=1)
    parser.add_argument('--types', help='Optional comma-separated exercise types to rerun affected cases.')
    parser.add_argument('--env-file', default='../.env')
    parser.add_argument('--configured', action='store_true')
    parser.add_argument('--report')
    parser.add_argument('--pause', type=float, default=3, help='Seconds between cases to respect provider rate limits.')
    parser.add_argument('--artifacts', help='Optional local examples for browser parity tests; only synthetic test content.')
    logging.basicConfig(level=logging.WARNING)
    asyncio.run(main(parser.parse_args()))
