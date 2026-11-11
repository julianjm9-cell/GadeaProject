// Estas fichas forman parte del contexto del proyecto. Las decisiones del usuario se guardan en el panel local.
export const projectProfiles = {
  ecosistema: {
    name: 'Educame · todas las apps',
    audience: 'La persona responsable de Educame coordina producto, diseño, validación y publicación. El panel sirve para aprender y operar el sistema desde un solo lugar.',
    priorities: 'Versionar guías y fichas base. Mantener revisiones y criterios confirmados en la memoria local por app. Cada entrega indica qué probó, su estado en Git y el siguiente paso.',
    pitfalls: 'Evitar duplicar encargos, mezclar estado local con producción o tratar propuestas como decisiones. Las fuentes externas se guardan como evidencia de una entrega y solo el responsable confirma criterios.',
    style: 'Acciones principales claras, jerarquía visual consistente y contenido legible. En LA TERRAZA, usa la paleta marfil y verde oliva, y nombres junto a los iconos.',
    flows: 'Las apps sirven tareas distintas. LA TERRAZA reúne encargos, cola, progreso y resultados en Agentes y trabajos. El dashboard online gestiona las apps publicadas.',
    rules: 'Respetar cuentas, datos, progreso y permisos. Distinguir vista local, versión en GitHub y versión desplegada. Usar datos ficticios en pruebas.',
    verify: 'Comprobar la tarea de principio a fin, en escritorio y móvil cuando afecte a la interfaz. Identificar el estado de error y recuperación.',
    files: ['docs/guia-desarrollo-educame.md', 'scripts/educame-dashboard/', 'admin/'],
  },
  control: {
    name: 'LA TERRAZA',
    audience: 'La persona responsable de Educame trabaja desde el panel local.',
    priorities: 'Mantener claros los encargos, las entregas, las conexiones y las confirmaciones.',
    pitfalls: 'Evitar acceder al almacén local de credenciales o mezclar una aplicación local con un despliegue.',
    style: 'Marfil, verde oliva, navegación agrupada, controles claros y lectura cómoda en móvil.',
    flows: 'Inicio da acceso al chat y a Agentes y trabajos. Agentes reúne la cola pendiente, el progreso de cada encargo y los resultados. El borrador se conserva y se pueden preparar encargos mientras otros se ejecutan. Desde el resultado se revisa, publica o aplica el cambio local.',
    rules: 'Limitar las modificaciones al panel y sus pruebas. Mantener el historial local y los permisos.',
    verify: 'Ejecutar comprobaciones pertinentes y conservar los accesos existentes.',
    files: ['scripts/educame-dashboard.mjs', 'scripts/educame-dashboard/', 'tests/educame-dashboard.test.cjs'],
  },
  profesor: {
    name: 'Profesor Particular',
    audience: 'Profesores particulares que necesitan preparar una clase, organizar fichas, calendario y tareas y poner al alumno a practicar en pocos pasos. La actividad debe servir tanto en portátil como en móvil.',
    priorities: 'Logo como acceso a Inicio, cabecera estable y tarjetas coherentes en toda la app. Juegos con catálogo de guardados, públicos, temario, avanzados y externos. Dar prioridad a las mecánicas que integran imagen y respuesta, a la corrección educativa y a las variantes infantil y adolescente. En Temario, abrir la práctica del tema o crear material con curso y asignatura precargados.',
    pitfalls: 'Evitar barras de unos píxeles, pistas cortadas y botones tapados. Mantener el filtro conjunto de curso y asignatura, los límites de plan en servidor y el estado de los materiales antiguos. Comprobar que el juego compartido usa su vista amplia y que al revisar respuestas se ven etiquetas humanas en vez de IDs internos.',
    style: 'Escritorio con tarjetas claras y navegación estable. Respetar los modos Estudio, Academia y Sin fondo. En juegos, usar ilustraciones que formen parte de la mecánica y mantener los controles legibles.',
    flows: 'Inicio reúne alumnos, clases y tareas. Temario, Juegos y Sesiones de juegos tienen recorridos separados. La biblioteca distingue material propio, público, del temario, avanzado y externo.',
    rules: 'Mantener privadas las fichas del profesor. El acceso a una partida con código y los datos de una ficha tienen propósitos distintos. Respetar los límites y permisos validados por el servidor.',
    verify: 'Probar selección por curso y asignatura, apertura y guardado, y juego por código cuando aplique. Comprobar que los tableros y soluciones no tapen acciones.',
    files: ['apps/profesor/index.html', 'apps/profesor/assets/profesor-appearance.css', 'apps/profesor/assets/profesor-academy-theme.css', 'backend/app/api/profesor_access.py', 'docs/profesor-plan-limits.md', 'marketing/app_landings_demo/profesor-particular.html'],
  },
  eso: {
    name: 'ESO Adultos',
    audience: 'Personas adultas que preparan la obtención de la ESO y estudian en ratos cortos. Necesitan lenguaje claro, ejemplos cotidianos y saber qué estudiar después.',
    priorities: 'Lecciones por bloques desplegables, actividades con corrección y apuntes de IA con vista de lectura. Juegos por asignatura y tema con reto, parejas, misión y recurso externo según disponibilidad. En Progreso, escritorio y estadísticas. Mostrar objetos conseguidos y bloqueados en un inventario reconocible.',
    pitfalls: 'Evitar menús repetidos, texto libre como única validación de un tema y objetos que aparenten estar conseguidos. En Exámenes, diferenciar práctica, simulacro, corrección de un examen propio e historial. Conservar resultados anteriores, borradores y la recompensa de cada reto.',
    style: 'Interfaz adulta y despejada, con iconos coherentes por asignatura y tarjetas de alto contraste. Reservar la ambientación para prácticas, misiones y escritorio.',
    flows: 'Asignaturas reúne Temario, Recursos y Mis apuntes. Juegos organiza la práctica por tema. Exámenes ofrece Practicar, Simulacro de examen, Corregir examen e Historial. Progreso reúne escritorio y estadísticas.',
    rules: 'Preservar apuntes y progreso. Mostrar feedback verificable en prácticas. En corrección por foto, permitir revisar qué texto se va a corregir y conservar el borrador.',
    verify: 'Probar acierto y error, guardado y recarga. En una misión, comprobar tacto, cierre y resultado. Distinguir el ensayo local de la corrección real.',
    files: ['apps/e25/index.html', 'apps/e25/assets/eso-mission-boards.css', 'backend/app/static/assets/study-appearance/', 'docs/eso-examenes-flujo.md'],
  },
  ingles: {
    name: 'Inglés',
    audience: 'Personas con poco tiempo que preparan B2 First, C1 Advanced o C2 Proficiency. Les sirve una próxima acción clara, explicaciones breves en español y práctica fiel al nivel.',
    priorities: 'Separar estudio por Temario, avance visual por Juegos, Práctica de destrezas y consulta en Biblioteca. Conectar escenas, elecciones y progreso para que cada misión parezca un juego. En la landing, explicar las funciones con una vista interactiva y ejemplos, sin exigir una partida de entrada.',
    pitfalls: 'Evitar banners que empujen las acciones hacia abajo, filtros duplicados y anunciar niveles o partes de Listening no disponibles. Verificar las respuestas válidas, las variantes aceptables de inglés y las condiciones de grabación, reproducción y corrección por separado.',
    style: 'La estética Ruta usa un tren, una próxima misión y un recorrido de temas. En práctica, favorecer tarjetas claras y acciones directas. La landing explica la app con vistas relacionadas con la funcionalidad.',
    flows: 'Inicio, Juegos, Temario, Práctica y Biblioteca. Las rutas y destrezas se organizan por nivel. La práctica incluye Speaking, Writing y Listening según el contenido disponible.',
    rules: 'Ajustar dificultad y explicaciones al nivel. Conservar el progreso por nivel y el contenido existente. Verificar la versión publicada antes de presentar una capacidad como disponible.',
    verify: 'Comprobar una misión con acierto, error y reanudación. Si afecta a audio o micrófono, distinguir reproducción, permisos y servicios de transcripción.',
    files: ['apps/cambridge/index.html', 'apps/cambridge/assets/studio/journey.css', 'apps/cambridge/assets/studio/games.js', 'apps/cambridge/assets/studio/landing-preview.js', 'marketing/app_landings_demo/cambridge.html'],
  },
  diplomator: {
    name: 'Diplomator',
    audience: 'Personas que estudian temas para preparar la carrera diplomática y quieren practicar la exposición oral de forma regular.',
    priorities: 'Sesión de hoy, selección de tema, puntos clave, vocabulario, práctica oral e historial. Facilitar pasar de las notas a la exposición y recuperar una sesión guardada.',
    pitfalls: 'Distinguir grabación, transcripción, revisión y guardado. Conservar tema e idioma al retomar o exportar. Una corrección orientativa debe indicar qué recibió realmente.',
    style: 'Conservar la presentación de estudio y el lenguaje visual de sus materiales. Facilitar la lectura de temas, acciones de práctica y resultados.',
    flows: 'Sesión de hoy, temas y práctica. Mantener accesibles las actividades y herramientas vinculadas a la preparación.',
    rules: 'Preservar el estado por cuenta y la separación entre contenidos, preferencias y evaluación. Comprobar los permisos antes de sugerir cambios que afecten a usuarios.',
    verify: 'Abrir un tema o actividad, completar una acción y comprobar que se puede retomar. Si afecta a un documento, revisar también su descarga o presentación.',
    files: ['apps/diplomator/index.html', 'apps/diplomator/assets/diplomator-refresh.css', 'backend/app/services/diplomator_pdf.py', 'marketing/app_landings_demo/diplomator.html'],
  },
  universidad: {
    name: 'Universidad +25',
    audience: 'Personas adultas que preparan la prueba de acceso a la universidad para mayores de 25 años. Necesitan distinguir qué temario, práctica y examen corresponde a cada materia.',
    priorities: 'Organizar contenidos, práctica y simulacros con objetivos claros. Ayudar a estudiar por tema y volver al punto de avance. Las descargas deben corresponder a la actividad elegida.',
    pitfalls: 'Comprobar el programa y el ámbito antes de afirmar que un contenido cubre una convocatoria. Evitar mezclar resultados con ESO Adultos y conservar el progreso de cuentas existentes.',
    style: 'Priorizar lectura cómoda, contenido organizado y una acción siguiente reconocible para personas adultas.',
    flows: 'Preparación para el acceso a la universidad con contenidos y práctica del programa correspondiente.',
    rules: 'Mantener separados el programa de acceso y los materiales de otras apps. Conservar avance y preferencias. Verificar el temario vigente en el código antes de proponer cambios.',
    verify: 'Identificar el tema o práctica afectada y probar navegación, avance y recarga con datos ficticios.',
    files: ['apps/u25/index.html', 'marketing/app_landings_demo/universidad-25.html'],
  },
  facturas: {
    name: 'Lector de facturas',
    audience: 'Personas que digitalizan facturas y necesitan revisar los datos contra el original antes de exportarlos.',
    priorities: 'Cargar documentos, seguir el trabajo, comparar original y datos, corregir y exportar. Identificar de un vistazo si la lectura está pendiente, falló o requiere revisión.',
    pitfalls: 'Evitar interpretar un OCR como validación contable. Preservar decimales, moneda, fechas e impuestos. Ante un reintento, comprobar que no se duplican documentos o trabajos.',
    style: 'Interfaz de trabajo con estados visibles y comparación cómoda entre documento original y datos extraídos.',
    flows: 'Recepción de documentos, procesamiento OCR, revisión y exportación. Diferenciar trabajos pendientes, completados y fallidos.',
    rules: 'Respetar los permisos por cuenta y organización. Usar facturas ficticias. No tratar los campos extraídos como verificados hasta contrastarlos con el original.',
    verify: 'Comprobar original, resultado, corrección y exportación. Si el cambio afecta al worker, verificar también un estado fallido con un documento de ensayo.',
    files: ['apps/ocr/index.html', 'backend/app/api/ocr.py', 'backend/app/services/ocr_worker.py'],
  },
  hazlotu: {
    name: 'HazloTú',
    audience: 'Visitas a una página de presentación cuya visibilidad y acceso controla el responsable de Educame.',
    priorities: 'Cuidar la presentación, explicar la propuesta en pocos pasos y verificar el estado de disponibilidad antes de cambiar llamadas a la acción.',
    pitfalls: 'Mantener el control real de acceso separado de la indexación. Evitar enlaces promocionales, capturas o cambios de visibilidad que adelanten una apertura.',
    style: 'Landing con ejemplos visuales y una propuesta fácil de entender. Mantener clara la acción que corresponde a la fase actual.',
    flows: 'Revisar la landing en local y distinguir la presentación del control de acceso de la versión online.',
    rules: 'Respetar la disponibilidad, la protección y las decisiones de indexación. Confirmar las funciones existentes antes de anunciarlas.',
    verify: 'Comprobar la landing en móvil y escritorio. Si cambia el acceso, probar la ruta protegida en el entorno adecuado.',
    files: ['marketing/app_landings_demo/hazlatu.html', 'backend/app/api/app_routes.py'],
  },
};

