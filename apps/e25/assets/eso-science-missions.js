/* Misiones de Ciencias y Tecnología: decisiones comprobables en contextos reales. */
(function (root) {
  'use strict';
  const S = (place, context, prompt, choices, correct, explanation) => ({place, context, prompt, choices, correct, explanation});
  const M = (title, place, symbol, art, brief, stages) => ({title, place, symbol, art, brief, stages});
  const missions = {
    'cie-metodo': M('La planta misteriosa','Laboratorio de preguntas','⚗','public-laboratorio-mezclas.webp','Diseña una prueba y saca una conclusión de los datos.',[
      S('Observación','Dos plantas iguales han crecido a distinta velocidad.','¿Qué constituye una observación?',['Una creció más que la otra','El fertilizante fue la causa segura','Todas crecerán igual mañana'],0,'Observar es describir lo que se ha visto, sin atribuir aún una causa.'),
      S('Hipótesis','Sospechas que la luz influye en el crecimiento.','¿Qué hipótesis se puede poner a prueba?',['Las plantas son bonitas','Con más horas de luz, esta especie crecerá más en estas condiciones','Nada puede medirse'],1,'Una hipótesis comprobable predice un efecto medible.'),
      S('Control','Preparas dos grupos de la misma especie.','¿Qué debe variar si quieres probar el efecto de la luz?',['Luz, agua y tierra a la vez','Solo el nombre de la maceta','Las horas de luz; mantener lo demás comparable'],2,'Controlar las demás variables permite atribuir mejor las diferencias a la luz.'),
      S('Conclusión','Tras dos semanas, el grupo con más luz crece 4 cm y el otro 2 cm.','¿Cuál es la conclusión prudente?',['En estas condiciones, más luz se asoció con mayor crecimiento','La luz explica cualquier planta en cualquier lugar','Los datos prueban que el agua no importa'],0,'La conclusión se limita al experimento realizado y a sus datos.')
    ]),
    'cie-biologia': M('La ruta del oxígeno','Atlas de la vida','♡','public-atlas-cuerpo.webp','Sigue el recorrido del oxígeno y protege la salud.',[
      S('Célula','Observas una muestra de tejido al microscopio.','¿Cuál es la unidad básica de los seres vivos?',['El órgano','La célula','El sistema'],1,'La célula es la unidad estructural y funcional básica de los seres vivos.'),
      S('Pulmón','Al inspirar entra aire en los pulmones.','¿Qué gas pasa a la sangre en el intercambio pulmonar?',['Oxígeno','Nitrógeno exclusivamente','Dióxido de carbono como producto de entrada principal'],0,'El oxígeno del aire pasa a la sangre en los pulmones.'),
      S('Transporte','La sangre lleva oxígeno desde los pulmones hasta los tejidos.','¿Qué sistema lo transporta?',['Digestivo','Óseo','Circulatorio'],2,'La sangre circula por el sistema circulatorio.'),
      S('Prevención','Quieres cuidar los sistemas respiratorio y circulatorio.','¿Qué hábito ayuda?',['Fumar para entrenar los pulmones','Actividad física adecuada y evitar el tabaco','Evitar toda ventilación'],1,'La actividad física y no fumar favorecen la salud respiratoria y cardiovascular.')
    ]),
    'cie-ecologia': M('El bosque en equilibrio','Reserva natural','♧','public-bosque-vivo.webp','Relaciona seres vivos y cambios en una red alimentaria.',[
      S('Productor','La hierba fabrica materia orgánica mediante fotosíntesis.','¿Qué papel tiene?',['Productor','Consumidor primario','Descomponedor'],0,'Los productores fabrican su propio alimento a partir de materia inorgánica.'),
      S('Consumidor','Un conejo se alimenta de hierba.','¿Qué papel tiene en esta cadena?',['Productor','Consumidor primario','Descomponedor'],1,'Come plantas, por lo que es consumidor primario.'),
      S('Descomposición','Los hongos degradan restos de organismos.','¿Qué papel desempeñan?',['Depredadores superiores','Productores','Descomponedores'],2,'Los descomponedores reciclan materia de restos orgánicos.'),
      S('Impacto','Disminuye mucho la población de conejos.','¿Qué respuesta es más rigurosa?',['Puede afectar a sus depredadores y a la vegetación','No afecta a ninguna otra especie','Todos los depredadores aumentarán seguro'],0,'Una red alimentaria conecta poblaciones; los efectos dependen del ecosistema.')
    ]),
    'cie-materia': M('El laboratorio de las mezclas','Mesa de química','⚗','public-laboratorio-atomo-scene.webp','Clasifica sustancias y reconoce cambios de materia.',[
      S('Mezcla','Disuelves sal en un vaso de agua.','¿Qué obtienes?',['Un elemento químico nuevo','Una mezcla homogénea','Una reacción nuclear'],1,'La sal disuelta forma una mezcla de composición uniforme a simple vista.'),
      S('Separación','Quieres recuperar la sal disuelta del agua.','¿Qué método sencillo puede servir?',['Evaporar el agua','Usar un imán','Filtrar la sal ya disuelta con papel'],0,'Al evaporarse el agua, la sal puede cristalizar.'),
      S('Cambio','Quemas un trozo de madera y aparecen cenizas y gases.','¿Qué tipo de cambio es?',['Solo un cambio de forma','Disolución reversible','Cambio químico'],2,'La combustión forma sustancias diferentes.'),
      S('Seguridad','Hay un recipiente sin etiqueta en el laboratorio.','¿Qué haces antes de tocarlo?',['Olerlo directamente','Pedir identificación y seguir las normas de seguridad','Mezclarlo con otro líquido'],1,'Una sustancia desconocida no se manipula sin identificarla y seguir instrucciones.')
    ]),
    'cie-fisica': M('El viaje de la bicicleta','Pista de movimiento','↗','public-centro-cinematica-scene.webp','Calcula velocidad e interpreta fuerzas y energía.',[
      S('Distancia','Una bicicleta recorre 12 km en 1 hora.','¿Cuál es su velocidad media?',['12 km/h','6 km/h','24 km/h'],0,'Velocidad media = distancia ÷ tiempo = 12 ÷ 1.'),
      S('Tiempo','Mantiene una media de 12 km/h durante media hora.','¿Qué distancia recorre?',['12 km','6 km','24 km'],1,'En 0,5 h recorre 12 × 0,5 = 6 km.'),
      S('Frenada','Aprietas los frenos y la bicicleta reduce su velocidad.','¿Qué fuerza se opone al movimiento en las superficies de frenado?',['Gravedad inversa','Electricidad estática','Rozamiento'],2,'El rozamiento en los frenos contribuye a reducir la velocidad.'),
      S('Unidad','Un ejercicio pide la energía consumida por un aparato.','¿Cuál de estas es una unidad de energía?',['Julio (J)','Kilómetro por hora (km/h)','Newton (N)'],0,'El julio es una unidad de energía; km/h mide velocidad y N fuerza.')
    ]),
    'cie-tecnologia': M('La hoja de cálculo útil','Taller digital','⌘','public-taller-circuitos.webp','Organiza datos sin perder seguridad.',[
      S('Datos','Una hoja contiene precios en A1 y A2.','¿Qué fórmula suma sus valores?',['A1+A2','=A1+A2','SUMA sin paréntesis ni referencias'],1,'En una hoja de cálculo la fórmula comienza por =.'),
      S('Copia','Arrastras una fórmula con referencias relativas a la fila siguiente.','¿Qué sucede normalmente?',['Las referencias se ajustan a la nueva fila','Se borra toda la hoja','Se convierte en una imagen'],0,'Las referencias relativas cambian con la posición de la fórmula.'),
      S('Compartir','La hoja contiene números de documento de terceros.','¿Qué debes hacer antes de publicar una copia?',['Publicarla abierta sin mirar','Enviar la contraseña de acceso junto al archivo','Retirar o proteger los datos personales'],2,'Compartir datos de terceros exige una base legítima y medidas de protección.'),
      S('Copia segura','Quieres evitar perder el archivo de trabajo.','¿Qué práctica es mejor?',['Guardarlo solo en una pestaña temporal','Mantener copia de seguridad y controlar accesos','Desactivar cualquier guardado'],1,'Las copias y permisos adecuados reducen riesgo de pérdida y exposición.')
    ]),
    'cie-tierra': M('El observatorio del planeta','Estación terrestre','◉','public-atlas-explorador.webp','Conecta rocas, atmósfera y riesgos naturales.',[
      S('Capa','El aire que rodea la Tierra forma una capa.','¿Cómo se llama?',['Atmósfera','Litosfera','Núcleo'],0,'La atmósfera es la envoltura gaseosa del planeta.'),
      S('Agua','El agua líquida se transforma en vapor por efecto del calor.','¿Cómo se llama este proceso?',['Condensación','Evaporación','Precipitación'],1,'La evaporación transforma agua líquida en vapor.'),
      S('Roca','Una roca fundida se enfría y solidifica.','¿Qué tipo de roca puede formarse?',['Sedimentaria por compactación','Metamórfica por presión','Ígnea o magmática'],2,'Las rocas ígneas se originan al solidificarse material fundido.'),
      S('Riesgo','Una zona presenta riesgo de inundación.','¿Qué medida preventiva es razonable?',['Consultar mapas de riesgo y planes de evacuación','Construir sin revisar el terreno','Ignorar las alertas'],0,'Conocer zonas inundables y planes de respuesta reduce la exposición.')
    ]),
    'cie-cuerpo': M('El recorrido de un almuerzo','Mapa del cuerpo','♡','public-atlas-cuerpo.webp','Relaciona aparatos y hábitos de salud.',[
      S('Digestión','Comes pan y fruta.','¿Qué aparato transforma los alimentos y absorbe nutrientes?',['Respiratorio','Digestivo','Nervioso'],1,'El aparato digestivo procesa los alimentos y absorbe nutrientes.'),
      S('Transporte','Los nutrientes deben llegar a las células.','¿Qué sistema los distribuye mediante la sangre?',['Circulatorio','Óseo','Reproductor'],0,'La sangre transporta nutrientes a los tejidos.'),
      S('Desechos','El organismo elimina parte de los desechos disueltos en la sangre mediante orina.','¿Qué órganos filtran la sangre para producirla?',['Pulmones','Músculos','Riñones'],2,'Los riñones filtran la sangre y producen orina.'),
      S('Hábitos','El cuerpo necesita energía, descanso y agua.','¿Qué combinación es más saludable?',['Saltarse siempre comidas','Alimentación variada, descanso y actividad física','Dormir solo dos horas por norma'],1,'Hábitos equilibrados favorecen el funcionamiento de distintos sistemas.')
    ]),
    'cie-laboratorio': M('El informe de los termómetros','Mesa de datos','▤','public-laboratorio-mezclas.webp','Lee una tabla experimental y evita conclusiones exageradas.',[
      S('Variable','Mides la temperatura de agua cada minuto mientras la calientas.','¿Cuál es la variable medida?',['Temperatura del agua','Color del cuaderno','Nombre del observador'],0,'La temperatura es el valor registrado en cada medición.'),
      S('Lectura','La tabla indica: minuto 0, 20 °C; minuto 2, 35 °C.','¿Cuánto aumentó?',['15 °C','35 °C','55 °C'],0,'35 − 20 = 15 °C.'),
      S('Gráfica','Representas tiempo en el eje horizontal y temperatura en el vertical.','¿Qué muestra una línea ascendente?',['Temperatura constante','Tiempo que disminuye','Temperatura que aumenta con el tiempo'],2,'La posición vertical aumenta conforme avanza el tiempo.'),
      S('Conclusión','Solo se hicieron mediciones durante 5 minutos.','¿Qué afirmación se sostiene mejor?',['El agua siempre se calentará igual en cualquier aparato','En esta prueba, la temperatura aumentó durante esos 5 minutos','Nunca habrá pérdidas de calor'],1,'La conclusión se limita a las condiciones y al intervalo medidos.')
    ]),
    'cie-sostenibilidad': M('La energía del centro','Sala de decisiones','☀','public-invernadero-cientifico.webp','Compara opciones y reduce consumo con datos.',[
      S('Fuente','El centro instala paneles solares.','¿De qué tipo es la energía solar?',['Renovable','Combustible fósil','Mineral no renovable'],0,'La radiación solar se repone de forma natural a escala humana.'),
      S('Consumo','Dos lámparas dan luz similar: A usa 10 W y B 60 W.','¿Cuál consume menos energía en el mismo tiempo?',['La B','La A','Consumen siempre igual'],1,'A igual tiempo, la de 10 W consume menos energía eléctrica.'),
      S('Residuos','Se cambian pilas agotadas del equipo.','¿Qué gestión es apropiada?',['Tirarlas al suelo','Mezclarlas con comida','Llevarlas a un punto de recogida'],2,'Las pilas requieren recogida adecuada por sus componentes.'),
      S('Balance','Analizas un plan de eficiencia del edificio.','¿Qué dato ayuda a evaluar si funcionó?',['Comparar consumos antes y después en condiciones semejantes','Solo la opinión de una persona','El color del contador'],0,'Comparar consumos medidos permite valorar el efecto del plan.')
    ]),
    'cie-digitalizacion': M('Protege tu cuenta','Centro de seguridad','🔒','public-taller-circuitos.webp','Decide qué hacer ante riesgos digitales reales.',[
      S('Contraseña','Tu contraseña es «123456» y la usas en varios sitios.','¿Qué mejora es más eficaz?',['Mantenerla','Crear una contraseña larga y única para cada servicio','Compartirla por mensaje'],1,'Una contraseña larga y única limita el riesgo si otro servicio sufre una filtración.'),
      S('Mensaje','Recibes un enlace urgente que pide iniciar sesión desde un remitente extraño.','¿Qué haces?',['Entrar desde la web oficial sin usar el enlace','Pulsar y dar la contraseña','Reenviarlo a todos'],0,'Abrir la web oficial por separado ayuda a evitar enlaces de suplantación.'),
      S('Verificación','El servicio ofrece verificación en dos pasos.','¿Qué aporta?',['Hace pública tu contraseña','Elimina toda posibilidad de fraude','Añade una barrera si alguien conoce tu clave'],2,'Un segundo factor dificulta el acceso con solo una contraseña robada.'),
      S('Permisos','Una app de linterna pide acceso a contactos sin justificarlo.','¿Qué decisión es más prudente?',['Conceder todos los permisos','Denegar el permiso innecesario o elegir otra app','Publicar tus contactos'],1,'Conviene limitar permisos a lo necesario para la función de la app.')
    ]),
    'cie-proyecto': M('Construye un soporte','Taller de prototipos','⚙','public-taller-circuitos.webp','Sigue un proceso de diseño que se pueda comprobar.',[
      S('Necesidad','Un teléfono se cae al usarlo como pantalla de consulta.','¿Cuál es el problema a resolver?',['Crear un soporte estable para el teléfono','Pintar el teléfono','Comprar más cables sin analizar nada'],0,'Definir la necesidad guía el diseño y la evaluación.'),
      S('Diseño','Tienes cartón, regla y tijeras.','¿Qué haces antes de cortar?',['Cortar al azar','Dibujar y medir un modelo sencillo','Pegar todo sin probar'],1,'Un boceto con medidas reduce errores y desperdicio.'),
      S('Prototipo','El primer soporte se inclina y el móvil resbala.','¿Qué dato indica mejor la causa?',['El nombre del fabricante','El color de la mesa','Ángulo de apoyo y estabilidad de la base'],2,'Medir el apoyo y comprobar la base ayuda a diagnosticar el fallo.'),
      S('Mejora','Refuerzas la base y el móvil ya queda estable.','¿Qué paso completa el proceso?',['Probarlo y registrar si cumple los requisitos','Declararlo perfecto sin pruebas','Ocultar el primer fallo'],0,'La prueba final confirma si la mejora resuelve la necesidad inicial.')
    ])
  };
  root.EsoScienceMissions = missions;
  if (typeof module !== 'undefined' && module.exports) module.exports = missions;
})(typeof window === 'undefined' ? globalThis : window);
