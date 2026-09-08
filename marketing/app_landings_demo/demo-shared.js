const DEMOS = {
  universidad: {
    first: 'hoy',
    screens: {
      hoy: {
        title: 'Hoy',
        badge: '15 minutos',
        tasks: [
          ['Leer un texto', 'Una tarea corta para empezar sin bloqueo.'],
          ['Responder 5 preguntas', 'Comprueba si has entendido lo esencial.'],
          ['Guardar avance', 'La proxima sesion empieza donde lo dejaste.']
        ]
      },
      examen: {
        title: 'Simulacro',
        badge: 'Tipo prueba',
        tasks: [
          ['Elegir asignatura', 'Lengua, ingles o fase especifica.'],
          ['Generar practica', 'Preguntas y estructura parecida al examen.'],
          ['Corregir con guia', 'Feedback claro para saber que mejorar.']
        ]
      }
    }
  },
  eso: {
    first: 'hoy',
    screens: {
      hoy: {
        title: 'Hoy',
        badge: 'Paso a paso',
        tasks: [
          ['Una actividad', 'Lengua, sociales o ciencias sin preparar nada.'],
          ['Mini test', 'Pocas preguntas, resultado inmediato.'],
          ['Siguiente paso', 'La app marca por donde continuar.']
        ]
      },
      examen: {
        title: 'Practica',
        badge: 'Por bloques',
        tasks: [
          ['Elegir bloque', 'Comunicacion, social o cientifico-tecnologico.'],
          ['Practicar examen', 'Modelo breve y corregible.'],
          ['Repetir lo flojo', 'Vuelve solo a lo que cuesta.']
        ]
      }
    }
  },
  cambridge: {
    first: 'speaking',
    screens: {
      speaking: {
        title: 'Speaking',
        badge: 'B2-C1-C2',
        tasks: [
          ['Elegir parte', 'Long turn, discussion o interview.'],
          ['Practicar con tema', 'Preguntas listas, sin inventar prompts.'],
          ['Recibir feedback', 'Claridad, estructura y vocabulario.']
        ]
      },
      writing: {
        title: 'Writing',
        badge: 'Criterios',
        tasks: [
          ['Elegir tarea', 'Essay, review, report o proposal.'],
          ['Escribir con estructura', 'Guia breve antes de redactar.'],
          ['Corregir', 'Feedback centrado en examen.']
        ]
      }
    }
  },
  diplomator: {
    first: 'tema',
    screens: {
      tema: {
        title: 'Tema',
        badge: 'Guion oral',
        tasks: [
          ['Abrir tema', 'Idea central y tres puntos defendibles.'],
          ['Preparar discurso', 'Introduccion, desarrollo y cierre.'],
          ['Guardar version', 'Tu material queda ordenado.']
        ]
      },
      oral: {
        title: 'Practica oral',
        badge: 'Claridad',
        tasks: [
          ['Ensayar', 'Practica con una estructura estable.'],
          ['Revisar', 'Detecta repeticiones, saltos y vaguedades.'],
          ['Mejorar', 'Una version mas clara para repetir.']
        ]
      }
    }
  }
};

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function renderDemo(key) {
  const app = DEMOS[document.body.dataset.app || ''];
  if (!app || !app.screens[key]) return;
  const screen = app.screens[key];
  document.querySelectorAll('[data-screen]').forEach(button => {
    button.classList.toggle('active', button.dataset.screen === key);
  });
  const title = document.getElementById('demoTitle');
  const badge = document.getElementById('demoBadge');
  const content = document.getElementById('demoContent');
  if (title) title.textContent = screen.title;
  if (badge) badge.textContent = screen.badge;
  if (content) {
    content.innerHTML = `<div class="task-list">${screen.tasks.map(([name, text]) => (
      `<div class="task"><span><strong>${name}</strong><small>${text}</small></span><span class="pill">ok</span></div>`
    )).join('')}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = DEMOS[document.body.dataset.app || ''];
  if (app) renderDemo(app.first);
  document.querySelectorAll('[data-screen]').forEach(button => {
    button.addEventListener('click', () => renderDemo(button.dataset.screen));
  });
  document.querySelectorAll('[data-request-demo]').forEach(button => {
    button.addEventListener('click', () => showToast('Preparado para conectar con formulario, pago o WhatsApp.'));
  });
});
