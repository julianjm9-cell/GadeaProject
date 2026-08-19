const DATA = {
  universidad: {
    short: 'U25',
    title: 'ACCESO UNIVERSIDAD +25',
    teacher: 'Hoy conviene avanzar con un bloque pequeno: lectura, una idea clave y una pregunta tipo examen.',
    screens: {
      hoy: {
        title: 'Sesion de hoy',
        badge: 'Plan por tiempo',
        html: `
          <div class="panel">
            <div class="choice-grid" data-choice-group="time">
              <button class="choice active" data-demo-action="Plan de 15 minutos seleccionado">15 min</button>
              <button class="choice" data-demo-action="Plan de 30 minutos seleccionado">30 min</button>
              <button class="choice" data-demo-action="Plan de 45 minutos seleccionado">45 min</button>
            </div>
          </div>
          <div class="panel">
            <div class="list">
              <button class="list-row active" data-demo-action="Tema marcado para la sesion"><span><strong>Comentario de texto</strong><small>Lectura y tema principal</small></span><span class="tag">LENGUA</span></button>
              <button class="list-row" data-demo-action="Test rapido preparado"><span><strong>Mini test</strong><small>5 preguntas para cerrar la sesion</small></span><span class="tag">TEST</span></button>
              <button class="list-row" data-demo-action="Apuntes listos para editar"><span><strong>Apuntes base</strong><small>Resumen editable por tema</small></span><span class="tag">WORD</span></button>
            </div>
          </div>`
      },
      biblioteca: {
        title: 'Biblioteca',
        badge: 'Asignaturas y recursos',
        html: `
          <div class="panel"><div class="list">
            <button class="list-row active" data-demo-action="Asignatura abierta"><span><strong>Lengua castellana</strong><small>Comentario, resumen, tesis, argumentos</small></span><span class="tag">7 temas</span></button>
            <button class="list-row" data-demo-action="Asignatura abierta"><span><strong>Ingles</strong><small>Grammar, writing, reading, vocabulary</small></span><span class="tag">6 temas</span></button>
            <button class="list-row" data-demo-action="Recursos oficiales abiertos"><span><strong>Recursos oficiales</strong><small>Modelos, programas y convocatorias</small></span><span class="tag">links</span></button>
          </div></div>`
      },
      examen: {
        title: 'Generador de examenes con IA',
        badge: 'Simulacros',
        html: `
          <div class="panel"><div class="choice-grid">
            <button class="choice active" data-demo-action="Examen generado con IA en preview">Generar con IA</button>
            <button class="choice" data-demo-action="Banco de examenes abierto">Elegir examen</button>
            <button class="choice" data-demo-action="Historial filtrado">Historial</button>
          </div></div>
          <div class="panel"><div class="list">
            <button class="exam-card active" data-demo-action="Modelo completo generado"><span><strong>Modelo tipo prueba real</strong><small>Fase general + especifica</small></span><span class="tag">IA</span></button>
            <button class="exam-card" data-demo-action="Correccion por imagen simulada"><span><strong>Corregir con imagen</strong><small>Foto de respuesta y rubrica</small></span><span class="tag">demo</span></button>
          </div></div>`
      },
      progreso: {
        title: 'Progreso',
        badge: '5 etapas',
        html: `<div class="panel"><strong>27 tareas hechas de 60</strong><div class="progress-track" style="--progress:45%"><div class="progress-fill"></div></div><div class="road"><div class="step done">Inicio<br>5</div><div class="step done">Ritmo<br>12</div><div class="step done">Base<br>24</div><div class="step">Solidez<br>40</div><div class="step">Examen<br>60</div></div></div>`
      }
    }
  },
  eso: {
    short: 'E25',
    title: 'ACCESO ESO ADULTOS',
    teacher: 'Empieza por una tarea pequena y termina con un test corto. La constancia importa mas que estudiar mucho un solo dia.',
    screens: {
      hoy: {
        title: 'Sesion de hoy',
        badge: 'Paso concreto',
        html: `<div class="panel"><div class="choice-grid"><button class="choice active" data-demo-action="15 minutos elegido">15 min</button><button class="choice" data-demo-action="30 minutos elegido">30 min</button><button class="choice" data-demo-action="45 minutos elegido">45 min</button></div></div><div class="panel"><div class="list"><button class="list-row active" data-demo-action="Actividad abierta"><span><strong>Lengua</strong><small>Comprension de texto</small></span><span class="tag">hoy</span></button><button class="list-row" data-demo-action="Test preparado"><span><strong>Test corto</strong><small>5 preguntas corregibles</small></span><span class="tag">test</span></button></div></div>`
      },
      biblioteca: {
        title: 'Biblioteca',
        badge: 'Asignaturas',
        html: `<div class="panel"><div class="list"><button class="list-row active" data-demo-action="Asignatura abierta"><span><strong>Lengua e ingles</strong><small>Comprension, redaccion y vocabulario</small></span><span class="tag">12</span></button><button class="list-row" data-demo-action="Asignatura abierta"><span><strong>Social</strong><small>Historia, geografia y ciudadania</small></span><span class="tag">8</span></button><button class="list-row" data-demo-action="Asignatura abierta"><span><strong>Matematicas y ciencias</strong><small>Problemas, tecnologia y conceptos clave</small></span><span class="tag">14</span></button></div></div>`
      },
      examen: {
        title: 'Generador de examenes con IA',
        badge: 'Por temas',
        html: `<div class="panel"><div class="choice-grid"><button class="choice active" data-demo-action="Examen generado con IA en preview">Generar con IA</button><button class="choice" data-demo-action="Modelo oficial elegido">Estructura real</button><button class="choice" data-demo-action="Historial abierto">Historial</button></div></div><div class="panel"><div class="list"><button class="exam-card active" data-demo-action="Modelo de Lengua generado"><span><strong>Lengua e ingles</strong><small>Texto, vocabulario y redaccion</small></span><span class="tag">IA</span></button><button class="exam-card" data-demo-action="Modelo completo abierto"><span><strong>Prueba completa</strong><small>Asignaturas y temas ordenados</small></span><span class="tag">real</span></button></div></div>`
      },
      progreso: {
        title: 'Progreso',
        badge: 'Por tareas',
        html: `<div class="panel"><strong>18 tareas hechas de 60</strong><div class="progress-track" style="--progress:30%"><div class="progress-fill"></div></div><div class="road"><div class="step done">Inicio<br>5</div><div class="step done">Ritmo<br>12</div><div class="step">Base<br>24</div><div class="step">Solidez<br>40</div><div class="step">Examen<br>60</div></div></div>`
      }
    }
  },
  cambridge: {
    short: 'CAM',
    title: 'CAMBRIDGE TRAINER',
    teacher: 'Selecciona parte, nivel y un tema. La demo muestra el flujo, pero no corrige ni genera contenido.',
    screens: {
      speaking: { title:'Speaking', badge:'Practice room', html:`<div class="panel"><div class="choice-grid"><button class="choice active" data-demo-action="Speaking B2 seleccionado">B2</button><button class="choice" data-demo-action="Speaking C1 seleccionado">C1</button><button class="choice" data-demo-action="Speaking C2 seleccionado">C2</button></div></div><div class="panel"><div class="list"><button class="list-row active" data-demo-action="Topic abierto"><span><strong>Part 3 Discussion</strong><small>Technology and society</small></span><span class="tag">C1</span></button><button class="list-row" data-demo-action="Practice abierta"><span><strong>Long turn</strong><small>Compare, speculate, decide</small></span><span class="tag">B2</span></button></div></div>` },
      writing: { title:'Writing', badge:'Tasks', html:`<div class="panel"><div class="list"><button class="list-row active" data-demo-action="Essay abierto"><span><strong>Opinion essay</strong><small>Structure, connectors and criteria</small></span><span class="tag">C1</span></button><button class="list-row" data-demo-action="Review abierta"><span><strong>Review</strong><small>Tone, paragraphing and vocabulary</small></span><span class="tag">B2</span></button><button class="list-row" data-demo-action="Report abierto"><span><strong>Report</strong><small>Headings, findings and recommendations</small></span><span class="tag">C1</span></button></div></div>` },
      use: { title:'Use of English', badge:'Patterns', html:`<div class="panel"><div class="list"><button class="list-row active" data-demo-action="Transformations abiertas"><span><strong>Key word transformation</strong><small>Paraphrase patterns</small></span><span class="tag">12</span></button><button class="list-row" data-demo-action="Word formation abierto"><span><strong>Word formation</strong><small>Prefixes, suffixes and collocations</small></span><span class="tag">10</span></button></div></div>` },
      progreso: { title:'Progreso', badge:'Level path', html:`<div class="panel"><strong>42 practicas registradas</strong><div class="progress-track" style="--progress:68%"><div class="progress-fill"></div></div><div class="road"><div class="step done">B2 base</div><div class="step done">B2 exam</div><div class="step done">C1 base</div><div class="step">C1 exam</div><div class="step">C2</div></div></div>` }
    }
  },
  diplomator: {
    short: 'DIP',
    title: 'DIPLOMATOR',
    teacher: 'Prepara una exposicion breve, guarda puntos y practica oral. La demo no activa microfono ni IA.',
    screens: {
      hoy: { title:'Sesion de hoy', badge:'Rutina oral', html:`<div class="panel"><div class="choice-grid"><button class="choice active" data-demo-action="Tema diplomatico elegido">Tema</button><button class="choice" data-demo-action="Bloque oral elegido">Oral</button><button class="choice" data-demo-action="Repaso elegido">Repaso</button></div></div><div class="panel"><div class="list"><button class="list-row active" data-demo-action="Sesion preparada"><span><strong>Union Europea</strong><small>3 puntos para defender</small></span><span class="tag">hoy</span></button><button class="list-row" data-demo-action="Practica oral abierta"><span><strong>Practica oral</strong><small>Introduccion, desarrollo y cierre</small></span><span class="tag">oral</span></button></div></div>` },
      biblioteca: { title:'Biblioteca', badge:'Temas', html:`<div class="panel"><div class="list"><button class="list-row active" data-demo-action="Tema abierto"><span><strong>Democracia</strong><small>Argumentos, contexto y ejemplos</small></span><span class="tag">tema</span></button><button class="list-row" data-demo-action="Tema abierto"><span><strong>Seguridad internacional</strong><small>ONU, OTAN y conflictos</small></span><span class="tag">tema</span></button><button class="list-row" data-demo-action="Buscador simulado"><span><strong>Buscador de temas</strong><small>Filtra por palabra clave</small></span><span class="tag">buscar</span></button></div></div>` },
      oral: { title:'Practica oral', badge:'Simulador', html:`<div class="panel"><div class="list"><button class="exam-card active" data-demo-action="Guion preparado"><span><strong>Guion de 4 minutos</strong><small>Entrada, tres ideas y cierre</small></span><span class="tag">demo</span></button><button class="exam-card" data-demo-action="Revision simulada"><span><strong>Revision de claridad</strong><small>Ritmo, estructura y precision</small></span><span class="tag">oral</span></button></div></div>` },
      progreso: { title:'Progreso', badge:'Constancia', html:`<div class="panel"><strong>31 sesiones guardadas</strong><div class="progress-track" style="--progress:58%"><div class="progress-fill"></div></div><div class="road"><div class="step done">Inicio</div><div class="step done">Temas</div><div class="step done">Oral</div><div class="step">Solidez</div><div class="step">Examen</div></div></div>` }
    }
  }
};

