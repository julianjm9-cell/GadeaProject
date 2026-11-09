(() => {
  const lesson = (id, title, skill, idea, example, trap, question, options, correct, why, mission) => ({
    id, title, skill, idea, example, trap, question, options, correct, why, mission
  });
  const decision = (label, text, options, correct, why) => ({label, text, options, correct, why});
  const mission = (id, title, skill, intro, kind, art, stages, checkpoints) => ({
    id, title, skill, intro, scene:{kind, art}, stages, checkpoints
  });

  window.EnglishExpansion = {
    'B2 First': {
      lessons: [
        lesson('b2-time-markers','Present perfect y past simple','Use of English',
          'Busca primero el marcador temporal. Usa past simple para un periodo terminado y present perfect si el periodo llega hasta ahora o te interesa el resultado actual.',
          'I sent the tickets yesterday. I’ve already sent the tickets, so you can print them now.',
          'This morning puede indicar un periodo abierto o cerrado. Depende de cuándo hablas.',
          'Which sentence refers to a finished time?', ['I’ve booked two seats so far.','I booked two seats on Monday.','I’ve just booked two seats.'],1,
          'On Monday sitúa la acción en un momento pasado y terminado.', 'b2-radio'),
        lesson('b2-reported-requests','Peticiones en estilo indirecto','Use of English',
          'Para transmitir una petición, usa ask + persona + to + infinitivo. Una petición negativa se construye con not to.',
          '“Please don’t close the door.” → She asked me not to close the door.',
          'Tell someone to indica que alguien dio una instrucción. Ask someone to presenta la misma acción como petición.',
          '“Could you send me the timetable?” Which report keeps the meaning?', ['He asked me to send him the timetable.','He asked me if he could send the timetable.','He asked the timetable to send me.'],0,
          'El destinatario de la petición es me. Him corresponde a la persona que pidió el horario.', 'b2-radio'),
        lesson('b2-reading-reference','A qué se refiere cada palabra','Reading',
          'Localiza el antecedente de this, these, it y they. Una palabra como this también puede resumir toda una acción anterior.',
          'The team moved the exhibition indoors. This allowed it to stay open despite the storm.',
          'Comprueba número y sentido. El sustantivo más cercano no siempre encaja.',
          '“The volunteers recorded the interviews. These were later edited.” What does “these” refer to?', ['The volunteers','The interviews','The edits'],1,
          'Las entrevistas son el elemento plural que se puede editar en este contexto.', 'b2-museum'),
        lesson('b2-speaking-compare','Compara antes de elegir','Speaking',
          'Organiza la comparación alrededor de un criterio útil. Después, elige una opción y explica para quién es mejor.',
          'Both activities are outdoors, but the guided walk is easier for a group that doesn’t know the area.',
          'Evita describir cada opción por separado sin explicar en qué se parecen o se diferencian.',
          'Which answer compares both options before making a choice?', ['The coach trip sounds good.','There is a coach trip and there is a bike tour.','Both visits cover the old town, but I’d choose the coach trip for anyone who cannot cycle.'],2,
          'La frase compara el itinerario y justifica la elección con una necesidad concreta.', 'b2-travel')
      ],
      missions: [
        mission('b2-radio','Radio en directo','Use of English','Ordena los avisos de la redacción y prepara el boletín del festival.','dispatch','route-editor-v1.webp',[
          decision('Parte de ayer','The opening concert took place yesterday. Which line goes into the report?', ['The concert has opened yesterday.','The concert opened yesterday.','The concert has been opening yesterday.'],1,'Yesterday pide past simple para una acción terminada.'),
          decision('Última hora','The morning festival is still running. Update the number of visitors so far.', ['We welcomed 300 people last Saturday.','We are welcoming 300 people tomorrow.','We’ve welcomed 300 people so far.'],2,'So far conecta el total con el momento actual.'),
          decision('Aviso de producción','The producer told Alex, “Please check the microphone.” Report her request.', ['She asked Alex to check the microphone.','She asked the microphone to check Alex.','She asked whether Alex had checked the microphone.'],0,'Ask + persona + to conserva la acción solicitada.'),
          decision('Mensaje al público','A volunteer said, “Please don’t use the side entrance.” Pass on the request.', ['The volunteer asked visitors not to use the side entrance.','The volunteer asked whether visitors used the side entrance.','The volunteer asked visitors to use the side entrance.'],0,'Not to mantiene la petición en negativo.')
        ],[2]),
        mission('b2-museum','El mapa del museo','Reading','Sigue las referencias de tres pistas para recuperar la pieza que falta en la exposición.','evidence','route-archive-v1.webp',[
          decision('Inventario','Two lanterns were found beside a painting. They were sent to the workshop. What was sent?', ['The painting','The lanterns','The workshop tools'],1,'They concuerda con lanterns, el elemento plural de la primera oración.'),
          decision('Cambio de sala','The team moved the textiles away from the window. This protected them from bright sunlight. What does “this” refer to?', ['The sunlight','The window','Moving the textiles'],2,'This resume la acción anterior. Them se refiere a los tejidos.'),
          decision('Última pista','The key was placed under the sign by the east stairs. It opens the display case. Which object do you need?', ['The key','The sign','The display case'],0,'Por significado, el objeto que abre la vitrina es la llave.')
        ]),
        mission('b2-travel','El mostrador de viajes','Speaking','Ayuda a tres viajeros a elegir con comparaciones claras y recomendaciones útiles.','dispatch','last-train-station-v1.webp',[
          decision('Viaje económico','Both trains arrive before noon. The express costs £18 and the local costs £10. The traveller wants the cheaper option.', ['The express is faster, so it is cheaper.','Both arrive in time, but the local train costs less.','Both trains cost the same.'],1,'Compara el requisito común y explica el criterio que decide: el precio.'),
          decision('Plan con lluvia','A walking tour and an indoor market are free. A visitor wants to stay dry. Which recommendation compares both?', ['The market is better because both options are free and only the market is indoors.','Walking in the rain is always more expensive.','The market is free, so the walking tour must cost money.'],0,'La recomendación reconoce que ambos son gratis y distingue cuál está cubierto.'),
          decision('Ruta accesible','Your friend suggests the hill walk. A traveller needs a step-free route. Which reply keeps the conversation going?', ['The hill walk is the only option.','No, that’s a bad idea.','The view sounds great. Does the riverside route have fewer steps?'],2,'Reconoce la propuesta y pregunta por el criterio de accesibilidad.')
        ])
      ],
      topics: {
        'B2 Use of English · Time and meaning': ['Finished and unfinished time expressions','Narrating an interruption with past tenses','Reporting negative requests','Would rather and would prefer','Articles with public places','Phrasal verbs for travel arrangements'],
        'B2 Reading · Guides and notices': ['Tracing pronouns in museum guides','Following a change of plan in notices'],
        'B2 Writing · Everyday experiences': ['Writing a review with a specific audience','Writing an article with a memorable opening'],
        'B2 Speaking · Comparing choices': ['Comparing two activities by cost and access','Giving polite reasons for a recommendation']
      },
      speaking: [
        {id:'b2-travel-plans',title:'Un día para explorar',prompt:'Compare a guided walking tour and a day using public transport. Which would you suggest to a family visiting your city for the first time?',steps:['Choose two points of comparison.','Give a reason connected to the family.','Finish with a clear recommendation.']},
        {id:'b2-weekend-work',title:'El primer trabajo',prompt:'Compare working in a café and helping at a sports centre. Which part-time job would suit a student with limited free time?',steps:['Compare the likely hours.','Mention a skill each job could develop.','Explain your choice.']},
        {id:'b2-community-festival',title:'Un festival para todos',prompt:'A neighbourhood can organise a film night or a food festival. Which is more likely to bring different age groups together?',steps:['Describe one attraction of each event.','Consider a problem the organisers could solve.','Recommend an option.']}
      ],
      listening: {
        id:'b2-festival-brief',title:'A change at the festival',focus:'Distingue lo que cambia de lo que sigue igual.',
        transcript:'Good morning, volunteers. A quick update about Saturday’s festival. We had planned to open the main gate at ten, but the builders need another half hour to finish the ramp. Visitors should use the side gate until ten thirty. The book swap will still start at eleven, although we have moved it from the courtyard to the upstairs room. If a visitor needs step-free access, please show them the lift near the café. Finally, please leave the blue badges on the information desk. The yellow ones are for volunteers, so pick one up when you arrive.',
        questions:[
          decision('Entrada','Where should visitors go if they arrive at ten fifteen?', ['To the main gate','To the side gate','Straight to the café'],1,'La entrada lateral se utiliza hasta las diez y media.'),
          decision('Intercambio','What has changed about the book swap?', ['Its starting time','The items people can bring','Its location'],2,'Sigue empezando a las once, pero se traslada a una sala de la planta superior.'),
          decision('Identificación','What should a volunteer collect on arrival?', ['A yellow badge','A blue badge','A ramp key'],0,'Los distintivos amarillos son los de voluntariado.')
        ]
      },
      writing: {
        essay:['Préstamo de material','Your class has discussed whether schools should lend equipment instead of asking students to buy it. Write an essay about cost and responsibility. Include one idea of your own and give your opinion.'],
        article:['Aprender un oficio','A youth magazine asks for an article about a practical skill you learned outside school. Explain how you learned it and give advice to someone who wants to try it.'],
        email:['Visita de intercambio','Your exchange partner wants to try a local activity and is worried about getting around alone. Write an email proposing an activity, explaining how to get there and offering practical help.'],
        report:['Un espacio de estudio','Your community centre has asked for a report on its new study area. Describe how it is used, explain two difficulties and recommend a realistic improvement.'],
        review:['Un lugar para repetir','A travel site wants a review of a small museum or gallery. Describe what you saw, evaluate the visit and explain who would enjoy it most.']
      }
    },
    'C1 Advanced': {
      lessons: [
        lesson('c1-cross-text','Contrasta la postura de dos autores','Reading',
          'Para cada texto, resume qué defiende el autor y con qué condición. Contrasta ese punto concreto antes de emparejar posturas.',
          'A supports expanding the pilot if costs stay low. B supports expansion even if costs rise. Both support expansion, for different reasons.',
          'Dos autores pueden hablar del mismo tema y discrepar sobre su prioridad.',
          'A: “The trial should continue, provided it remains voluntary.” B: “Compulsory enrolment would undermine the trial.” What do they agree on?', ['The trial must expand.','Participation should remain a choice.','The trial has already succeeded.'],1,
          'Provided it remains voluntary y la objeción a compulsory enrolment señalan la misma condición.', 'c1-press-room'),
        lesson('c1-gapped-cohesion','Reconstruye el hilo de un texto','Reading',
          'Lee antes y después del hueco. Comprueba qué elemento recupera el párrafo candidato y qué idea deja preparada.',
          'The council published two plans. The cheaper of the two covered only weekends. That limitation proved decisive.',
          'Un conector que suena bien puede ocultar que falta el referente de this, both o such.',
          '“The library had two entrances. […] This second option was easier for wheelchair users.” Which sentence fits?', ['The shelves were unusually tall.','The main entrance was the only route inside.','Visitors could use the front steps or take a ramp at the side.'],2,
          'La frase presenta dos opciones y deja la rampa como el referente de this second option.', 'c1-press-room'),
        lesson('c1-register-reports','Distingue observación y recomendación','Writing',
          'Describe primero qué observaste. En la recomendación, indica quién debería actuar, qué cambiar y por qué.',
          'Participants waited up to 25 minutes. The organisers should stagger arrival times to reduce the queue.',
          'Una recomendación que promete eliminar todo problema necesita pruebas. Ajusta el alcance a lo que sabes.',
          'Which recommendation is precise and supported by a queue at opening time?', ['The organisers should trial timed entry at opening to spread arrivals.','The event must be cancelled permanently.','Queues should become better somehow.'],0,
          'Identifica a los organizadores, propone una medida concreta y la conecta con lo observado.', 'c1-commission'),
        lesson('c1-emphasis-clefts','Cambia el énfasis sin cambiar el hecho','Use of English',
          'Usa It was … that para destacar una persona, causa o circunstancia. Con What … was puedes destacar una acción o un elemento.',
          'The timing caused the problem. → It was the timing that caused the problem.',
          'Conserva el tiempo verbal y los papeles de cada elemento al reformular.',
          'Reformulate “A delay in delivery caused the cancellation” to emphasise the cause.', ['What the cancellation caused was a delay.','It was a delay in delivery that caused the cancellation.','It was the cancellation that caused the delay in delivery.'],1,
          'La estructura destaca la demora y mantiene la dirección causa → cancelación.', 'c1-copy-desk')
      ],
      missions: [
        mission('c1-press-room','La sala de corresponsales','Reading','Compara despachos de dos periodistas y reconstruye el artículo antes del cierre.','evidence','route-research-v1.webp',[
          decision('Punto común','A: “Longer opening hours may work if the budget stays stable.” B: “I would extend opening hours even if it costs more.” What do they share?', ['Support for a possible extension','A refusal to consider extra spending','Confidence that the budget will stay stable'],0,'Ambos apoyan ampliar horarios. Difieren en la condición presupuestaria.'),
          decision('Desacuerdo','A: “More tickets were issued, but the trial period included a public holiday.” B: “The increase alone justifies making the change permanent.” Where do they differ?', ['Whether ticket sales were measured','Whether the increase is enough evidence for a permanent change','Whether the trial concerned public transport'],1,'A advierte de un factor concurrente. B considera suficiente el aumento.'),
          decision('Párrafo perdido','“Three libraries joined the scheme. […] The remaining branch opened in September.” Choose the missing line.', ['All three began operating in July.','A separate scheme was proposed for next year.','Two of them began operating in July.'],2,'Two of them deja una tercera sucursal como referente de the remaining branch.'),
          decision('Cierre editorial','“Demand rose at weekends. […] This distinction matters when allocating staff.” Which line prepares the last sentence?', ['Weekday demand, by contrast, barely changed.','Demand rose, and that is all the data show.','The staff wore new uniforms during the trial.'],0,'El contraste entre demanda de fin de semana y entre semana da sentido a this distinction.')
        ],[2]),
        mission('c1-commission','Comisión de mejoras','Writing','Lee los testimonios y arma una recomendación que se pueda llevar a cabo.','evidence','route-mailroom-v1.webp',[
          decision('Acta de observación','A trial counted 19 complaints about the online booking page. No ratings of the event were collected. File the finding.', ['The whole event was rated poorly.','Nineteen complaints concerned the booking page.','Most visitors disliked the event.'],1,'Las quejas describen una parte del servicio. No hay valoraciones del evento completo.'),
          decision('Propuesta de prueba','Several users could not find the confirmation button. Which intervention addresses this problem directly?', ['Replace the venue next year.','Extend the event by two hours.','Move the button next to the booking summary and test it with new users.'],2,'La intervención cambia el punto que causó dificultad y comprueba si funciona.'),
          decision('Cómo medir','The trial lasts one month. What would show whether the booking change helped?', ['Compare successful bookings and requests for help before and during the trial.','Ask the designer whether the button looks better.','Count only people who never used the page.'],0,'Las reservas completadas y las peticiones de ayuda miden el problema que se quiere resolver.')
        ]),
        mission('c1-copy-desk','La mesa de edición','Use of English','Ajusta el énfasis de tres titulares sin intercambiar sujetos, causas ni fechas.','editorial','route-press-v1.webp',[
          decision('Destaca el lugar','“The delegates met in Leeds, not in York.” Which version emphasises the correct place?', ['It was York where the delegates met.','It was in Leeds that the delegates met.','It was the delegates that Leeds met.'],1,'In Leeds mantiene el lugar y lo coloca en posición de énfasis.'),
          decision('Destaca la acción','“The researchers compared the original recordings.” Which version stresses what they did?', ['What the original recordings did was compare the researchers.','What the researchers did was compare the original recordings.','It was the comparison that recorded the researchers.'],1,'What the researchers did prepara la acción, conservando sujeto y objeto.'),
          decision('Destaca el momento','“The review started after the second complaint.” Keep the same timing.', ['It was after the second complaint that the review started.','It was the second complaint that the review started.','It was before the second complaint that the review started.'],0,'La expresión completa after the second complaint conserva la relación temporal.')
        ])
      ],
      topics: {
        'C1 Reading · Evidence and cohesion': ['Comparing agreement across short editorials','Distinguishing reservations from objections','Reconstructing a paragraph with backward references','Tracking a shift in narrative viewpoint','Finding the scope of a qualified claim','Matching recommendations to survey evidence'],
        'C1 Writing · Professional communication': ['Prioritising recommendations in a proposal','Building a report around evaluation criteria','Balancing a review for a specialist audience'],
        'C1 Speaking · Discussion strategies': ['Inviting disagreement during a discussion','Delivering a qualified recommendation aloud'],
        'C1 Use of English · Emphasis': ['Emphasising information with cleft sentences']
      },
      speaking: [
        {id:'c1-shared-spaces',title:'Espacios compartidos',prompt:'A council must choose between a quiet study centre and a shared workshop. Compare the wider benefits and recommend which should open first.',steps:['Compare needs rather than listing features.','Acknowledge who might lose out.','Justify a priority.']},
        {id:'c1-digital-access',title:'Acceso digital',prompt:'Should public services become digital by default? Compare convenience, cost and access for people with limited technology.',steps:['Explain a benefit and a drawback.','Give an example of a group that may need support.','Reach a qualified recommendation.']},
        {id:'c1-workplace-learning',title:'Formación en el trabajo',prompt:'A company wants to improve learning at work. Assess staff mentoring and funded external courses, then decide which to trial first.',steps:['Compare impact and practical constraints.','Explain one way to evaluate each option.','Recommend a trial with a condition.']}
      ],
      listening: {
        id:'c1-library-brief',title:'The library on trial',focus:'Identifica reservas y separa asistencia de impacto.',
        transcript:'When our library extended its opening hours, we expected the extra time to attract people who could not visit during the day. Evening attendance certainly rose, but many of the people we spoke to were regular visitors who had simply changed when they came. That does not make the trial a failure. The later hours gave those readers more flexibility. Still, if reaching new users is the goal, head counts alone will tell us very little. Next month I would keep one late evening, ask first-time visitors what brought them in, and compare their answers with feedback from people who use the library at other times.',
        questions:[
          decision('Expectativa','What was the original aim of the trial?', ['To reach people unable to visit during the day','To reduce total weekly staffing hours','To move all existing users to evening slots'],0,'La apertura extra pretendía llegar a quienes no podían acudir de día.'),
          decision('Reserva','Why does the speaker question the rise in evening attendance?', ['The counts were collected at the wrong library.','Some regular users had simply switched times.','Nobody was asked for feedback.'],1,'La subida puede reflejar un cambio de horario entre usuarios habituales.'),
          decision('Propuesta','What does the speaker want to do next?', ['Keep every late evening permanently.','Stop the trial and measure weekend visits.','Keep one late evening and ask first-time visitors what prompted the visit.'],2,'Propone mantener una tarde y preguntar a nuevos usuarios por el motivo de su visita.')
        ]
      },
      writing: {
        essay:['Servicios digitales','Your class has discussed how public organisations can make services more accessible. Write an essay discussing two approaches: online self-service and staffed help desks. Explain which deserves greater investment and why.'],
        proposal:['Biblioteca compartida','A local library wants to attract people who rarely use it. Write a proposal for the director recommending two initiatives and explaining how their success could be assessed.'],
        email:['Un curso híbrido','Your course organiser has asked for feedback on a hybrid programme. Write an email evaluating the online and classroom sessions and recommending a change for the next group.'],
        report:['Intercambio de habilidades','A community organisation ran a skills exchange. Write a report assessing participation, explaining why some groups were less represented and recommending two changes.'],
        review:['Una exposición sonora','An arts website asks for a review of an audio exhibition. Evaluate how sound and space shaped your experience, and recommend it to a particular audience.']
      }
    },
    'C2 Proficiency': {
      lessons: [
        lesson('c2-implication','Lee la implicación detrás de la frase','Reading',
          'Separa lo afirmado de lo sugerido. Busca el contraste entre la valoración aparente y el contexto antes de atribuir una intención.',
          'The new help desk is certainly efficient at closing tickets. Whether it resolves them is another matter.',
          'La implicación depende del conjunto. Un adjetivo positivo puede preparar una objeción.',
          '“The report is admirably concise, although readers may wonder where the evidence went.” What is the main criticism?', ['The report is too long.','The evidence is hard to find or missing.','Readers disagree about the report’s conclusion.'],1,
          'La cortesía inicial no borra la crítica explícita a la falta de evidencia visible.', 'c2-review-panel'),
        lesson('c2-policy-synthesis','Sintetiza sin borrar el desacuerdo','Writing',
          'Identifica el criterio compartido y explica dónde discrepan las fuentes. Evalúa con una condición que indique cuándo pesa más cada argumento.',
          'Both authors value access. One favours remote provision for reach, while the other stresses in-person support for complex needs.',
          'Evita atribuir el juicio de un autor a ambos o presentar tu conclusión como si fuera un dato de las fuentes.',
          'A values evening courses for workers. B values daytime sessions for people with caring duties in the evening. Which synthesis is accurate?', ['Both prefer evening courses.','The authors disagree on whether teaching is worthwhile.','Both prioritise access, but each emphasises a different scheduling barrier.'],2,
          'El objetivo común es el acceso. La diferencia está en la barrera horaria de cada grupo.', 'c2-review-panel'),
        lesson('c2-verb-precision','Elige el verbo que mide bien la evidencia','Use of English',
          'Distingue corroborate (aportar apoyo independiente), substantiate (respaldar con pruebas) y refute (demostrar que algo es falso).',
          'The records corroborate her account, but they do not establish who authorised the payment.',
          'Refute no equivale simplemente a disagree with. Implica demostrar que la afirmación no se sostiene.',
          'A second independent dataset supports the first team’s observation. Which verb fits?', ['corroborates','precludes','refutes'],0,
          'La segunda fuente da apoyo independiente a la misma observación.', 'c2-proof-lab'),
        lesson('c2-spoken-counterexample','Usa excepciones para afinar tu argumento','Speaking',
          'Presenta un contraejemplo y explica qué parte del argumento limita. Cierra reformulando tu postura para incorporar ese límite.',
          'Digital access lowers costs for many users. It can still exclude households with unreliable internet, so a parallel route is necessary.',
          'Una excepción puede refutar un siempre sin anular una tendencia general.',
          'Which reply responds to “Working remotely always saves time” with a relevant exception?', ['Remote working is a modern idea.','It can cut commuting, but technical failures may cost time for staff with unreliable connections.','Remote working never saves time.'],1,
          'Reconoce la ventaja general y presenta una condición que invalida el siempre.', 'c2-negotiation')
      ],
      missions: [
        mission('c2-review-panel','El comité de lectura','Reading · Writing','Detecta valoraciones implícitas y redacta una síntesis que respete el desacuerdo de las fuentes.','evidence','route-observatory-v1.webp',[
          decision('Elogio con reserva','“The manual is beautifully illustrated. A reader seeking instructions, however, may be less fortunate.” What does the reviewer imply?', ['The illustrations are unattractive.','The manual is weak at explaining what to do.','The reader needs expensive equipment.'],1,'La segunda frase cuestiona la utilidad del manual como guía, pese a elogiar su presentación.'),
          decision('Distancia editorial','“The archive describes the collection as complete, an assessment that may surprise anyone who has looked for the missing diaries.” What is the writer’s stance?', ['The writer endorses the claim of completeness.','The writer believes all the diaries were destroyed.','The writer questions the claim of completeness.'],2,'La referencia irónica a diarios ausentes cuestiona complete sin explicar por qué faltan.'),
          decision('Enfoques enfrentados','A praises digital access for remote readers. B values original objects because their scale is hard to reproduce. Choose the synthesis.', ['Both value access, but they emphasise different things readers gain from it.','Both see the digital catalogue as an adequate substitute in every case.','The authors disagree about whether the collection should exist.'],0,'La síntesis conserva el valor compartido y la diferencia entre alcance remoto y experiencia material.'),
          decision('Párrafo final','What recommendation follows from both views without assigning either author a new claim?', ['Close the physical collection because remote access is popular.','Keep both routes and assess which research needs each serves.','Require everyone to consult originals before using the catalogue.'],1,'La propuesta mantiene las dos ventajas y formula su evaluación como siguiente paso.')
        ],[2]),
        mission('c2-proof-lab','Laboratorio de pruebas','Use of English','Elige el verbo exacto y comprueba que cada versión diga solo lo que permiten los datos.','editorial','route-press-v1.webp',[
          decision('Confirmación independiente','A timestamped log independently supports a witness’s account. Which verb best describes its role?', ['precludes','corroborates','refutes'],1,'Corroborates describe apoyo independiente. No implica que cada detalle haya quedado probado.'),
          decision('Refutación','The proposal claims that every venue closed on Friday. Dated photographs show one venue open that day. Which verb fits?', ['The photographs substantiate the universal claim.','The photographs qualify the venue’s opening time.','The photographs refute the universal claim.'],2,'Un contraejemplo basta para refutar una afirmación universal.'),
          decision('Alcance','The report shows higher attendance, but cannot establish why it rose. Select the precise conclusion.', ['The figures document an increase without identifying its cause.','The figures rule out any effect of the new programme.','The figures establish that the new programme was responsible.'],0,'Documentar un cambio es distinto de explicar su causa.')
        ]),
        mission('c2-negotiation','La sala de negociación','Speaking','Responde a un comité, identifica una excepción y cierra el acuerdo con condiciones claras.','dispatch','route-debate-v1.webp',[
          decision('Intervención inicial','“A digital-only service will always be more accessible.” Which reply narrows the claim constructively?', ['A digital service is never useful.','It could reach more remote users, but accessibility also depends on connection quality and support.','Accessibility and reach are identical.'],1,'Reconoce la ventaja y delimita en qué condiciones se mantiene.'),
          decision('Contraejemplo','Which example challenges the word “always” while leaving the general benefit open?', ['Several users said the new logo was attractive.','Every service has a different budget.','Residents without reliable internet could access the old counter but cannot use the new portal.'],2,'El ejemplo muestra un grupo para el que el acceso empeora.'),
          decision('Acuerdo','What conclusion would reconcile reach with the access concern?', ['Launch the portal alongside an assisted route, then compare who can use each.','Make all services digital immediately and assume that access improves.','Close the portal before trying it with any users.'],0,'La propuesta incorpora ambas necesidades y permite comprobar resultados.')
        ])
      ],
      topics: {
        'C2 Reading · Inference and stance': ['Reading praise that introduces a criticism','Identifying ironic distance in reviews','Distinguishing an entailment from a plausible inference','Finding limits of generalisations across sources','Recognising assumptions in policy arguments','Comparing different uses of apparently similar evidence'],
        'C2 Writing · Synthesis and register': ['Combining two texts without losing their disagreement','Writing a report that separates impact and attribution','Revising register for a specialist committee'],
        'C2 Speaking · Precision in debate': ['Qualifying conclusions with an explicit scope','Integrating a counterexample in a spoken argument'],
        'C2 Use of English · Verbs of evidence': ['Using corroborate, substantiate and refute accurately']
      },
      speaking: [
        {id:'c2-public-evidence',title:'Quién decide qué es evidencia',prompt:'Should expert knowledge carry more weight than lived experience in public decisions? Explain when each can expose blind spots in the other.',steps:['Define what counts as evidence in your example.','Address a strong counterexample.','Offer a principle for weighing both forms.']},
        {id:'c2-silence-privacy',title:'Comodidad y privacidad',prompt:'To what extent is a loss of privacy an acceptable price for more personalised services?',steps:['Distinguish voluntary consent from a practical lack of choice.','Test your argument against a specific case.','Explain a condition under which the trade-off changes.']},
        {id:'c2-trust-translation',title:'Confianza en la traducción',prompt:'What do we gain and lose when automated translation becomes the default for public information?',steps:['Distinguish routine messages from sensitive ones.','Consider who bears the cost of an error.','Give a qualified policy recommendation.']}
      ],
      listening: {
        id:'c2-metrics-brief',title:'When a measure becomes a target',focus:'Distingue la tesis, la ironía y el límite de una conclusión.',
        transcript:'Our support team now closes more cases per hour. The dashboard is delighted, if dashboards can be delighted. Customers, however, sometimes have to call back about the very same problem. I would be reluctant to abandon measurement altogether. A short wait matters, especially when someone needs urgent help. What worries me is treating one convenient number as a verdict on the service. I would keep the speed measure, put it beside the rate of repeat calls, and read a sample of case notes. A quicker service may be an improvement, but only if the extra speed does not come at the expense of solving the problem.',
        questions:[
          decision('Ironía','What does the reference to a delighted dashboard imply?', ['The dashboard has stopped producing reliable numbers.','Positive figures may hide a less positive experience.','The team is deliberately falsifying case records.'],1,'La personificación contrasta el dato favorable con quienes tienen que volver a llamar.'),
          decision('Matiz','What role does the speaker give the speed measure?', ['It should be the sole measure for urgent cases.','It should be discarded wherever customers can call back.','It is worth keeping alongside evidence of resolution.'],2,'La rapidez importa, pero hay que contrastarla con llamadas repetidas y notas de casos.'),
          decision('Conclusión','When does the speaker regard greater speed as a possible improvement?', ['When it does not undermine actual resolution','When the number of closed cases is the only target','When staff record fewer notes, regardless of outcomes'],0,'La última oración condiciona la mejora a que el problema siga resolviéndose.')
        ]
      },
      writing: {
        essay:['Métricas y criterio','Text 1: Public services should publish clear performance indicators so citizens can compare providers. Text 2: When organisations chase indicators, hard-to-measure needs can be neglected. Summarise and evaluate the key points of both texts and develop your own view.'],
        article:['La atención como recurso','A cultural journal invites an article on whether modern tools have made focused attention easier to protect or harder to sustain. Develop a balanced argument for a general audience.'],
        email:['Traducción en servicios públicos','A public body is consulting on automated translation. Write a formal letter assessing its benefits and risks and recommending when a human review should be required.'],
        report:['Impacto de un archivo digital','A foundation asks you to evaluate a digital archive pilot. Write a report distinguishing direct evidence of access from claims of wider social impact, then recommend what should be measured next.'],
        review:['Un ensayo sobre el trabajo','A specialist magazine invites a review of a book about the future of work. Assess the author’s argument and evidence and identify the readers most likely to benefit from it.']
      }
    }
  };
})();
