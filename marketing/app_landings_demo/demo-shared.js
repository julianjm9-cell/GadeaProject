const DEMOS = {
  universidad: {
    first: "hoy",
    screens: {
      hoy: {
        title: "Sesión de hoy",
        text: "La app te propone una tarea concreta según el tiempo que tengas.",
        bullets: ["15, 30 o 45 minutos", "Lectura, test o repaso", "Siguiente paso guardado"],
        cards: [
          ["Texto", "Comentario guiado con ideas clave."],
          ["Lengua", "Ortografía, sintaxis y comprensión."],
          ["Inglés", "Use of English y vocabulario."],
          ["Fase específica", "Práctica por materia elegida."]
        ]
      },
      materias: {
        title: "Materias",
        text: "Todo queda ordenado por bloques para no perder tiempo decidiendo.",
        bullets: ["Temas por área", "Lecciones pequeñas", "Repaso de lo flojo"],
        cards: [
          ["Lengua", "Comentario, gramática y literatura."],
          ["Inglés", "Reading, grammar y writing."],
          ["Historia", "Cronología, mapas y conceptos."],
          ["Matemáticas", "Ejercicios paso a paso."]
        ]
      },
      examen: {
        title: "Examen",
        text: "Practicas con formato parecido a la prueba y corrección clara.",
        bullets: ["Simulacros cortos", "Preguntas tipo examen", "Feedback para mejorar"],
        cards: [
          ["Modelo rápido", "10 preguntas para calentar."],
          ["Simulacro", "Bloque completo cronometrado."],
          ["Corrección", "Errores explicados sin lío."],
          ["Repetir", "Nueva ronda de lo fallado."]
        ]
      },
      progreso: {
        title: "Progreso",
        text: "Ves qué has hecho, qué falta y cuál es el siguiente paso.",
        bullets: ["Avance mensual", "Temas pendientes", "Historial de sesiones"],
        cards: [
          ["Hoy", "Tarea terminada o pendiente."],
          ["Semana", "Constancia y sesiones."],
          ["Temario", "Bloques completados."],
          ["Objetivo", "Próxima prioridad."]
        ]
      }
    }
  },
  eso: {
    first: "hoy",
    screens: {
      hoy: {
        title: "Sesión de hoy",
        text: "Entras, eliges tiempo y empiezas con una actividad clara.",
        bullets: ["Sin preparar materiales", "Tarea corta", "Corrección inmediata"],
        cards: [
          ["Lengua", "Comprensión y ortografía."],
          ["Inglés", "Vocabulario y frases útiles."],
          ["Sociales", "Mapa, eje temporal o resumen."],
          ["Ciencias", "Ejercicio práctico guiado."]
        ]
      },
      asignaturas: {
        title: "Asignaturas",
        text: "El temario está separado en bloques sencillos y fáciles de seguir.",
        bullets: ["Lengua", "Sociales", "Científico-tecnológico"],
        cards: [
          ["Lengua", "Comunicación, gramática y textos."],
          ["Inglés", "Reading, grammar y writing básico."],
          ["Sociales", "Geografía, historia y ciudadanía."],
          ["Ciencias", "Mates, biología, física y química."]
        ]
      },
      examen: {
        title: "Examen",
        text: "Practicas por bloques para llegar con seguridad a la prueba.",
        bullets: ["Mini tests", "Simulacros", "Repaso de errores"],
        cards: [
          ["Tipo test", "Preguntas rápidas con resultado."],
          ["Desarrollo", "Respuesta guiada paso a paso."],
          ["Bloques", "Práctica por ámbito."],
          ["Corrección", "Qué cambiar en la siguiente ronda."]
        ]
      },
      progreso: {
        title: "Progreso",
        text: "La app marca lo completado y te enseña qué toca después.",
        bullets: ["Temas vistos", "Tests hechos", "Siguiente tarea"],
        cards: [
          ["Avance", "Porcentaje por asignatura."],
          ["Pendiente", "Temas que faltan."],
          ["Semana", "Sesiones realizadas."],
          ["Refuerzo", "Lo que conviene repetir."]
        ]
      }
    }
  },
  cambridge: {
    first: "temas",
    screens: {
      temas: {
        title: "Temas",
        text: "Ideas y vocabulario organizados por nivel y tipo de examen.",
        bullets: ["B2, C1 y C2", "Vocabulary banks", "Ejemplos de respuesta"],
        cards: [
          ["Work", "Ideas para speaking y writing."],
          ["Education", "Argumentos y conectores."],
          ["Environment", "Vocabulario y ejemplos."],
          ["Technology", "Pros, cons y expressions."]
        ]
      },
      hoy: {
        title: "Sesión de hoy",
        text: "Una práctica concreta para avanzar sin abrir mil recursos.",
        bullets: ["Speaking corto", "Writing plan", "Feedback final"],
        cards: [
          ["Warm up", "3 preguntas rápidas."],
          ["Practice", "Parte del examen."],
          ["Review", "Errores frecuentes."],
          ["Next", "Qué repetir mañana."]
        ]
      },
      speaking: {
        title: "Oral",
        text: "Practicas una parte del speaking y recibes corrección enfocada.",
        bullets: ["Interview", "Long turn", "Discussion"],
        cards: [
          ["Fluency", "Ritmo y pausas."],
          ["Vocabulary", "Palabras más naturales."],
          ["Grammar", "Errores importantes."],
          ["Structure", "Respuesta más clara."]
        ]
      },
      writing: {
        title: "Writing",
        text: "Preparas textos de examen con estructura y revisión por criterios.",
        bullets: ["Essay", "Review", "Report y proposal"],
        cards: [
          ["Plan", "Ideas antes de escribir."],
          ["Draft", "Texto completo."],
          ["Criteria", "Content, language y organisation."],
          ["Upgrade", "Versión mejorada."]
        ]
      }
    }
  },
  diplomator: {
    first: "tema",
    screens: {
      tema: {
        title: "Tema",
        text: "Empiezas con una idea central y ejemplos para construir el oral.",
        bullets: ["Resumen del tema", "Contexto", "Enfoque defendible"],
        cards: [
          ["Idea central", "Qué quieres defender."],
          ["Contexto", "Dato o marco inicial."],
          ["Ejemplo", "Caso concreto para explicar."],
          ["Cierre", "Conclusión clara."]
        ]
      },
      puntos: {
        title: "Puntos",
        text: "La app convierte el tema en una estructura ordenada para hablar.",
        bullets: ["Introducción", "3 ideas principales", "Cierre"],
        cards: [
          ["Punto 1", "Argumento principal."],
          ["Punto 2", "Matiz o comparación."],
          ["Punto 3", "Impacto o consecuencia."],
          ["Conectores", "Frases para unir ideas."]
        ]
      },
      oral: {
        title: "Oral",
        text: "Ensayas la exposición con guía y puedes mejorarla por rondas.",
        bullets: ["Guion visible", "Práctica oral", "Versión mejorada"],
        cards: [
          ["Start", "Opening phrase."],
          ["Develop", "Clear argument."],
          ["Example", "Specific evidence."],
          ["Close", "Final sentence."]
        ]
      },
      correccion: {
        title: "Corrección",
        text: "Recibes feedback en inglés para sonar más claro y natural.",
        bullets: ["Clarity", "Vocabulary", "Structure"],
        cards: [
          ["Strength", "What works well."],
          ["Improve", "What to change."],
          ["Better phrase", "More natural option."],
          ["Next try", "One concrete task."]
        ]
      }
    }
  }
};

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function renderDemo(key) {
  const app = DEMOS[document.body.dataset.app || ""];
  if (!app || !app.screens[key]) return;
  const screen = app.screens[key];
  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === key);
  });

  const title = document.getElementById("demoTitle");
  const badge = document.getElementById("demoBadge");
  const content = document.getElementById("demoContent");
  if (title) title.textContent = screen.title;
  if (badge) badge.textContent = screen.bullets?.[0] || "";
  if (content) {
    content.innerHTML = `<div class="task-list">${screen.cards.map(([name, text]) => (
      `<div class="task"><span><strong>${name}</strong><small>${text}</small></span><span class="pill">ok</span></div>`
    )).join("")}</div>`;
  }
}

function renderMockPreview(key) {
  const app = DEMOS[document.body.dataset.app || ""];
  if (!app || !app.screens[key]) return;
  const screen = app.screens[key];
  const card = document.getElementById("mockCard");
  const grid = document.getElementById("mockGrid");
  if (card) {
    card.innerHTML = `
      <strong>${screen.title}</strong>
      <p>${screen.text}</p>
      <ul>${screen.bullets.map((item) => `<li>${item}</li>`).join("")}</ul>
    `;
  }
  if (grid) {
    grid.innerHTML = screen.cards.map(([name, text]) => (
      `<article><strong>${name}</strong><small>${text}</small></article>`
    )).join("");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const app = DEMOS[document.body.dataset.app || ""];
  if (app) {
    renderDemo(app.first);
    renderMockPreview(app.first);
  }
  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => {
      renderDemo(button.dataset.screen);
      renderMockPreview(button.dataset.screen);
    });
  });
  document.querySelectorAll("[data-request-demo]").forEach((button) => {
    button.addEventListener("click", () => showToast("Preparado para conectar con formulario, pago o WhatsApp."));
  });
});
