// Las claves de las lecciones identifican el progreso guardado en el navegador.
export const theoryLibrary = [
  {
    id: 'mapa', title: 'Mapa de Educame', icon: 'network', color: 'blue',
    description: 'Ubica las piezas y entiende qué pasa cada vez que haces un cambio.',
    lessons: [
      {
        id: 'local', title: 'Dónde vive LA TERRAZA', summary: 'Node.js sirve el panel desde tu propio ordenador en 127.0.0.1:4317.',
        detail: '127.0.0.1 significa «este ordenador» y 4317 es el puerto donde escucha el proceso. El código está en scripts/educame-dashboard.mjs y scripts/educame-dashboard/. La carpeta .educame-agents/ guarda la cola, las entregas y la configuración local. Si cierras el proceso, puedes volver a abrirlo con node scripts/educame-dashboard.mjs desde la raíz del proyecto.',
        practice: 'Abre Inicio y fíjate en la dirección del navegador. 127.0.0.1 indica que estás usando el panel de este equipo.',
        link: ['Ir a Inicio', 'inicio'],
      },
      {
        id: 'entornos', title: 'Local, GitHub y Hostinger', summary: 'Tu equipo tiene la mesa de trabajo, GitHub guarda versiones y Hostinger ejecuta la web pública.',
        detail: 'Un archivo guardado en tu ordenador aparece al recargar la vista local. Cuando lo incluyes en un commit y ese commit llega a main de GitHub, ya hay una versión remota identificable. El VPS sirve la versión que se haya desplegado allí. Son tres estados que pueden avanzar en momentos distintos.',
        practice: 'En Cambios, compara «archivos locales sin commit» con la revisión de GitHub que aparece en Hostinger.',
        link: ['Comparar en Cambios', 'cambios'],
      },
      {
        id: 'sistemas', title: 'Dos paneles con tareas distintas', summary: 'LA TERRAZA organiza tu trabajo. Administración online gestiona tus productos publicados.',
        detail: 'Desde el panel local preparas encargos, previsualizas archivos y consultas conexiones. El dashboard online está en el dominio público y, con tu sesión de administración, puede gestionar cuentas, avisos y disponibilidad de las apps. La vista local de administración abre una interfaz con datos de ensayo.',
        practice: 'En Apps, identifica el acceso a la versión online y el acceso a Vista local de un producto.',
        link: ['Ver Apps', 'apps'],
      },
    ],
  },
  {
    id: 'productos', title: 'Tus aplicaciones', icon: 'apps', color: 'violet',
    description: 'Aprende un concepto de producto usando una función que ya tienes.',
    lessons: [
      {
        id: 'profesor', product: 'profesor', title: 'Profesor Particular', summary: 'Biblioteca, temario y sesiones son capas distintas del trabajo de un profesor.',
        detail: 'El temario organiza qué se enseña. La biblioteca guarda recursos que se pueden reutilizar. Una sesión toma una actividad para que se juegue mediante un código. Separar contenido, actividad y sesión permite volver a usar el mismo juego en clases distintas.',
        practice: 'En la vista local, identifica qué puedes cambiar al crear un material y qué eliges al preparar una sesión.',
        link: ['Abrir Apps', 'apps'],
      },
      {
        id: 'eso', product: 'eso', title: 'ESO Adultos', summary: 'Temario, práctica, exámenes y progreso acompañan momentos distintos del estudio.',
        detail: 'Una práctica ofrece feedback para aprender. Un simulacro permite ensayar el formato de examen. El escritorio representa parte del avance con objetos y recompensas. Esa representación se apoya en acciones registradas, como terminar una actividad.',
        practice: 'Abre Juegos y Progreso en la vista local e identifica qué acción se practica en una y qué se consulta en la otra.',
        link: ['Abrir Apps', 'apps'],
      },
      {
        id: 'ingles', product: 'ingles', title: 'Inglés', summary: 'La ruta ordena la práctica y los niveles organizan la dificultad.',
        detail: 'El temario explica una destreza. Una misión la convierte en una acción con un objetivo. Listening añade una fuente de información sonora que se debe poder volver a escuchar. B2, C1 y C2 cambian la complejidad de las tareas y del lenguaje.',
        practice: 'Elige un juego de Inglés y describe qué destreza practica y cómo te indica que has acertado.',
        link: ['Abrir Apps', 'apps'],
      },
      {
        id: 'diplomator', product: 'diplomator', title: 'Diplomator', summary: 'Una guía de estudio convierte contenidos largos en pasos que se pueden retomar.',
        detail: 'La navegación, los contenidos y el estado de estudio son piezas separadas. Puedes reorganizar cómo se presentan las acciones de una pantalla y conservar el formato con el que se guarda el avance de una cuenta.',
        practice: 'Abre Diplomator en local y encuentra una decisión de interfaz que te ayude a saber qué hacer después.',
        link: ['Abrir Apps', 'apps'],
      },
      {
        id: 'universidad', product: 'universidad', title: 'Universidad +25', summary: 'Un mismo patrón de estudio se puede adaptar a un programa diferente.',
        detail: 'Una ruta con temario, actividades y práctica puede reutilizar ideas de otras apps. La adaptación empieza por comprobar el público, el programa y el examen al que se prepara. El contenido de cada app mantiene su propia finalidad.',
        practice: 'Compara la navegación de Universidad +25 con la de ESO Adultos. Anota un patrón común y un contenido que depende del examen.',
        link: ['Abrir Apps', 'apps'],
      },
      {
        id: 'facturas', product: 'facturas', title: 'Lector de facturas', summary: 'OCR convierte una imagen en texto y la revisión comprueba el resultado.',
        detail: 'Una factura contiene campos que deben conservar su significado, como fecha, proveedor e importe. La extracción propone valores a partir del documento. Una interfaz de revisión debe permitir localizar un dato y contrastarlo con el original.',
        practice: 'Abre la vista local y localiza dónde distinguirías el documento original de los campos extraídos.',
        link: ['Abrir Apps', 'apps'],
      },
      {
        id: 'hazlotu', product: 'hazlotu', title: 'HazloTú', summary: 'Una landing explica una idea y su acceso puede estar protegido.',
        detail: 'La landing local permite revisar texto y diseño. El acceso del sitio publicado depende de la configuración que aplica el servidor. Este caso separa la preparación de una página, el control de acceso y la decisión de hacerla pública.',
        practice: 'Abre Landing local en la tarjeta de HazloTú e identifica qué promete y cuál es el siguiente paso para el visitante.',
        link: ['Abrir Apps', 'apps'],
      },
    ],
  },
  {
    id: 'web', title: 'Cómo funciona la web', icon: 'globe', color: 'blue',
    description: 'Sigue el viaje desde un clic en el navegador hasta la respuesta del servidor.',
    lessons: [
      {
        id: 'frontend', title: 'Frontend, backend y API', summary: 'La pantalla recoge la acción y la API permite pedir al servidor que haga algo.',
        detail: 'HTML estructura, CSS da estilo y JavaScript responde a las interacciones. El backend de tus apps usa FastAPI en Python. Una ruta como /api/state recibe una petición y devuelve datos o guarda cambios según el método y la sesión.',
        practice: 'En una vista local, abre las herramientas del navegador y mira la pestaña Red mientras recargas. Busca una petición a /api/state en Inglés.',
        link: ['Elegir una vista local', 'cambios'],
      },
      {
        id: 'http', title: 'Dirección, puerto y códigos HTTP', summary: 'La URL indica dónde pedir algo y el código HTTP indica cómo terminó la petición.',
        detail: 'En http://127.0.0.1:4317/#teoria, 4317 es el puerto y #teoria señala una sección que el navegador abre dentro del panel. Un 200 indica que la petición fue atendida, 404 que la ruta no se encontró y 503 que el servicio no estaba disponible en ese momento.',
        practice: 'Abre una ruta local con la pestaña Red visible e identifica el método, el código y el tipo de respuesta.',
      },
      {
        id: 'docker', title: 'Docker, Caddy y el VPS', summary: 'Docker Compose coordina servicios y Caddy dirige las peticiones públicas.',
        detail: 'En el VPS, Compose reúne el backend y PostgreSQL. Caddy es el proxy que recibe tráfico web y lo dirige al servicio adecuado. Los volúmenes guardan datos fuera de la vida de un contenedor, lo que permite recrear el contenedor durante una actualización.',
        practice: 'Abre docker-compose.yml en el proyecto y localiza postgres, backend y reverse-proxy.',
      },
    ],
  },
  {
    id: 'datos', title: 'Datos y seguridad', icon: 'shield', color: 'green',
    description: 'Entiende qué se guarda, cómo se protege y cómo comprobar que se puede recuperar.',
    lessons: [
      {
        id: 'estado', title: 'Estado, base de datos y archivos', summary: 'Guardar un resultado puede implicar varias ubicaciones.',
        detail: 'En producción PostgreSQL guarda registros como cuentas y estados de estudio. Los documentos subidos pueden quedar en un volumen de archivos. El navegador también puede guardar preferencias o borradores locales. En Teoría, el progreso se guarda en este navegador.',
        practice: 'Marca una lección como aprendida y recarga. Después, identifica qué datos de tus apps deben acompañar a la cuenta en otro dispositivo.',
      },
      {
        id: 'backups', title: 'Copias, migraciones y restauración', summary: 'Una copia sirve cuando se puede leer y restaurar en un entorno aislado.',
        detail: 'La actualización de Hostinger crea una copia de la base con pg_dump y ejecuta cambios de estructura con Alembic. La base y los archivos se comprueban por separado. Un ensayo de restauración abre la copia en una base temporal para revisar que contiene lo esperado.',
        practice: 'En infra/HOSTINGER_UPDATE.md, encuentra qué guarda el script y en qué momento lo hace.',
      },
      {
        id: 'sesion', title: 'Sesiones, permisos y Google', summary: 'Identificar a una persona y autorizar una acción son comprobaciones distintas.',
        detail: 'Una cuenta puede entrar con Google, mientras que tu backend decide qué puede hacer según su sesión y sus permisos. Una conexión OAuth con Search Console pide permiso para consultar una propiedad. Las claves y tokens de servicios se tratan como credenciales.',
        practice: 'Compara la autorización de Search Console en Conexiones con el botón de entrada de una de tus apps.',
        link: ['Ver Conexiones', 'conexiones'],
      },
      {
        id: 'ensayo', title: 'Datos de ensayo y privacidad', summary: 'Puedes ensayar una interfaz sin abrir información real de usuarios.',
        detail: 'LA TERRAZA abre las vistas locales en puertos de bucle local y usa datos ficticios. Puedes comprobar navegación, estilos y partes del guardado. Entrar con Google, generar con IA o procesar documentos de verdad requiere un entorno con los servicios correspondientes.',
        practice: 'Abre una vista local, identifica la cuenta de ensayo y reproduce una acción con información ficticia.',
        link: ['Abrir una vista local', 'cambios'],
      },
    ],
  },
  {
    id: 'versiones', title: 'Git y despliegue', icon: 'github', color: 'violet',
    description: 'Aprende a revisar una versión antes de llevarla a producción.',
    lessons: [
      {
        id: 'git', title: 'Archivos, commits y ramas', summary: 'Un commit registra un conjunto de cambios y recibe un identificador.',
        detail: 'Tu carpeta puede tener archivos guardados que todavía no están en ningún commit. Una rama apunta a una secuencia de commits. GitHub permite compartir y revisar ese historial. En Cambios puedes filtrar qué modificó cada revisión por app.',
        practice: 'Abre un commit y mira qué archivos incluye. Intenta resumir para qué sirvió con una sola frase.',
        link: ['Abrir Historial Git', 'cambios'],
      },
      {
        id: 'sincronizar', title: 'Consultar GitHub y revisar en local', summary: 'Sincronizar trae información de GitHub. La vista previa lee tu carpeta actual.',
        detail: 'El panel consulta origin/main con git fetch para actualizar su referencia. La vista local lee el contenido guardado en tu equipo, incluido lo que aún no tiene commit. Por eso el resultado de esa vista puede diferir de lo que se va a desplegar.',
        practice: 'Selecciona una app y compara el último commit remoto con la lista de archivos locales pendientes.',
        link: ['Comparar revisiones', 'cambios'],
      },
      {
        id: 'desplegar', title: 'Qué hace el comando de Hostinger', summary: 'Actualiza el VPS a la revisión seleccionada y ejecuta las comprobaciones del proyecto.',
        detail: 'El bloque comprueba que la copia de código del VPS esté limpia, descarga main y avanza por fast-forward hasta el commit indicado. Después llama a infra/deploy-hostinger.sh, que construye la imagen, hace copias, aplica las migraciones y comprueba rutas y servicios.',
        practice: 'Genera el comando en Cambios y encuentra la línea con el identificador del commit. Puedes estudiar el bloque dentro del panel.',
        link: ['Ver Hostinger en Cambios', 'cambios'],
      },
    ],
  },
  {
    id: 'ia', title: 'IA y automatización', icon: 'sparkles', color: 'coral',
    description: 'Aprende a delegar con criterio y a revisar qué sale de cada herramienta.',
    lessons: [
      {
        id: 'agentes', title: 'Un agente tiene un encargo concreto', summary: 'El rol define qué debe revisar o producir y qué cuenta como una buena entrega.',
        detail: 'Mantenimiento analiza fallos. Juegos diseña actividades. Marketing prepara piezas. Adaptación estudia qué se puede reutilizar. Revisión cuestiona los borradores. Un buen encargo describe la app, el problema, el resultado esperado y una forma de comprobarlo.',
        practice: 'Escribe un encargo con un objetivo y un caso de prueba. Pulsa Simular para ver qué entrega generaría el flujo.',
        link: ['Abrir Agentes', 'agentes'],
      },
      {
        id: 'codex', title: 'Codex local y una API', summary: 'Un agente puede usar la sesión local de Codex o llamar a un servicio con una clave.',
        detail: 'Codex local puede preparar un plan o implementar un cambio en una copia Git aislada. El motor alternativo usa OpenAI API para borradores y análisis. En Agentes ves la cola, el progreso y los resultados. Revisa las pruebas y el resultado antes de aprobar y publicar.',
        practice: 'Abre un resultado en Agentes y localiza su motor, su resultado y lo que queda por verificar.',
        link: ['Ver resultados', 'agentes/resultados'],
      },
      {
        id: 'automatizar', title: 'Cola, revisiones y límites', summary: 'Una automatización necesita pasos claros, dependencias y una salida comprobable.',
        detail: 'Si Marketing quiere enseñar un juego, necesita primero una versión revisada. Si dos encargos son independientes, pueden ejecutarse en paralelo. Una cola ayuda a identificar qué está pendiente y qué ya se puede revisar.',
        practice: 'En Cola de trabajo, distingue un encargo listo de otro que espera el resultado de un paso anterior.',
        link: ['Ver Cola de trabajo', 'operaciones'],
      },
    ],
  },
  {
    id: 'calidad', title: 'Diseño, juegos y pruebas', icon: 'game', color: 'gold',
    description: 'Convierte ideas en flujos que se entienden y resultados que puedes verificar.',
    lessons: [
      {
        id: 'ux', title: 'UX, interfaz y accesibilidad', summary: 'La persona debe entender qué puede hacer, dónde tocar y qué pasó.',
        detail: 'La jerarquía visual ayuda a distinguir la acción principal. El texto y los estados refuerzan lo que indica el color. En móvil y con teclado hay que poder llegar a los mismos controles. Un desplegable sirve para dosificar el detalle sin perderlo.',
        practice: 'Abre una vista local y encuentra la acción principal usando primero el teclado y después una ventana estrecha.',
        link: ['Probar una app', 'apps'],
      },
      {
        id: 'juegos', title: 'De ejercicio a juego', summary: 'Un objetivo, una acción y un resultado convierten la práctica en una partida.',
        detail: 'Un tren de decenas funciona cuando los vagones tienen un papel en la respuesta. El objetivo didáctico sigue siendo reconocer números. Cada acierto debe señalar qué se ha conseguido y cada error debe dar una pista que permita volver a intentar.',
        practice: 'Elige un juego y explica en tres frases el objetivo, la acción que haces y lo que aprendes tras equivocarte.',
        link: ['Abrir Apps', 'apps'],
      },
      {
        id: 'pruebas', title: 'Qué prueban Chromium, WebKit y los tests', summary: 'Distintos tipos de prueba detectan distintos fallos.',
        detail: 'Una prueba unitaria puede verificar una respuesta matemática. Una prueba de navegador comprueba que se puede jugar y ver el resultado. Chromium y WebKit ejercitan motores distintos. Completa el ensayo con aciertos, errores, reintentos y recargas usando datos ficticios.',
        practice: 'Redacta tres pasos reproducibles para un fallo y añade qué resultado esperabas en cada uno.',
        link: ['Preparar un encargo de prueba', 'agentes'],
      },
    ],
  },
  {
    id: 'crecimiento', title: 'Marketing y métricas', icon: 'chart', color: 'green',
    description: 'Conecta lo que publicas con señales que puedas interpretar.',
    lessons: [
      {
        id: 'seo', title: 'SEO, indexación y Search Console', summary: 'SEO ayuda a que Google entienda qué ofrece cada página pública.',
        detail: 'El título, la descripción, el contenido y los enlaces ayudan a explicar el propósito de una página. Un sitemap indica qué URLs propones que se rastreen. Search Console permite comprobar impresiones, clics y consultas. Cada dato responde a una pregunta distinta.',
        practice: 'En Estadísticas, compara clics e impresiones de una app y elige una consulta para revisar su página de destino.',
        link: ['Abrir Estadísticas', 'estadisticas'],
      },
      {
        id: 'redes', title: 'Buffer, redes y publicación', summary: 'Buffer recibe una publicación y devuelve el estado por perfil de destino.',
        detail: 'El texto y el vídeo se revisan antes de confirmar el envío. El historial diferencia una solicitud aceptada, una en cola y un error. Los permisos y formatos dependen del perfil y de la red elegida.',
        practice: 'Prepara un borrador y revisa cómo cambian los campos cuando eliges YouTube. Puedes revisar el formulario sin confirmar un envío.',
        link: ['Abrir Publicar', 'publicar'],
      },
      {
        id: 'video', title: 'De un vídeo a una prueba de marketing', summary: 'Un clip sirve mejor cuando enseña una acción real de la app.',
        detail: 'Runway genera clips desde una descripción. Para mostrar el flujo del producto, puedes usar una captura de la versión revisada. Define primero qué persona quieres que vea el vídeo, qué acción entenderá y qué enlace tendrá para probarla.',
        practice: 'Escribe un guion breve con una acción visible, su resultado y una llamada a probarla.',
        link: ['Abrir Vídeo', 'video'],
      },
    ],
  },
];