export const memoryTopics = {
  estetica: 'Estética', flujos: 'Funcionalidades', reglas: 'Reglas y calidad',
  pedagogia: 'Didáctica y juegos', accesibilidad: 'Accesibilidad y dispositivos',
  marketing: 'Marketing y SEO', operacion: 'Operación y datos',
};
export const contextSettings = { profiles: projectProfiles, topics: memoryTopics, appLimit: 10, sharedLimit: 5 };
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

export function projectContext(task, rules = [], parent, settings = contextSettings) {
  const app = parent?.app || projectFor(task);
  const query = words(`${task.encargo} ${task.contexto || ''} ${parent?.encargo || ''}`);
  function select(scope, limit) {
    const ranked = rules.filter(rule => rule.app === scope && !rule.archived).map(rule => ({
      rule,
      score: [...words(`${settings.topics[rule.tema] || ''} ${rule.criterio} ${rule.comprobacion}`)].filter(word => query.has(word)).length,
    })).sort((left, right) => right.score - left.score || (right.rule.updatedAt || '').localeCompare(left.rule.updatedAt || ''));
    const topics = new Set();
    const firstOfTopic = ranked.filter(({ rule }) => {
      if (topics.has(rule.tema)) return false;
      topics.add(rule.tema);
      return true;
    });
    return [...new Set([...ranked.filter(item => item.score > 0), ...firstOfTopic, ...ranked])]
      .slice(0, limit).map(({ rule: { id, app, tema, criterio, comprobacion } }) => ({ id, app, tema, criterio, comprobacion }));
  }
  const confirmed = app === 'ecosistema' ? select(app, settings.appLimit + settings.sharedLimit) :
    [...select(app, settings.appLimit), ...select('ecosistema', settings.sharedLimit)];
  return { app, profile: settings.profiles[app], confirmed };
}
