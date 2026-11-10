// Estas fichas forman parte del contexto del proyecto. Las decisiones del usuario se guardan en el panel local.
export const projectProfiles = {
  ecosistema: {
    name: 'Educame · todas las apps',
    style: 'Acciones principales claras, jerarquía visual consistente y contenido legible. En el Centro de mando, usar colores por sección y nombres junto a los iconos.',
    flows: 'Las apps sirven tareas distintas. El Centro de mando local prepara encargos y revisiones. El dashboard online gestiona las apps publicadas.',
    rules: 'Respetar cuentas, datos, progreso y permisos. Distinguir vista local, versión en GitHub y versión desplegada. Usar datos ficticios en pruebas.',
    verify: 'Comprobar la tarea de principio a fin, en escritorio y móvil cuando afecte a la interfaz. Identificar el estado de error y recuperación.',
    files: ['docs/guia-desarrollo-educame.md', 'scripts/educame-dashboard/', 'admin/'],
  },
  profesor: {
    name: 'Profesor Particular',
    style: 'Escritorio con tarjetas claras y navegación estable. Respetar los modos Estudio, Academia y Sin fondo. En juegos, usar ilustraciones que formen parte de la mecánica y mantener los controles legibles.',
    flows: 'Inicio reúne alumnos, clases y tareas. Temario, Juegos y Sesiones de juegos tienen recorridos separados. La biblioteca distingue material propio, público, del temario, avanzado y externo.',
    rules: 'Mantener privadas las fichas del profesor. El acceso a una partida con código y los datos de una ficha tienen propósitos distintos. Respetar los límites y permisos validados por el servidor.',
    verify: 'Probar selección por curso y asignatura, apertura y guardado, y juego por código cuando aplique. Comprobar que los tableros y soluciones no tapen acciones.',
    files: ['apps/profesor/index.html', 'apps/profesor/assets/profesor-appearance.css', 'apps/profesor/assets/profesor-academy-theme.css', 'marketing/app_landings_demo/profesor-particular.html'],
  },
  eso: {
    name: 'ESO Adultos',
    style: 'Interfaz adulta y despejada, con iconos coherentes por asignatura y tarjetas de alto contraste. Reservar la ambientación para prácticas, misiones y escritorio.',
    flows: 'Asignaturas reúne Temario, Recursos y Mis apuntes. Juegos organiza la práctica por tema. Exámenes ofrece Practicar, Simulacro de examen, Corregir examen e Historial. Progreso reúne escritorio y estadísticas.',
    rules: 'Preservar apuntes y progreso. Mostrar feedback verificable en prácticas. En corrección por foto, permitir revisar qué texto se va a corregir y conservar el borrador.',
    verify: 'Probar acierto y error, guardado y recarga. En una misión, comprobar tacto, cierre y resultado. Distinguir el ensayo local de la corrección real.',
    files: ['apps/e25/index.html', 'apps/e25/assets/eso-mission-boards.css', 'backend/app/static/assets/study-appearance/', 'docs/eso-examenes-flujo.md'],
  },
  ingles: {
    name: 'Inglés',
    style: 'La estética Ruta usa un tren, una próxima misión y un recorrido de temas. En práctica, favorecer tarjetas claras y acciones directas. La landing explica la app con vistas relacionadas con la funcionalidad.',
    flows: 'Inicio, Juegos, Temario, Práctica y Biblioteca. Las rutas y destrezas se organizan por nivel. La práctica incluye Speaking, Writing y Listening según el contenido disponible.',
    rules: 'Ajustar dificultad y explicaciones al nivel. Conservar el progreso por nivel y el contenido existente. Verificar la versión publicada antes de presentar una capacidad como disponible.',
    verify: 'Comprobar una misión con acierto, error y reanudación. Si afecta a audio o micrófono, distinguir reproducción, permisos y servicios de transcripción.',
    files: ['apps/cambridge/index.html', 'apps/cambridge/assets/studio/route.css', 'apps/cambridge/assets/studio/games.js', 'marketing/app_landings_demo/cambridge.html'],
  },
  diplomator: {
    name: 'Diplomator',
    style: 'Conservar la presentación de estudio y el lenguaje visual de sus materiales. Facilitar la lectura de temas, acciones de práctica y resultados.',
    flows: 'Sesión de hoy, temas y práctica. Mantener accesibles las actividades y herramientas vinculadas a la preparación.',
    rules: 'Preservar el estado por cuenta y la separación entre contenidos, preferencias y evaluación. Comprobar los permisos antes de sugerir cambios que afecten a usuarios.',
    verify: 'Abrir un tema o actividad, completar una acción y comprobar que se puede retomar. Si afecta a un documento, revisar también su descarga o presentación.',
    files: ['apps/diplomator/index.html', 'apps/diplomator/assets/diplomator-refresh.css', 'marketing/app_landings_demo/diplomator.html'],
  },
  universidad: {
    name: 'Universidad +25',
    style: 'Priorizar lectura cómoda, contenido organizado y una acción siguiente reconocible para personas adultas.',
    flows: 'Preparación para el acceso a la universidad con contenidos y práctica del programa correspondiente.',
    rules: 'Mantener separados el programa de acceso y los materiales de otras apps. Conservar avance y preferencias. Verificar el temario vigente en el código antes de proponer cambios.',
    verify: 'Identificar el tema o práctica afectada y probar navegación, avance y recarga con datos ficticios.',
    files: ['apps/u25/index.html', 'marketing/app_landings_demo/universidad-25.html'],
  },
  facturas: {
    name: 'Lector de facturas',
    style: 'Interfaz de trabajo con estados visibles y comparación cómoda entre documento original y datos extraídos.',
    flows: 'Recepción de documentos, procesamiento OCR, revisión y exportación. Diferenciar trabajos pendientes, completados y fallidos.',
    rules: 'Respetar los permisos por cuenta y organización. Usar facturas ficticias. No tratar los campos extraídos como verificados hasta contrastarlos con el original.',
    verify: 'Comprobar original, resultado, corrección y exportación. Si el cambio afecta al worker, verificar también un estado fallido con un documento de ensayo.',
    files: ['apps/ocr/index.html', 'backend/app/api/ocr.py', 'backend/app/services/ocr_worker.py'],
  },
  hazlotu: {
    name: 'HazloTú',
    style: 'Landing con ejemplos visuales y una propuesta fácil de entender. Mantener clara la acción que corresponde a la fase actual.',
    flows: 'Revisar la landing en local y distinguir la presentación del control de acceso de la versión online.',
    rules: 'Respetar la disponibilidad, la protección y las decisiones de indexación. Confirmar las funciones existentes antes de anunciarlas.',
    verify: 'Comprobar la landing en móvil y escritorio. Si cambia el acceso, probar la ruta protegida en el entorno adecuado.',
    files: ['marketing/app_landings_demo/hazlatu.html', 'backend/app/api/app_routes.py'],
  },
};

