/* Misiones guiadas de Inglés. Cada decisión se ha escrito para su tema y tiene
   una única respuesta comprobable; no se construye a partir del título del tema. */
(function (root) {
  'use strict';
  const step = (place, context, prompt, choices, correct, explanation) => ({place, context, prompt, choices, correct, explanation});
  const missions = {
    'ing-reading': {
      title:'La pista del horario', brief:'Lee un aviso y ayuda a Maya a llegar a la biblioteca.',
      stages:[
        step('Aviso','The library closes at 6 p.m. on Fridays.','¿A qué hora cierra los viernes?',['A las 16:00','A las 18:00','A las 20:00'],1,'6 p.m. equivale a las 18:00.'),
        step('Préstamo','Please return borrowed books by Monday.','¿Qué debe devolver Maya como muy tarde el lunes?',['Los libros prestados','Su tarjeta de transporte','Un formulario'],0,'Borrowed books significa libros prestados; by Monday indica el plazo máximo.'),
        step('Acceso','The study room is upstairs, next to the computers.','¿Dónde está la sala de estudio?',['Fuera del edificio','Junto a la entrada','Arriba, al lado de los ordenadores'],2,'Upstairs indica la planta superior; next to significa al lado.'),
        step('Conclusión','It is Friday, 5:45 p.m. Maya needs an hour in the study room.','¿Le queda una hora antes del cierre?',['Sí, exactamente','No, solo quince minutos','El aviso no indica el horario'],1,'De 17:45 a 18:00 quedan quince minutos.')
      ]
    },
    'ing-vocabulary': {
      title:'Una mañana en la ciudad', brief:'Escoge expresiones completas para resolver cuatro situaciones cotidianas.',
      stages:[
        step('Cafetería','You want a glass of water.','¿Qué pides con cortesía?',['I would like a glass of water, please.','I am water yesterday.','I have a glass of work.'],0,'I would like… es una forma cortés de pedir algo.'),
        step('Transporte','You need to know the train departure time.','¿Qué palabra buscas en el panel?',['Salary','Departure','Appointment'],1,'Departure indica la salida; arrival, la llegada.'),
        step('Empleo','You want to request a job.','¿Qué significa «apply for a job»?',['Dejar un empleo','Pagar un trabajo','Solicitar un empleo'],2,'Apply for a job significa solicitar un empleo.'),
        step('Salud','You need to see a doctor tomorrow.','¿Qué necesitas pedir?',['A receipt','An appointment','A platform'],1,'An appointment es una cita.')
      ]
    },
    'ing-grammar': {
      title:'El calendario de Alex', brief:'Completa su historia distinguiendo hábitos, pasado y planes.',
      stages:[
        step('Rutina','Alex works at a shop every day.','Completa: Alex ___ at a shop every day.',['work','works','worked'],1,'En present simple, la tercera persona singular añade -s.'),
        step('Ayer','Yesterday Alex visited a friend.','Completa: Yesterday Alex ___ a friend.',['visits','will visit','visited'],2,'Yesterday sitúa la acción en el pasado terminado.'),
        step('Experiencia','Alex began living here five years ago and still lives here.','Completa: Alex ___ here for five years.',['has lived','lived yesterday','will live'],0,'Present perfect con for conecta el inicio pasado con el presente.'),
        step('Consejo','Alex has an exam tomorrow.','Elige un consejo correcto.',['You should revise tonight.','You should to revise tonight.','You should revises tonight.'],0,'Después de should se usa el infinitivo sin to.')
      ]
    },
    'ing-writing': {
      title:'Un correo para pedir información', brief:'Construye un mensaje claro para preguntar por un curso.',
      stages:[
        step('Saludo','You are writing to a course coordinator you do not know.','¿Qué saludo encaja?',['Hey mate,','Dear Sir or Madam,','See you soon,'],1,'Dear Sir or Madam es apropiado cuando no conoces el nombre.'),
        step('Motivo','You want to know the course schedule.','¿Qué frase expresa el motivo?',['I am writing to ask about the course timetable.','I wrote timetable yesterday.','I will timetable the course.'],0,'La frase explica claramente para qué escribes.'),
        step('Pregunta','You need to know the price too.','¿Qué pregunta añades?',['How old are you?','Could you tell me the price, please?','Where did I go?'],1,'Could you tell me… formula una petición cortés.'),
        step('Cierre','You have finished the formal email.','¿Qué cierre utilizas?',['Kind regards,','Because,','Good morning?'],0,'Kind regards es un cierre habitual de correo formal.')
      ]
    },
    'ing-listening': {
      title:'En el punto de información', brief:'Resuelve indicaciones y peticiones habituales sin depender de audio.',
      stages:[
        step('Destino','A visitor asks: “Where is the station?”','¿Qué quiere saber?',['La hora actual','Dónde está la estación','El precio de un billete'],1,'Where is… pregunta por la ubicación.'),
        step('Dirección','An assistant says: “Turn left at the traffic lights.”','¿Qué debes hacer?',['Girar a la izquierda en el semáforo','Seguir recto hasta el parque','Girar a la derecha en la estación'],0,'Turn left es girar a la izquierda.'),
        step('Problema','You cannot hear the assistant clearly.','¿Cómo pides que repita?',['I am the station.','Could you repeat that, please?','Where are you from?'],1,'Could you repeat that, please? pide una repetición con cortesía.'),
        step('Confirmación','The assistant says: “It is opposite the bank.”','¿Dónde está?',['Dentro del banco','Detrás del banco','Enfrente del banco'],2,'Opposite significa enfrente de.')
      ]
    },
    'ing-dialogues': {
      title:'Cuatro conversaciones', brief:'Elige la intervención que hace avanzar cada diálogo.',
      stages:[
        step('Tienda','Shop assistant: “Can I help you?”','Quieres probar una chaqueta.',['Yes, can I try this on?','Yes, I am trying yesterday.','No, where is my doctor?'],0,'Can I try this on? pide probarse una prenda.'),
        step('Consulta','Receptionist: “What do you need?”','Quieres pedir una cita.',['I have a platform.','I would like to make an appointment.','I am a ticket.'],1,'Make an appointment significa pedir una cita.'),
        step('Estación','Clerk: “Single or return?”','Necesitas ida y vuelta.',['Single, please.','Return, please.','Today is Monday.'],1,'Return ticket es un billete de ida y vuelta.'),
        step('Despedida','Assistant: “Here is your receipt.”','¿Qué respondes?',['I will be receipt.','The station is left.','Thank you. Have a nice day.'],2,'Una respuesta breve y cortés cierra la conversación.')
      ]
    },
    'ing-forms': {
      title:'Prepara el viaje', brief:'Lee un horario y rellena los datos correctos de una reserva.',
      stages:[
        step('Salida','Train A: departure 09:15; arrival 10:40.','¿A qué hora sale el tren A?',['09:15','10:40','19:15'],0,'Departure es la hora de salida.'),
        step('Andén','The ticket says “Platform 4”.','¿Dónde esperas el tren?',['En la puerta 4 del hotel','En el andén 4','En la fila 4 del avión'],1,'Platform significa andén en una estación.'),
        step('Formulario','The field says “Surname”. Your name is Ana Ruiz.','¿Qué escribes en esa casilla?',['Ana','Ruiz','Ana Ruiz, 09:15'],1,'Surname pide el apellido.'),
        step('Revisión','The form says “Email (required)”.','¿Qué significa required?',['Que el dato es obligatorio','Que el dato es secreto','Que el dato es opcional'],0,'Required señala un campo obligatorio.')
      ]
    },
    'ing-connectors': {
      title:'Ordena el mensaje', brief:'Enlaza las ideas de una nota breve sin cambiar su sentido.',
      stages:[
        step('Inicio','___, read the instructions carefully.','¿Qué conector inicia una secuencia?',['However','First','Because'],1,'First introduce el primer paso.'),
        step('Causa','I stayed at home ___ I was ill.','¿Qué conector expresa el motivo?',['because','but','then'],0,'Because introduce la causa.'),
        step('Contraste','The task was difficult, ___ I finished it.','¿Qué conector marca contraste?',['so','for example','but'],2,'But contrapone dificultad y resultado.'),
        step('Cierre','___, check your answers before you send them.','¿Qué conector cierra los pasos?',['Finally','Although','Because'],0,'Finally presenta el último paso.')
      ]
    },
    'ing-exam-strategy': {
      title:'Misión de examen', brief:'Decide cómo leer, responder y revisar una prueba de Inglés.',
      stages:[
        step('Primera lectura','You do not understand every word in a notice.','¿Qué haces primero?',['Dejar la pregunta en blanco','Buscar nombres, fechas y palabras clave','Traducir palabra por palabra sin leer las preguntas'],1,'Los datos y palabras clave permiten captar el sentido general.'),
        step('Pregunta','The question asks “When does the course start?”','¿Qué dato buscas?',['Una fecha','Un lugar','Una opinión'],0,'When pregunta por un momento o fecha.'),
        step('Respuesta','You found “The course starts on 12 May”.','¿Qué respuesta es directa?',['It starts on 12 May.','It starts in the library yesterday.','I have a course.'],0,'Responde con la información del texto sin añadir datos.'),
        step('Revisión','Your answer says “She go to class every day”.','¿Qué corriges antes de entregar?',['She going to class every day.','She goes to class every day.','She go yesterday every day.'],1,'Con she, el present simple de go es goes.')
      ]
    }
  };
  root.EsoEnglishMissions = missions;
  if (typeof module !== 'undefined' && module.exports) module.exports = missions;
})(typeof window === 'undefined' ? globalThis : window);