const appKey = document.body.dataset.app;
const app = DATA[appKey];
let activeScreen = app ? Object.keys(app.screens)[0] : '';

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function renderDemo(screenKey) {
  if (!app || !app.screens[screenKey]) return;
  activeScreen = screenKey;
  const screen = app.screens[screenKey];
  document.querySelectorAll('[data-screen]').forEach(btn => btn.classList.toggle('active', btn.dataset.screen === screenKey));
  document.getElementById('demoTitle').textContent = screen.title;
  document.getElementById('demoBadge').textContent = screen.badge;
  document.getElementById('demoContent').innerHTML = screen.html;
}

function requestDemo() {
  showToast('Boton preparado para conectar con pago, formulario o WhatsApp.');
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-screen]').forEach(btn => btn.addEventListener('click', () => renderDemo(btn.dataset.screen)));
  document.querySelectorAll('[data-request-demo]').forEach(btn => btn.addEventListener('click', requestDemo));
  document.querySelectorAll('[data-jump-screen]').forEach(btn => btn.addEventListener('click', () => {
    renderDemo(btn.dataset.jumpScreen);
    document.getElementById('explora')?.scrollIntoView({behavior:'smooth', block:'start'});
    showToast('Preview abierta: ' + btn.textContent.trim().replace(/\s+/g, ' '));
  }));
  document.addEventListener('click', event => {
    const btn = event.target.closest('[data-demo-action]');
    if (!btn) return;
    const parent = btn.closest('.choice-grid, .list');
    if (parent) parent.querySelectorAll('button').forEach(item => item.classList.remove('active'));
    btn.classList.add('active');
    showToast(btn.dataset.demoAction + '. Es una preview visual.');
  });
  const teacherText = document.getElementById('teacherText');
  if (teacherText && app) teacherText.textContent = app.teacher;
  if (app) renderDemo(activeScreen);
});