export const memoryTopics = { estetica: 'Estética', flujos: 'Funcionalidades', reglas: 'Reglas y calidad' };
const textLimit = { criterio: 420, comprobacion: 240 };

export function cleanRule(input) {
  if (!input || !Object.hasOwn(memoryTopics, input.tema)) throw new Error('Selecciona un tema para el criterio.');
  const clean = { tema: input.tema };
  for (const [field, limit] of Object.entries(textLimit)) {
    const value = typeof input[field] === 'string' ? input[field].trim() : '';
    if (!value || value.length > limit) throw new Error('Escribe un criterio de hasta 420 caracteres y una comprobación de hasta 240.');
    clean[field] = value;
  }
  return clean;
}

export function projectFor(task) {
  if (Object.hasOwn(projectProfiles, task.app)) return task.app;
  const legacy = /^Proyecto: ([^\r\n]+)/.exec(task.contexto || '')?.[1].trim();
  return Object.keys(projectProfiles).find(key => projectProfiles[key].name === legacy) || 'ecosistema';
}

const words = value => new Set(value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').match(/[a-z0-9]{4,}/g) || []);

export function projectContext(task, rules = [], parent) {
  const app = parent?.app || projectFor(task);
  const query = words(`${task.encargo} ${task.contexto || ''} ${parent?.encargo || ''}`);
  function select(scope, limit) {
    return rules.filter(rule => rule.app === scope && !rule.archived).map(rule => ({
      rule,
      score: [...words(`${memoryTopics[rule.tema]} ${rule.criterio} ${rule.comprobacion}`)].filter(word => query.has(word)).length,
    })).sort((left, right) => right.score - left.score || right.rule.updatedAt.localeCompare(left.rule.updatedAt))
      .slice(0, limit).map(({ rule: { id, app, tema, criterio, comprobacion } }) => ({ id, app, tema, criterio, comprobacion }));
  }
  const confirmed = app === 'ecosistema' ? select(app, 8) : [...select(app, 5), ...select('ecosistema', 3)];
  return { app, profile: projectProfiles[app], confirmed };
}
