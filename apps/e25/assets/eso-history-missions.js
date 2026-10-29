/* Misiones de Historia y Ciudadanía: fuentes, cronología y decisiones cívicas. */
(function (root) {
  'use strict';
  const S = (place, context, prompt, choices, correct, explanation) => ({place, context, prompt, choices, correct, explanation});
  const M = (title, place, symbol, art, brief, stages) => ({title, place, symbol, art, brief, stages});
  const missions = {
    'his-antigua': M('El museo de las civilizaciones','Galería antigua','◈','public-museo-expositivo-scene.webp','Identifica vestigios y sitúalos en su contexto.',[
      S('Río','Una ciudad antigua creció junto a un río que fertilizaba sus campos.','¿Qué ventaja proporcionaba?',['Agua para cultivo y vida','Electricidad doméstica','Ferrocarriles'],0,'El agua permitía regar, abastecerse y desarrollar asentamientos.'),
      S('Grecia','Encuentras una inscripción sobre una asamblea de ciudadanos en Atenas.','¿Con qué práctica se relaciona?',['Feudalismo','Participación política de algunos ciudadanos','Sufragio universal actual'],1,'En Atenas participaban ciertos ciudadanos; no toda la población tenía ese derecho.'),
      S('Roma','El museo muestra una calzada romana.','¿Para qué ayudaban las calzadas?',['Solo a decorar ciudades','A detener la escritura','A comunicar y administrar territorios'],2,'Las calzadas facilitaban desplazamientos, comercio y control territorial.'),
      S('Legado','Una lengua actual conserva palabras derivadas del latín.','¿De qué civilización procede ese legado?',['Romana','Vikinga','Industrial'],0,'El latín se extendió con Roma y está en el origen de lenguas romances.')
    ]),
    'his-medieval': M('La ciudad tras la muralla','Archivo medieval','♜','public-biblioteca-secreta.webp','Reconstruye cómo cambió la vida medieval.',[
      S('Campo','Un señor entrega tierras a un vasallo a cambio de servicios.','¿Con qué sistema se relaciona?',['Capitalismo industrial','Feudalismo','Democracia parlamentaria'],1,'La relación entre tierras, vínculos personales y obligaciones caracteriza al feudalismo.'),
      S('Sociedad','La sociedad se organiza en grupos con derechos y funciones diferentes.','¿Cómo se llama esa organización?',['Sociedad estamental','Ciudadanía universal','Mercado único'],0,'Los estamentos tenían funciones y privilegios distintos.'),
      S('Ciudad','Los artesanos del mismo oficio regulan formación y calidad.','¿Qué organización formaban?',['Parlamentos nacionales','Cámaras de comercio modernas','Gremios'],2,'Los gremios agrupaban artesanos de un oficio en muchas ciudades medievales.'),
      S('Cambio','Aumentan el comercio y la población urbana.','¿Qué actividad gana peso?',['La caza exclusivamente','Artesanía y mercados urbanos','La fabricación de automóviles'],1,'El crecimiento urbano impulsó artesanía e intercambios comerciales.')
    ]),
    'his-moderna': M('La imprenta de las ideas','Taller de la Edad Moderna','✧','public-cronica-pasado-scene.webp','Relaciona expansión, imprenta e Ilustración.',[
      S('Difusión','Un taller puede imprimir muchos ejemplares de un mismo texto.','¿Qué efecto tuvo la imprenta?',['Aceleró la circulación de ideas','Eliminó todas las desigualdades','Impidió leer libros'],0,'La impresión multiplicó la difusión de textos e ideas.'),
      S('Viajes','Las potencias europeas abren rutas marítimas y colonizan territorios.','¿Qué consecuencia se asocia a esa expansión?',['Fin inmediato del comercio','Intercambios y dominación colonial','Desaparición de los océanos'],1,'La expansión produjo intercambios y también conquista y explotación.'),
      S('Poder','Una monarquía concentra gran parte del poder político.','¿Qué modelo describe mejor esa concentración?',['República federal','Democracia directa','Monarquía absoluta'],2,'La monarquía absoluta concentraba amplios poderes en el soberano.'),
      S('Ilustración','Un texto defiende usar la razón y debatir el poder.','¿Con qué corriente se relaciona?',['Ilustración','Feudalismo temprano','Arte rupestre'],0,'La Ilustración defendió la razón y la crítica de instituciones tradicionales.')
    ]),
    'his-contemporanea': M('La fábrica y la asamblea','Ciudad del cambio','⚙','public-archivo-contemporaneo-scene.webp','Ordena los cambios políticos y económicos.',[
      S('Derechos','Un grupo reclama que la ley limite el poder del rey.','¿Con qué cambio se relaciona?',['Restauración feudal','Revoluciones liberales','Revolución neolítica'],1,'Las revoluciones liberales cuestionaron el poder absoluto.'),
      S('Máquina','Una fábrica sustituye parte del trabajo manual por máquinas de vapor.','¿Qué proceso representa?',['Industrialización','Romanización','Descolonización del siglo XX'],0,'La mecanización y la fábrica son rasgos de la Revolución Industrial.'),
      S('Ciudad','Muchos trabajadores se trasladan del campo a la ciudad.','¿Qué fenómeno aumenta?',['Ruralización','Nomadismo antiguo','Urbanización'],2,'La industria concentró empleo y población en ciudades.'),
      S('Trabajo','La jornada es larga y el salario bajo.','¿Qué respuesta histórica fue habitual?',['Prohibir toda asociación para siempre','Organización obrera y reivindicación laboral','Volver al Imperio romano'],1,'Los trabajadores se organizaron para reclamar mejores condiciones.')
    ]),
    'his-sigloxx': M('La línea del tiempo reciente','Archivo del siglo XX','◴','public-cronica-pasado-scene.webp','Sitúa acontecimientos sin confundir épocas.',[
      S('Primera mitad','Un documento está fechado en 1914.','¿Con qué conflicto se relaciona el comienzo de ese año?',['Primera Guerra Mundial','Segunda Guerra Mundial','Guerra Fría'],0,'La Primera Guerra Mundial comenzó en 1914.'),
      S('Posguerra','Tras 1945, dos grandes bloques compiten sin enfrentamiento militar directo entre sí.','¿Cómo se llama ese periodo?',['Edad Media','Guerra Fría','Revolución Industrial'],1,'La Guerra Fría enfrentó políticamente a bloques liderados por EE. UU. y la URSS.'),
      S('España','La Constitución española vigente se aprueba en 1978.','¿En qué proceso se sitúa?',['Imperio romano','Reinado de los Reyes Católicos','Transición a la democracia'],2,'La Constitución de 1978 forma parte de la Transición democrática.'),
      S('Actualidad','Un hecho de hoy se explica por procesos anteriores.','¿Qué herramienta ayuda a ordenar causas y consecuencias?',['Línea del tiempo con fuentes','Solo un titular aislado','Un mapa sin fechas'],0,'La cronología y las fuentes permiten relacionar procesos históricos.')
    ]),
    'his-ciudadania': M('El pleno del municipio','Sala cívica','⚖','public-asamblea-revoluciones-scene.webp','Distingue instituciones, derechos y participación.',[
      S('Elección','La ciudadanía elige representantes municipales mediante voto.','¿Qué forma de participación es?',['Elecciones','Herencia del cargo','Sorteo obligatorio'],0,'El voto permite escoger representantes en elecciones.'),
      S('Servicios','Se debate la limpieza de calles y parques del municipio.','¿Qué institución cercana interviene directamente?',['Tribunal internacional','Ayuntamiento','Banco central'],1,'El ayuntamiento gestiona muchos servicios locales.'),
      S('Derecho','Un vecino expresa una opinión sin amenazar a nadie.','¿Qué derecho ejerce?',['Derecho a imponerla','Derecho a excluir a otros','Libertad de expresión'],2,'La libertad de expresión ampara opiniones dentro de los límites legales.'),
      S('Debate','Dos personas discrepan sobre una norma.','¿Qué conducta favorece la convivencia democrática?',['Escuchar y argumentar con respeto','Impedir que hable la otra','Difundir rumores personales'],0,'Debatir con razones y respeto permite participar sin vulnerar derechos ajenos.')
    ]),
    'his-espana': M('El archivo de la Transición','Archivo de España','▤','public-archivo-contemporaneo-scene.webp','Ordena hechos de la España contemporánea.',[
      S('Inicio','Un documento menciona la Restauración iniciada en 1874.','¿Qué periodo es anterior?',['La Segunda República','La Restauración','La Transición'],1,'La Restauración precedió a la Segunda República y a la Transición.'),
      S('República','La Segunda República comenzó en España en 1931.','¿Qué suceso comenzó después, en 1936?',['Guerra Civil española','Revolución Industrial británica','Imperio romano'],0,'La Guerra Civil española comenzó en 1936.'),
      S('Dictadura','Finaliza la Guerra Civil en 1939.','¿Qué régimen siguió?',['Segunda República','Monarquía absoluta medieval','Dictadura franquista'],2,'La dictadura de Franco se estableció tras la guerra.'),
      S('Democracia','La Constitución de 1978 se aprueba después de la dictadura.','¿Qué consolidó?',['Una vuelta al feudalismo','Un marco democrático de derechos e instituciones','La abolición de los municipios'],1,'La Constitución estableció el marco institucional de la democracia actual.')
    ]),
    'his-andalucia': M('El patrimonio habla','Museo de Andalucía','❖','public-museo-expositivo-scene.webp','Aprende a leer y conservar bienes culturales.',[
      S('Fuente','Una excavación descubre una pieza de cerámica antigua.','¿Qué tipo de fuente es?',['Material o arqueológica','Solo oral','Una predicción futura'],0,'Los objetos conservados son fuentes materiales del pasado.'),
      S('Contexto','Encuentras una inscripción en un edificio histórico.','¿Qué dato ayuda a interpretarla?',['Solo su precio actual','Fecha, lugar y función del edificio','Su número de visitantes de hoy'],1,'El contexto histórico y la función del bien ayudan a entenderlo.'),
      S('Cuidado','Una sala presenta humedad que daña documentos antiguos.','¿Qué medida conviene?',['Exponerlos a más agua','Desecharlos sin estudiar','Controlar humedad y conservarlos'],2,'La conservación preventiva evita el deterioro de documentos.'),
      S('Valor','Un monumento recibe visitantes y también es importante para el barrio.','¿Qué enfoque lo protege mejor?',['Conservarlo y facilitar un uso respetuoso','Usarlo sin límites','Cerrar toda investigación'],0,'El patrimonio puede disfrutarse si se conserva y se usa con cuidado.')
    ]),
    'his-valores': M('La mediación del centro','Sala de convivencia','♡','public-asamblea-revoluciones-scene.webp','Resuelve conflictos con igualdad y argumentos.',[
      S('Escucha','Dos compañeros discrepan por el reparto de tareas.','¿Cuál es el primer paso útil?',['Escuchar a ambas partes','Insultar a una parte','Publicar rumores'],0,'Escuchar permite entender hechos y necesidades antes de proponer soluciones.'),
      S('Igualdad','Una persona queda excluida de una actividad por una discapacidad.','¿Qué respuesta respeta mejor la igualdad?',['Mantener la exclusión','Eliminar barreras y ofrecer ajustes razonables','Prohibir la actividad a todos'],1,'Eliminar barreras favorece la participación en igualdad.'),
      S('Prueba','Circula una acusación sin datos.','¿Qué conviene hacer antes de difundirla?',['Compartirla por si acaso','Añadir detalles inventados','Comprobar hechos y fuente'],2,'Difundir acusaciones sin verificar puede perjudicar a personas.'),
      S('Acuerdo','Las partes han explicado el problema.','¿Qué propuesta facilita una solución pacífica?',['Un reparto claro y revisable de tareas','Decidir sin escuchar','Dejar la disputa abierta'],0,'Un acuerdo concreto y revisable ayuda a resolver el conflicto.')
    ]),
    'his-fuentes': M('¿Qué cuenta este documento?','Hemeroteca histórica','▣','public-hemeroteca-fuentes-scene.webp','Identifica autoría, fecha, tipo y límites de una fuente.',[
      S('Tipo','Lees una carta escrita por una testigo durante un acontecimiento.','¿Qué tipo de fuente es?',['Secundaria posterior','Primaria de la época','Ficción necesariamente'],1,'Fue producida en el periodo estudiado por una testigo: fuente primaria.'),
      S('Contexto','La carta no tiene fecha visible.','¿Qué dato conviene investigar?',['Cuándo y dónde se escribió','El tamaño de la pantalla','El color de tu carpeta'],0,'Fecha y lugar ayudan a contextualizar un documento.'),
      S('Perspectiva','La autora describe lo que vio desde una sola calle.','¿Qué límite tiene su testimonio?',['Demuestra todo lo ocurrido en el país','No sirve para nada','Ofrece una perspectiva parcial'],2,'Una fuente puede ser valiosa y a la vez limitada por su posición.'),
      S('Contraste','Una crónica posterior contradice un detalle de la carta.','¿Qué harías?',['Borrar ambas','Contrastar con otras fuentes y explicar la discrepancia','Elegir la versión más bonita'],1,'El contraste de fuentes permite valorar qué se puede afirmar.')
    ]),
    'his-musica-cultura': M('La canción del archivo','Fonoteca social','♫','public-cronica-pasado-scene.webp','Interpreta música como expresión de una época.',[
      S('Contexto','La ficha de una canción indica año, lugar y autor.','¿Para qué sirven esos datos?',['Para situar la obra en su contexto','Para decidir si suena fuerte','Para contar instrumentos únicamente'],0,'Fecha, lugar y autor ayudan a interpretar su relación con la sociedad.'),
      S('Mensaje','La letra pide mejoras laborales para un colectivo.','¿Qué puede reflejar?',['Solo un ritmo musical','Una demanda social de su tiempo','Una ley universal ya aprobada'],1,'Una canción puede expresar demandas de un grupo social.'),
      S('Límite','Un verso critica una decisión política.','¿Qué NO puedes concluir solo a partir de ese verso?',['Que existe una crítica','Que la canción expresa una postura','Que toda la sociedad pensaba igual'],2,'La voz de una canción no representa por sí sola a toda la sociedad.'),
      S('Comparación','Comparas canciones de dos décadas distintas.','¿Qué análisis es más útil?',['Relacionar letras y estilos con sus contextos','Decir que una época fue siempre mejor','Ignorar las fechas'],0,'Los cambios culturales se comprenden mejor al relacionarlos con su contexto.')
    ])
  };
  root.EsoHistoryMissions = missions;
  if (typeof module !== 'undefined' && module.exports) module.exports = missions;
})(typeof window === 'undefined' ? globalThis : window);
