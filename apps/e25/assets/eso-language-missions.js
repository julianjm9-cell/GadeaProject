/* Misiones de Lengua Castellana redactadas para cada tema. Cada etapa tiene
   un texto de contexto, una decisión verificable y una explicación. */
(function (root) {
  'use strict';
  const step = (place, context, prompt, choices, correct, explanation) => ({place, context, prompt, choices, correct, explanation});
  const missions = {
    'len-comprension': {
      title:'Lee entre líneas', place:'Mesa de lectura', symbol:'▤', art:'public-biblioteca-inference-scene.webp',
      brief:'Lee un aviso y distingue datos, idea principal y deducciones.', stages:[
        step('Aviso','«La biblioteca abrirá los sábados de 10:00 a 14:00 a partir de noviembre».','¿De qué trata principalmente el aviso?',['De una nueva novela','Del horario de la biblioteca','De un examen de lectura'],1,'La información central es el nuevo horario de apertura.'),
        step('Dato','El aviso indica «de 10:00 a 14:00».','¿Cuántas horas abrirá cada sábado?',['Cuatro horas','Dos horas','Seis horas'],0,'De las 10:00 a las 14:00 transcurren cuatro horas.'),
        step('Deducción','Hoy es un sábado de octubre; el horario anunciado empieza en noviembre.','¿Qué puedes concluir con seguridad?',['Hoy ya abre con el nuevo horario','Hoy no existe biblioteca','El nuevo horario aún no ha comenzado'],2,'El texto solo afirma que el nuevo horario empieza en noviembre.'),
        step('Evidencia','Alguien afirma que la biblioteca cerrará los domingos.','¿Qué respuesta respeta el aviso?',['El aviso no informa sobre los domingos','Sí, lo dice expresamente','Abrirá los domingos por la tarde'],0,'No añadas información que el texto no proporciona.')
      ]
    },
    'len-resumen': {
      title:'Reduce sin perder la idea', place:'Taller de síntesis', symbol:'≡', art:'public-museo-expositivo-scene.webp',
      brief:'Convierte un texto breve en un resumen fiel y ordenado.', stages:[
        step('Tema','«Ir en bicicleta reduce el tráfico. Además, permite realizar actividad física. En la ciudad se han abierto nuevos carriles».','¿Cuál es el tema general?',['Una carrera profesional','La bicicleta en la ciudad y sus beneficios','La historia de una bicicleta concreta'],1,'Las tres frases tratan del uso urbano de la bicicleta.'),
        step('Idea esencial','El texto menciona menos tráfico y más actividad física.','¿Qué debes conservar en el resumen?',['Los dos beneficios principales','Solo la palabra “ciudad”','Una opinión no presente en el texto'],0,'Un resumen recoge las ideas principales sin añadir otras.'),
        step('Detalle','«En la ciudad se han abierto nuevos carriles».','¿Cuál de estas frases añade un dato inexistente?',['Se han abierto carriles','Los carriles son rojos','Hay nuevos carriles para bicicletas'],1,'El texto no menciona el color de los carriles.'),
        step('Versión final','Necesitas una sola frase fiel al texto.','¿Qué resumen elegirías?',['La bicicleta es el mejor transporte del mundo.','La ciudad prohíbe los coches y obliga a ir en bicicleta.','La bicicleta puede reducir el tráfico y favorecer la actividad física; la ciudad ha añadido carriles.'],2,'Esta versión conserva las ideas sin exagerar ni inventar datos.')
      ]
    },
    'len-gramatica': {
      title:'Desmonta la oración', place:'Archivo de oraciones', symbol:'▣', art:'public-archivo-sintagmas-scene.webp',
      brief:'Reconoce categorías, sujeto, predicado y tiempo verbal.', stages:[
        step('Sustantivo','«Los vecinos organizaron una reunión ayer».','¿Qué palabra es un sustantivo?',['organizaron','vecinos','ayer'],1,'Vecinos nombra a personas; es un sustantivo.'),
        step('Sujeto','En la misma oración, «Los vecinos organizaron una reunión ayer».','¿Cuál es el sujeto expreso?',['Los vecinos','una reunión','ayer'],0,'Los vecinos es el grupo que realiza la acción.'),
        step('Predicado','En «Los vecinos organizaron una reunión ayer», busca el predicado.','¿Qué parte contiene el verbo y lo que se dice del sujeto?',['Los vecinos','una reunión','organizaron una reunión ayer'],2,'El predicado comienza en el verbo organizaron.'),
        step('Tiempo','El verbo «organizaron» expresa una acción terminada.','¿En qué tiempo se sitúa?',['Presente','Pasado','Futuro'],1,'Organizaron es una forma del pretérito perfecto simple.')
      ]
    },
    'len-ortografia': {
      title:'Revisa antes de enviar', place:'Mesa de corrección', symbol:'✓', art:'public-isla-tildes.webp',
      brief:'Detecta errores concretos de tildes, puntuación y escritura.', stages:[
        step('Tilde','Quieres escribir una pregunta directa.','¿Qué opción está bien escrita?',['¿Como estás?','¿Cómo estás?','¿Cómo estas?'],1,'Cómo y estás llevan tilde en esta pregunta.'),
        step('Coma','El sujeto es «Mi hermana» y el verbo es «llegó».','¿Qué frase evita separar sujeto y verbo con coma?',['Mi hermana llegó temprano.','Mi hermana, llegó temprano.','Mi, hermana llegó temprano.'],0,'No se escribe coma entre sujeto y verbo sin inciso.'),
        step('Letra','Quieres escribir el verbo que significa regresar.','¿Qué forma es correcta?',['bolver','volver','volber'],1,'El verbo volver se escribe con v en ambas sílabas iniciales.'),
        step('Final','La oración es una afirmación completa.','¿Qué puntuación corresponde?',['Mañana entrego el trabajo','Mañana entrego el trabajo?','Mañana entrego el trabajo.'],2,'Una oración enunciativa se cierra con punto.')
      ]
    },
    'len-redaccion': {
      title:'Escribe una petición clara', place:'Estudio de escritura', symbol:'✎', art:'public-redaccion-compuesta-scene.webp',
      brief:'Prepara el inicio, el motivo, la petición y el cierre.', stages:[
        step('Destinatario','Escribes a la biblioteca municipal para pedir información.','¿Qué saludo resulta adecuado?',['Estimado equipo de la biblioteca:','Eh, colegas:','Saludos, desconocidos de internet:'],0,'Un saludo respetuoso identifica a quien recibirá la petición.'),
        step('Motivo','Quieres conocer el horario de estudio de los sábados.','¿Qué frase expresa claramente el motivo?',['Soy una persona muy ocupada y las bibliotecas son antiguas.','Les escribo para consultar el horario de la sala de estudio los sábados.','Quizá algún día lea muchos libros.'],1,'La frase precisa la información que necesitas.'),
        step('Pregunta','Aún necesitas confirmar si hay que reservar plaza.','¿Qué pregunta añades?',['¿Por qué no me responden ayer?','La reserva no puede existir.','¿Es necesario reservar plaza con antelación?'],2,'Una pregunta concreta facilita una respuesta útil.'),
        step('Cierre','Ya has indicado el motivo y la pregunta.','¿Cómo cierras el mensaje?',['Atentamente, Marta Ruiz.','No vuelvo a escribir.','Y eso.'],0,'Un cierre formal incluye despedida y firma.')
      ]
    },
    'len-literatura': {
      title:'Dentro de un relato', place:'Sala de relatos', symbol:'✦', art:'public-biblioteca-secreta.webp',
      brief:'Identifica narrador, personajes, espacio y acción en un fragmento.', stages:[
        step('Fragmento','«Clara abrió la puerta del viejo faro. Desde fuera, el mar golpeaba las rocas».','¿Qué tipo de texto es principalmente?',['Una narración','Una receta','Una solicitud'],0,'Presenta un personaje y una acción en un lugar.'),
        step('Personaje','En el fragmento, Clara abre la puerta.','¿Quién realiza la acción principal?',['El mar','Clara','La puerta'],1,'Clara es el personaje que actúa.'),
        step('Espacio','El texto menciona un faro y el mar.','¿Dónde ocurre la escena?',['En una estación','En una oficina','En un faro junto al mar'],2,'El espacio aparece indicado explícitamente.'),
        step('Narrador','El relato dice «Clara abrió» y no «yo abrí».','¿En qué persona está narrado ese fragmento?',['Tercera persona','Primera persona','Segunda persona'],0,'Se refiere a Clara como ella, en tercera persona.')
      ]
    },
    'len-textos-vida': {
      title:'Presenta una solicitud', place:'Ventanilla de trámites', symbol:'▤', art:'public-central-mensajes.webp',
      brief:'Reúne los datos necesarios y expresa una petición concreta.', stages:[
        step('Finalidad','Quieres pedir un certificado de asistencia a un curso.','¿Qué tipo de texto necesitas?',['Una reseña literaria','Una solicitud','Un poema'],1,'Una solicitud sirve para presentar una petición formal.'),
        step('Identificación','La oficina debe saber quién pide el certificado.','¿Qué dato es imprescindible?',['Tu identidad','Tu película favorita','El nombre de tu mascota'],0,'La identificación permite tramitar la solicitud.'),
        step('Petición','Debes escribir lo que necesitas.','¿Qué frase es más precisa?',['Quiero cosas de un curso.','No sé qué necesito.','Solicito un certificado de asistencia al curso realizado en mayo.'],2,'La petición concreta indica el documento y el curso.'),
        step('Contacto','La oficina puede necesitar responderte.','¿Qué dato facilitas por un canal seguro?',['La contraseña de tu cuenta','Un medio de contacto','Los datos de otra persona'],1,'Facilita solo un medio de contacto necesario; nunca contraseñas.')
      ]
    },
    'len-medios': {
      title:'Comprueba la noticia', place:'Hemeroteca', symbol:'⌕', art:'public-hemeroteca-fuentes-scene.webp',
      brief:'Separa hechos, opiniones y señales de una fuente verificable.', stages:[
        step('Titular','«El ayuntamiento abrirá una nueva biblioteca en junio».','¿Qué dato conviene confirmar primero?',['La fuente y la fecha de publicación','El color favorito del redactor','El número de emojis'],0,'Fuente y fecha ayudan a saber si la información es fiable y actual.'),
        step('Hecho','El texto dice: «La biblioteca tendrá 200 puestos de estudio».','¿Qué frase presenta un dato comprobable?',['Será la mejor biblioteca del mundo.','Tendrá 200 puestos de estudio.','Todo el mundo la adorará.'],1,'El número de puestos puede contrastarse con documentos oficiales.'),
        step('Opinión','Una persona comenta: «Es la mejor noticia del año».','¿Qué tipo de afirmación es?',['Un horario confirmado','Una cifra estadística','Una opinión'],2,'Mejor noticia expresa una valoración personal.'),
        step('Compartir','El titular llama la atención, pero no encuentras fuente ni fecha.','¿Qué haces antes de difundirlo?',['Busco una fuente fiable que lo confirme','Lo comparto como hecho seguro','Añado una fecha inventada'],0,'Conviene contrastar antes de compartir una afirmación no verificada.')
      ]
    },
    'len-argumentacion': {
      title:'Defiende una idea', place:'Sala de debate', symbol:'§', art:'public-tribunal-ambiguedad-scene.webp',
      brief:'Construye una postura con razones y responde a una objeción.', stages:[
        step('Tesis','Debates si conviene ampliar el horario de la biblioteca.','¿Qué frase formula una postura clara?',['La biblioteca tiene mesas.','Conviene ampliar el horario de la biblioteca los sábados.','Ayer pasé por la biblioteca.'],1,'Una tesis expresa la idea que defenderás.'),
        step('Argumento','Quieres apoyar la ampliación del horario.','¿Qué razón es pertinente?',['Permitiría estudiar a quienes trabajan entre semana.','Los libros pesan distinto.','El edificio es de ladrillo.'],0,'La razón conecta directamente con la utilidad del horario.'),
        step('Objeción','Otra persona dice que ampliar el horario tiene un coste.','¿Qué frase reconoce esa dificultad?',['No existe ningún coste posible.','Las ventanas son grandes.','Ampliar el horario puede aumentar los gastos.'],2,'Reconocer una objeción permite responderla con argumentos.'),
        step('Conclusión','Has expuesto tu postura, una razón y una dificultad.','¿Qué cierre sintetiza sin inventar datos?',['En resumen, ampliar el horario puede ayudar, aunque habría que valorar su coste.','Quien no está de acuerdo no sabe leer.','Está demostrado que no cuesta nada.'],0,'Una conclusión retoma la tesis y considera la objeción.')
      ]
    },
    'len-comentario': {
      title:'Comenta un texto', place:'Mesa de análisis', symbol:'✎', art:'public-sala-comentario-scene.webp',
      brief:'Explica qué dice un texto, cómo lo organiza y qué puedes valorar.', stages:[
        step('Tema','«Los parques ofrecen sombra y lugares de encuentro. Por ello, cuidarlos beneficia al barrio».','¿Cuál es el tema?',['El precio de los árboles','La utilidad de los parques y su cuidado','Una excursión de verano'],1,'El texto relaciona beneficios de los parques con la necesidad de cuidarlos.'),
        step('Estructura','La primera oración presenta beneficios; la segunda extrae una consecuencia.','¿Qué relación hay entre ambas?',['Causa y consecuencia','Dos fechas sin relación','Una lista de personajes'],0,'Por ello introduce una consecuencia de lo anterior.'),
        step('Lenguaje','El texto emplea «Por ello».','¿Qué función tiene esa expresión?',['Nombrar un lugar','Indicar una pregunta','Conectar las ideas'],2,'Por ello es un conector consecutivo.'),
        step('Valoración','Quieres añadir tu opinión al comentario.','¿Cuál está razonada y distingue opinión de dato?',['En mi opinión, cuidar los parques es útil porque mantienen espacios de encuentro.','Todos los parques son idénticos, está demostrado.','El texto dice exactamente lo contrario.'],0,'La valoración se presenta como opinión y se apoya en una razón del texto.')
      ]
    },
    'len-presentacion': {
      title:'Entrega con claridad', place:'Mesa de revisión', symbol:'✓', art:'public-museo-expositivo-scene.webp',
      brief:'Revisa orden, legibilidad, puntuación y respuesta final.', stages:[
        step('Orden','Tu respuesta tiene introducción, explicación y conclusión.','¿Qué presentación facilita su lectura?',['Todo seguido sin puntos','Párrafos separados según cada idea','Conclusión antes del enunciado'],1,'Separar ideas en párrafos ayuda a seguir la respuesta.'),
        step('Legibilidad','El texto está escrito para que otra persona lo lea.','¿Qué debes comprobar?',['Que la letra o el formato sean legibles','Que todas las palabras estén en mayúsculas','Que no haya márgenes'],0,'La legibilidad permite valorar el contenido.'),
        step('Puntuación','Tu frase dice: «La respuesta es clara además incluye un ejemplo».','¿Qué revisión mejora la separación de ideas?',['La respuesta es clara además incluye un ejemplo','La respuesta es clara? Además incluye un ejemplo','La respuesta es clara. Además, incluye un ejemplo.'],2,'El punto separa las dos oraciones y la coma sigue al conector inicial.'),
        step('Entrega','Ya has revisado contenido y forma.','¿Qué haces justo antes de entregar?',['Borras la conclusión','Compruebas que respondes a la pregunta','Añades datos que no conoces'],1,'La respuesta final debe contestar lo que pide el enunciado.')
      ]
    }
  };
  root.EsoLanguageMissions = missions;
  if (typeof module !== 'undefined' && module.exports) module.exports = missions;
})(typeof window === 'undefined' ? globalThis : window);
