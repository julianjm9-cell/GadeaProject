/* Ampliaciones editoriales, en el mismo orden que el catálogo curricular. */
(() => {
  const catalogue = window.PROFESOR_TEMARIO;
  if (!catalogue) return;
  const add = (course, subject, rows) => {
    const topics = catalogue[course]?.[subject] || [];
    const notes = rows.trim().split('\n').map(line => line.trim());
    if (topics.length !== notes.length) throw Error(`Ampliaciones incompletas: ${course} / ${subject}`);
    topics.forEach((topic, index) => { topic.didactic.deepDive = notes[index]; });
  };

  add('1.º Primaria', 'Matemáticas', `En 47, el 4 no vale cuatro unidades: representa cuatro grupos de diez. Formar el número con bloques ayuda a verlo.
Antes de calcular, representa la cantidad inicial y decide si la historia añade, quita o compara objetos. Después escribe la operación.
Clasifica objetos reales por ser planos o tener volumen; girarlos permite reconocer sus caras sin depender solo de su dibujo.
El número obtenido debe llevar unidad. Medir dos veces con unidades diferentes explica por qué necesitamos acordar una misma referencia.
Un dibujo sencillo de la historia muestra qué cantidad se conoce y cuál falta; la respuesta debe volver a la pregunta original.`);
  add('1.º Primaria', 'Lengua', `Al dar palmadas por cada sílaba se perciben las partes de la palabra; después comprueba que no sobra ni falta ninguna letra.
Una lista de palabras no siempre comunica una idea. Comprueba quién hace algo y qué sucede antes de poner mayúscula y punto.
El protagonista, el lugar y el problema ayudan a reconstruir el cuento; no basta con recordar un detalle aislado.
Escoge rasgos que ayuden a identificar el objeto. Decir solo «bonito» aporta menos información que su forma o su uso.
Lee el mensaje como si fueras quien lo recibe: debe quedar claro quién escribe, qué ha cambiado y cuándo.`);
  add('1.º Primaria', 'Inglés', `Practica el saludo en un intercambio completo: una persona inicia la conversación y otra responde antes de despedirse.
Cuenta primero los objetos y luego coloca número, color y nombre en ese orden: «three red books».
Las palabras de familia se aprenden mejor con una foto o un dibujo y una frase que diga quién es cada persona.
Señala un objeto cercano y otro lejano para practicar «this» y «that» junto con el vocabulario del aula.
Une el gusto a un alimento u objeto concreto. Al negar, conserva «like» y añade «don't» antes del verbo.`);
  add('1.º Primaria', 'Ciencias Naturales', `Cada sentido recoge un tipo de información distinto; describe qué observas antes de nombrar el órgano que lo permite.
Una semilla puede parecer inerte, pero germina en condiciones adecuadas. Compara sus cambios con los de una piedra.
Las plantas también necesitan nutrientes del suelo. Observa cómo cambian si varían la luz y el agua, sin alterar ambas a la vez.
Los hábitos saludables funcionan juntos: dormir bien no sustituye al movimiento ni a una alimentación variada.
Elige un material por la propiedad que necesita el objeto: transparencia para una ventana, resistencia para una mesa.`);

  add('2.º Primaria', 'Matemáticas', `Compara centenas antes que decenas y unidades; al descomponer 528 se entiende por qué es mayor que 482.
Cuando hay diez unidades, se cambian por una decena. La llevada representa ese cambio y no una cifra añadida sin motivo.
La multiplicación sirve para grupos del mismo tamaño. Si los grupos son desiguales, primero hay que describirlos de otra manera.
Relaciona 60 minutos con una hora y 100 céntimos con un euro; expresar todo en la misma unidad evita errores.
Antes de responder, identifica si la pregunta pide el total, una categoría o la diferencia entre dos categorías.`);
  add('2.º Primaria', 'Lengua', `El artículo debe concordar en género y número con el sustantivo: «las montañas», no «la montañas».
Compara «yo juego» y «ellos juegan» para ver cómo cambia el verbo cuando cambia quién realiza la acción.
Lee la frase en voz alta: la entonación ayuda a decidir si corresponde punto, interrogación o exclamación.
Una idea principal sirve para casi todo el párrafo; un dato como un nombre o una cifra suele ser secundario.
El problema debe provocar una acción y el final resolverla o dejar una consecuencia clara; revisa que las tres partes se conecten.`);
  add('2.º Primaria', 'Inglés', `Usa una línea del día para ordenar «get up», «go to school» y «go to bed»; después describe tu propia rutina.
Agrupa los animales por hábitat o tamaño y escribe una frase sencilla sobre uno de ellos, no solo su traducción.
Mira si el nombre es singular o plural antes de elegir «is» o «are». Cuenta también los objetos en el dibujo.
Construye frases afirmativas y negativas sobre alimentos reales para practicar vocabulario y estructura a la vez.
La palabra interrogativa indica qué información falta: «what» pide una cosa y «where» un lugar.`);
  add('2.º Primaria', 'Ciencias Naturales', `Un ciclo no es una lista de etapas sin relación: cada fase procede de la anterior y prepara la siguiente.
Relaciona un ser vivo del parque con algo del medio que necesita, como luz, agua, refugio o alimento.
Al cambiar de estado, el agua sigue siendo agua. Señala qué ocurre al enfriarla y al calentarla.
Una máquina sencilla modifica la fuerza o la dirección del movimiento; observa la tarea antes y después de usarla.
Reducir evita crear residuos, reutilizar alarga la vida de un objeto y reciclar transforma materiales ya usados.`);

  add('3.º Primaria', 'Matemáticas', `La posición determina el valor: en 13 620, el 3 vale 3 000. Comprueba moviendo la cifra una columna.
Descomponer 23 × 4 en 20 × 4 y 3 × 4 hace visible la propiedad distributiva y facilita el cálculo mental.
La comprobación de un reparto exacto es divisor × cociente = total. Si sobra algo, nombra también el resto.
Las partes del todo deben ser iguales. Dibuja ocho porciones iguales antes de identificar 2/8 y simplificarlo.
El perímetro recorre el contorno completo; una figura distinta puede tener la misma superficie y otro perímetro.`);
  add('3.º Primaria', 'Lengua', `Una misma palabra puede cambiar de función según la oración; observa qué hace, nombra o describe en el contexto.
Localiza el verbo primero: ayuda a preguntar quién realiza la acción y a delimitar el resto de la oración.
Un sinónimo debe conservar el sentido en esa frase; «banco» de sentarse no equivale al de guardar dinero.
Resume con tus palabras quién hace qué y por qué es relevante; elimina ejemplos que no cambien la idea central.
Cada párrafo aporta una idea nueva. Elige «porque», «después» o «sin embargo» según la relación real entre las frases.`);
  add('3.º Primaria', 'Inglés', `Con «he» y «she» aparece normalmente -s en afirmativa; contrasta «I play» con «She plays».
«Can» mantiene la misma forma con todas las personas. Después de «can», el verbo va en su forma básica.
Asocia cada lugar con una actividad: «borrow books» apunta a «library» y «buy bread» a «bakery».
«Has got» describe rasgos o pertenencias; el adjetivo de color suele ir delante del nombre.
Subraya en el texto la frase que respalda cada respuesta. Si no aparece, no la presentes como un hecho.`);
  add('3.º Primaria', 'Ciencias Naturales', `La nutrición obtiene materia y energía; la relación permite responder al entorno; la reproducción origina nuevos individuos.
Una merienda equilibrada combina grupos de alimentos y agua. Compara opciones sin etiquetar un alimento aislado como «bueno» o «malo».
Un sólido conserva su forma, pero puede cambiarla si se rompe; distingue la forma propia del estado de la materia.
La sombra necesita una fuente de luz y un objeto que la bloquee. Cambia una distancia cada vez y observa el tamaño.
Las flechas de una cadena alimentaria muestran hacia dónde pasa la energía; empieza por el productor.`);

  add('4.º Primaria', 'Matemáticas', `Estima primero si el resultado estará cerca de tres mil o cinco mil; así detectas una cifra mal colocada.
En cada paso de la división, decide cuántas veces cabe el divisor y comprueba el resto antes de bajar otra cifra.
Multiplica o divide numerador y denominador por el mismo número. Si modificas solo uno, cambias el valor de la fracción.
Escribe 3,4 como 3,40 para comparar centésimas con 3,35; alinear la coma hace visible el orden.
El área cuenta cuadrados de una unidad por una unidad. Escribe cm², no cm, para no confundirla con una longitud.`);
  add('4.º Primaria', 'Lengua', `En «esa niña», «esa» acompaña al nombre; en «ella llegó», «ella» ocupa su lugar. Sustituye para comprobarlo.
Las marcas «ayer», «hoy» y «mañana» ayudan a situar la acción; después ajusta la forma verbal al sujeto.
Antes de poner la tilde, divide en sílabas e identifica cuál suena más fuerte. Luego aplica la regla adecuada.
El propósito del texto determina su estructura: informar, narrar o explicar pasos requiere organización diferente.
Revisa primero si las ideas se entienden; después corrige puntuación y ortografía. Leerlo en voz alta descubre frases demasiado largas.`);
  add('4.º Primaria', 'Inglés', `Con «he» o «she» usa «does» y deja el verbo principal en forma básica: «Does she play?».
«Was» acompaña a «I/he/she/it» y «were» a «you/we/they». Busca también la señal de pasado.
Los adjetivos cortos suelen añadir -er; los más largos suelen usar «more». Incluye «than» al comparar dos elementos.
Da instrucciones desde un punto de partida conocido; «turn left» no basta si no se sabe dónde girar.
Abre con una idea principal y añade detalles relacionados. Comprueba que las tres frases hablen del mismo lugar o asunto.`);
  add('4.º Primaria', 'Ciencias Naturales', `Los aparatos colaboran: el digestivo obtiene nutrientes y el circulatorio los reparte; el respiratorio aporta oxígeno.
El criterio de clasificación debe ser observable. Una mariposa no es vertebrada aunque vuele como algunas aves.
La filtración separa un sólido insoluble de un líquido; la evaporación ayuda a recuperar una sustancia disuelta.
Describe si el objeto empieza a moverse, frena o cambia de forma; esos efectos permiten reconocer la fuerza.
La rotación explica día y noche; la traslación dura aproximadamente un año. No atribuyas las estaciones a estar más cerca del Sol.`);

  add('5.º Primaria', 'Matemáticas', `Un múltiplo aparece en la tabla de un número; un divisor lo reparte exactamente. Compruébalo con una división sin resto.
Con igual denominador, las porciones tienen el mismo tamaño; por eso solo se suman los numeradores.
El 25 % equivale a un cuarto y el 50 % a la mitad. Aprovecha esas equivalencias antes de multiplicar.
Dibuja y anota unidades: borde en centímetros, interior en centímetros cuadrados. Un mismo lado participa en cálculos distintos.
La media puede no coincidir con ningún dato. Antes de calcular, revisa que todos los valores correspondan a la misma variable.`);
  add('5.º Primaria', 'Lengua', `Pregunta qué función desempeña cada palabra en la oración; «rápidamente» modifica cómo se realiza la acción.
En «Llegamos tarde», el verbo contiene la pista «nosotros». El sujeto puede estar omitido aunque la oración esté completa.
No pongas tildes por intuición visual: localiza la sílaba tónica y comprueba terminación y tipo de palabra.
Una exposición clara avanza de definición a características y ejemplo; cada párrafo debe responder una pregunta del lector.
Separa hecho de opinión. Una razón explica por qué sostienes la postura y el ejemplo la vuelve concreta.`);
  add('5.º Primaria', 'Inglés', `La terminación -ed marca pasado regular, pero la pronunciación cambia; distingue la escritura de cómo suena.
Aprende cada verbo irregular dentro de una frase con un marcador temporal, no como una pareja de palabras aisladas.
«Going to» presenta una intención previa. Incluye el verbo «be» adecuado antes de «going to».
«Water» no se cuenta por unidades sin un recipiente; contrasta «some water» con «some apples».
Una pista permite inferir, pero no demostrar con certeza. Explica qué frase del texto apoya tu deducción.`);
  add('5.º Primaria', 'Ciencias Naturales', `Las células especializadas se agrupan en tejidos; observa por qué una célula y un tejido no son la misma escala.
La digestión obtiene nutrientes, la respiración oxígeno y la circulación los distribuye. Sigue ese recorrido en un esquema.
Derretir hielo cambia su estado, no su sustancia. Contrástalo con un cambio que produce materiales nuevos.
Una bombilla necesita un camino cerrado entre los polos de la pila. Dibuja dónde se interrumpe si el interruptor abre.
La pérdida de una especie puede afectar a otras que dependen de ella; conecta alimento, refugio y reproducción.`);

  add('6.º Primaria', 'Matemáticas', `Dividir numerador entre denominador permite comparar una fracción con un decimal; el cociente puede ser exacto o periódico.
Construye una tabla de pares de valores y comprueba si al duplicar uno se duplica también el otro.
El porcentaje siempre se refiere a una base. Antes de calcular, subraya qué cantidad representa el 100 %.
Para el volumen cuenta cubos de unidad; no confundas cm³ con cm², que mide una superficie.
La probabilidad expresa casos favorables entre casos posibles cuando son equiprobables; la media resume datos, pero no su dispersión.`);
  add('6.º Primaria', 'Lengua', `Una oración puede tener sujeto expreso u omitido. La concordancia con el verbo ayuda a comprobar la identificación.
Antes de escribir, decide si informarás, narrarás o convencerás: cada intención exige un orden y recursos distintos.
Evita repetir el mismo nombre en cada frase; usa pronombres o sinónimos sin perder claridad sobre a quién se refiere.
Revisa la palabra dentro de su oración: el contexto ayuda a detectar tildes, homófonos y signos olvidados.
Un comentario explica qué dice el texto y cómo lo dice; apoya cada observación en una cita o dato concreto.`);
  add('6.º Primaria', 'Inglés', `Elige presente para hábitos y pasado para hechos terminados. Busca «every day» o «yesterday» antes de conjugar.
El superlativo destaca uno dentro de un grupo; el comparativo relaciona dos. Identifica cuántos elementos intervienen.
Tras «must», «should» o «can» va el verbo base. La elección expresa obligación, consejo o capacidad.
Una opinión resulta más clara cuando incluye una razón y un ejemplo: «I think… because… For example…».
Organiza el escrito con apertura, dos ideas conectadas y cierre. Revisa tiempo verbal y puntuación al final.`);
  add('6.º Primaria', 'Ciencias Naturales', `Células, tejidos, órganos y aparatos forman niveles de organización; cada nivel reúne elementos del anterior.
Explica los cambios de la pubertad con respeto y sin suponer que ocurren al mismo tiempo en todas las personas.
Una máquina cambia la fuerza necesaria o su dirección; compara el esfuerzo antes y después, no solo si el objeto se mueve.
El interruptor abre o cierra el circuito. Predice qué pasará con la bombilla y luego compruébalo con un esquema.
El tiempo describe condiciones de un día; el clima resume patrones a largo plazo. No uses un día frío para negar una tendencia.`);

  add('1.º ESO', 'Matemáticas', `Sitúa números negativos en una recta: estar más a la derecha significa ser mayor, aunque el valor absoluto sea menor.
Una potencia repite multiplicaciones de la misma base; la divisibilidad ayuda a descomponer y simplificar antes de calcular.
Convierte a una forma común antes de comparar. El decimal y la fracción representan el mismo valor, pero no siempre con igual comodidad.
Distingue el porcentaje del resultado final: aumentar un 20 % significa añadir una quinta parte de la cantidad inicial.
La letra representa un número que puede variar. Traduce la situación a una expresión antes de sustituir valores.
En geometría, identifica figura, datos y unidades; en estadística, observa también valores extremos antes de resumir con una media.`);
  add('1.º ESO', 'Lengua', `Para interpretar un mensaje, identifica emisor, destinatario, intención y canal; un mismo contenido cambia según la situación.
Clasifica por función y forma: un adjetivo describe un nombre, pero su posición y concordancia también aportan pistas.
Localiza el verbo conjugado y comprueba la concordancia con el sujeto; no confundas el sujeto con la primera palabra.
La narración organiza hechos en el tiempo; la descripción detiene la acción para mostrar rasgos seleccionados.
Separa la tesis o idea principal de ejemplos y detalles. Un resumen debe respetar el sentido sin copiar el texto entero.`);
  add('1.º ESO', 'Inglés', `Distingue rutina de acción presente: «I usually play» habla de hábitos, no de lo que ocurre justo ahora.
«Am/is/are + -ing» expresa una acción en curso. Comprueba que aparezcan ambos componentes y que el sujeto concuerde.
El pasado simple sitúa un hecho terminado. Los verbos irregulares cambian de forma y no reciben -ed.
En preguntas usa el auxiliar adecuado y deja el verbo principal en forma básica; la respuesta breve repite el auxiliar.
Busca primero la información explícita del texto y organiza el escrito con una idea por frase y conectores sencillos.`);
  add('1.º ESO', 'Ciencias Naturales', `Una hipótesis debe poder contrastarse; una observación aislada no demuestra por sí sola una explicación.
Compara tamaño y posición de los cuerpos del sistema solar usando escalas; un dibujo no suele mostrar distancias reales.
El agua circula entre atmósfera, superficie y subsuelo. Relaciona evaporación y condensación con cambios de estado.
La célula realiza funciones vitales; distintos organismos tienen una o muchas células organizadas de forma diferente.
Productores, consumidores y descomponedores se relacionan; sigue qué cambia si desaparece uno de ellos.`);
  add('1.º ESO', 'Geografía e Historia', `La latitud y la longitud ubican un punto; revisa hemisferio y signos antes de leer coordenadas en un mapa.
El clima reúne patrones de temperatura y precipitación; el relieve influye, pero no determina por sí solo todos los rasgos.
La Prehistoria se reconstruye con restos materiales. Distingue entre lo que muestra una fuente y lo que inferimos.
El crecimiento urbano se relaciona con agricultura, excedentes y organización política; evita atribuirlo a una sola causa.
Compara instituciones, sociedad y cultura de Grecia y Roma sin tratarlas como civilizaciones idénticas.`);

  add('2.º ESO', 'Matemáticas', `Todo entero es racional, pero no todo racional es entero. Sitúalos en la recta para comparar signos y magnitudes.
La raíz cuadrada pregunta qué número elevado al cuadrado produce la cantidad; estima antes de usar calculadora.
En una relación inversa, duplicar una magnitud reduce la otra a la mitad; compruébalo con una tabla de valores.
Reduce términos semejantes antes de sustituir números. «2x + 3x» se simplifica, pero «2x + 3» no.
Aplica la misma operación a ambos miembros y sustituye la solución en la ecuación inicial para verificarla.
Una función relaciona variables; en una gráfica, lee primero qué representa cada eje y sus unidades.`);
  add('2.º ESO', 'Lengua', `Un texto expositivo responde preguntas del lector con definiciones, clasificaciones y ejemplos; no lo organices como una narración.
El verbo es el núcleo del predicado; identifica después complementos por su función, no solo por su posición.
Modo, tiempo y persona aportan información distinta. Compara dos formas del mismo verbo para aislar cada cambio.
Una coma no sustituye cualquier pausa oral. Revisa la estructura sintáctica antes de decidir el signo.
Sitúa la obra en su contexto y observa un rasgo literario concreto; no reduzcas un periodo a una lista de autores.`);
  add('2.º ESO', 'Inglés', `El pasado continuo describe una acción en desarrollo; el simple puede interrumpirla o indicar un hecho terminado.
«Will» suele expresar decisión o predicción; «going to» puede indicar intención previa o evidencia presente.
Un comparativo relaciona dos elementos; un superlativo selecciona uno de un grupo. Comprueba «than» y «the».
«Must», «should» y «might» cambian el grado de obligación, consejo o posibilidad; después usa verbo base.
Una opinión necesita tesis, razón y ejemplo. Contrasta una postura alternativa sin perder el hilo del párrafo.`);
  add('2.º ESO', 'Física y Química', `Toda medida combina número, unidad e incertidumbre razonable. Repite la observación si el resultado parece anómalo.
En un cambio de estado, la sustancia conserva su identidad; separa ese fenómeno de una reacción química.
La concentración compara soluto y disolvente. Disolver no hace desaparecer la materia, aunque deje de verse.
El número atómico identifica un elemento por sus protones; átomos de elementos distintos no son intercambiables.
Movimiento depende del sistema de referencia. Para describir una fuerza, indica sobre qué cuerpo actúa y en qué dirección.`);
  add('2.º ESO', 'Geografía e Historia', `Compara natalidad, mortalidad y migración para explicar cambios de población; cada indicador aporta una causa distinta.
Un espacio urbano concentra funciones y población, pero también depende del territorio rural para recursos y alimentos.
La Edad Media abarca siglos y territorios diversos; sitúa cada acontecimiento antes de generalizar.
Estudia contactos, conflictos e intercambios culturales entre Al-Ándalus y reinos cristianos sin presentarlos como mundos aislados.
Relaciona expansión marítima, cambios económicos y nuevas ideas; distingue causas de consecuencias de la Edad Moderna.`);

  add('3.º ESO', 'Matemáticas', `Compara primero los signos y después el valor absoluto. En productos y cocientes, separa el cálculo numérico de la regla de signos.
Convierte las fracciones a denominador común o a decimal según el problema; en porcentajes identifica siempre la cantidad base.
Una ecuación expresa una igualdad que debe conservarse en cada paso. Verifica sustituyendo el valor hallado en ambos miembros.
En proporción directa la razón es constante; en inversa lo es el producto. Haz una tabla antes de elegir procedimiento.
Un dibujo con medidas y unidades permite distinguir perímetro, área y volumen antes de aplicar fórmulas.
La media resume, pero los extremos pueden distorsionarla. En probabilidad, define primero el espacio de casos posibles.`);
  add('3.º ESO', 'Lengua', `La estructura de un texto organiza ideas: identifica introducción, desarrollo y cierre por su función, no solo por su posición.
Un sintagma tiene núcleo y posibles complementos; separa grupos de palabras antes de analizar la oración completa.
La coordinación une elementos del mismo nivel; la subordinación integra uno dentro de otro. Usa el verbo como pista.
Una tesis defendible necesita argumentos verificables y ejemplos pertinentes; evita presentar una preferencia como hecho demostrado.
Relaciona rasgos del Siglo de Oro con un fragmento concreto: tema, recursos y voz importan más que memorizar fechas.`);
  add('3.º ESO', 'Inglés', `«I have visited» conecta una experiencia con el presente; «I visited in 2022» sitúa el hecho en un pasado cerrado.
El condicional cero expresa regularidades; el primero, una posibilidad futura real. Identifica la relación entre condición y resultado.
En pasiva, el objeto de la activa pasa a sujeto; ajusta «be» al tiempo y conserva el participio pasado.
Separa lo que el texto afirma de lo que sugiere. Justifica cada inferencia con una pista localizable.
Presenta postura, razón y ejemplo en párrafos conectados. Revisa que los conectores reflejen la relación lógica real.`);
  add('3.º ESO', 'Física y Química', `Número atómico y masa no significan lo mismo. Distingue protones, neutrones y electrones en un esquema.
Un compuesto tiene proporciones definidas entre elementos; una mezcla puede variar y separarse por métodos físicos.
Los átomos se reorganizan durante una reacción. Ajusta la ecuación sin cambiar las fórmulas de las sustancias.
Velocidad relaciona distancia y tiempo; una gráfica permite ver reposo, aceleración o cambio de sentido.
La energía se transforma y transfiere; identifica fuente, receptor y pérdidas antes de interpretar un circuito.`);
  add('3.º ESO', 'Geografía e Historia', `Los cambios demográficos combinan nacimientos, muertes y movimientos migratorios; compara tasas y distribución territorial.
Los sectores económicos dependen unos de otros: una actividad primaria puede alimentar industrias y servicios.
La globalización conecta mercados y personas, pero sus efectos no son iguales en todos los lugares.
Un indicador como renta media no describe por completo bienestar; contrástalo con educación, salud y desigualdad.
Compara escalas local, estatal y europea al estudiar el territorio; una decisión puede afectar a varias escalas.`);
  add('3.º ESO', 'Ciencias Naturales', `Células especializadas forman tejidos, órganos y aparatos; observa qué función gana cada nivel de organización.
La salud depende de hábitos y condiciones del entorno. Relaciona nutrientes con funciones, sin equiparar dieta a restricción.
Los receptores captan estímulos, el sistema nervioso procesa información y los efectores producen respuestas.
Explica la reproducción con lenguaje científico y respeto por la diversidad; distingue fecundación, desarrollo y nacimiento.
La sostenibilidad implica conservar relaciones del ecosistema y reducir impactos; evalúa efectos a corto y largo plazo.`);

  add('4.º ESO', 'Matemáticas', `Los radicales y potencias representan números reales; simplifica solo cuando las propiedades se aplican a toda la expresión.
Factorizar transforma una suma en producto. Comprueba expandiendo los factores para recuperar el polinomio original.
En sistemas, la solución debe satisfacer ambas ecuaciones; una igualdad correcta en una sola no basta.
Relaciona tabla, fórmula y gráfica. Dominio, cortes y crecimiento cuentan aspectos distintos de la función.
Seno, coseno y tangente relacionan lados de un triángulo rectángulo; identifica el ángulo de referencia primero.
En sucesos encadenados, revisa si el primer resultado cambia las opciones del segundo antes de multiplicar probabilidades.`);
  add('4.º ESO', 'Lengua', `Distingue proposiciones coordinadas de subordinadas observando si una depende sintácticamente de la otra.
La coherencia conecta ideas globales; la cohesión utiliza referencias, conectores y repeticiones controladas dentro del texto.
Evalúa fuente, dato y razonamiento por separado. Un argumento persuasivo puede apoyarse en una evidencia débil.
Relaciona contexto del siglo XIX con un fragmento: narrador, conflicto social y estilo ofrecen pruebas concretas.
Comenta contenido y forma juntos: explica cómo una elección lingüística contribuye al efecto del texto.`);
  add('4.º ESO', 'Inglés', `Compara condiciones reales, hipotéticas e imposibles observando el tiempo verbal en cada cláusula y la consecuencia.
Al pasar a estilo indirecto, revisa pronombres, referencias temporales y posibles cambios de tiempo verbal.
Una oración de relativo aporta información sobre un nombre; decide si es esencial o aclaratoria antes de puntuar.
En pasiva interesa la acción y su resultado; la causativa indica que alguien encarga una acción a otra persona.
Adapta registro, estructura y tono al destinatario: un correo formal no se organiza como un mensaje a un amigo.`);
  add('4.º ESO', 'Física y Química', `La pendiente de posición-tiempo representa velocidad; la de velocidad-tiempo, aceleración. Lee ejes antes de interpretar.
Una fuerza neta no nula cambia el movimiento. Dibuja todas las fuerzas sobre el mismo cuerpo antes de sumarlas.
Trabajo y energía tienen unidades comunes, pero no son conceptos idénticos. Identifica transferencia y transformación.
La fórmula química expresa proporciones de átomos; el tipo de enlace ayuda a explicar propiedades observables.
Ajustar conserva átomos; la proporción de coeficientes permite calcular cantidades, siempre tras comprobar las unidades.`);
  add('4.º ESO', 'Geografía e Historia', `La Ilustración cuestionó el poder absoluto; compara ideas, grupos implicados y resultados de distintas revoluciones.
La industrialización modificó producción, ciudades y trabajo. Distingue innovación técnica de consecuencia social.
Ordena causas inmediatas y profundas de los conflictos mundiales; compara también sus efectos sobre la población civil.
Sitúa la transición española entre dictadura y democracia con instituciones, acuerdos y tensiones concretas.
Para interpretar el mundo actual, contrasta fuentes y separa proceso histórico de noticia o opinión reciente.`);

  add('1.º Bachillerato', 'Matemáticas', `Los complejos amplían los reales para resolver ecuaciones sin solución real. Comprueba en qué conjunto trabajas antes de operar.
Un sistema puede tener una, ninguna o infinitas soluciones; interpreta qué significa cada caso, además de resolverlo.
El límite describe comportamiento cerca de un punto; no lo confundas siempre con el valor de la función en ese punto.
La derivada mide cambio instantáneo y pendiente local. Relaciona su signo con crecimiento antes de usar reglas mecánicas.
Describe la distribución además de calcular su media: dispersión y sucesos condicionados pueden cambiar la interpretación.`);
  add('1.º Bachillerato', 'Lengua', `Una variedad lingüística depende de región, grupo y situación. Describe rasgos observables sin jerarquizar hablantes.
Analiza la función de cada sintagma dentro de la oración y justifica la etiqueta con una prueba sintáctica.
Un comentario sólido interpreta tesis, estructura y recursos expresivos con citas breves, no resume todo el fragmento.
En un ensayo, cada párrafo desarrolla un argumento y anticipa posibles objeciones sin abandonar la tesis.
Relaciona movimientos literarios con rasgos textuales y contexto; evita atribuir una época solo por el nombre del autor.`);
  add('1.º Bachillerato', 'Inglés', `Elige entre tiempos perfectos, simples y continuos según secuencia, duración y relevancia presente; identifica marcadores temporales.
«Wish» expresa una realidad deseada distinta de la actual o pasada; revisa el tiempo verbal y la distancia hipotética.
En pasiva y estilo indirecto cambian el foco o la voz; conserva el significado y ajusta referencias y tiempos.
En textos complejos, distingue argumento, apoyo y matices del autor. Una inferencia requiere más de una palabra aislada.
Construye una tesis clara, dos argumentos desarrollados y un cierre; varía conectores solo cuando indiquen relaciones precisas.`);
  add('1.º Bachillerato', 'Física y Química', `Elige un sistema de referencia y mantén coherentes signos y unidades; separa posición, desplazamiento, velocidad y aceleración.
Un diagrama de fuerzas define qué interacciones actúan. Aplica la segunda ley a la fuerza resultante, no a cada fuerza por separado.
Define el sistema antes de afirmar que se conserva la energía; registra transferencias y trabajo realizado.
La distribución electrónica ayuda a entender enlaces y propiedades; relaciona modelo microscópico con observaciones macroscópicas.
El mol conecta partículas con masa medible. Convierte unidades paso a paso antes de usar coeficientes de una reacción.`);
  add('1.º Bachillerato', 'Geografía e Historia', `Relaciona transformaciones políticas, económicas y sociales; un proceso contemporáneo no se explica con una sola fecha.
Compara principios liberales, actores y límites de cada revolución; distingue ideales proclamados de resultados reales.
Analiza intereses económicos, poder político y respuestas locales; evita presentar la descolonización como un proceso uniforme.
Ordena causas, etapas y consecuencias de los conflictos; contrasta perspectivas de varias fuentes históricas.
Un fenómeno global tiene efectos desiguales según territorio y grupo social; apoya la comparación en indicadores.`);

  add('2.º Bachillerato', 'Matemáticas', `Una matriz organiza datos y operaciones; el determinante informa sobre invertibilidad, pero no sustituye al razonamiento del problema.
Comprueba rango y compatibilidad antes de resolver. Sustituye la solución en todas las ecuaciones originales.
La derivada localiza candidatos a extremo; examina dominio y extremos del intervalo para decidir el óptimo global.
La integral definida acumula cambios y puede dar área con signo. Interpreta límites, unidades y contexto.
Define espacio muestral y condiciones de independencia; una media sin dispersión puede ocultar diferencias relevantes.`);
  add('2.º Bachillerato', 'Lengua', `Reconoce propósito, tesis y organización textual; relaciona cada rasgo lingüístico citado con su efecto comunicativo.
Divide la oración por verbos y nexos, identifica dependencias y verifica la función de cada subordinada.
El significado cambia con contexto, connotación y relaciones semánticas; justifica con el uso concreto de la palabra.
Compara voces, temas y técnicas del siglo XX y XXI mediante fragmentos; evita generalizaciones sobre toda una generación.
Formula una tesis precisa, desarrolla argumentos distintos y cierra sin repetir literalmente la introducción.`);
  add('2.º Bachillerato', 'Inglés', `Subraya la evidencia de una respuesta antes de inferir; una conclusión plausible no equivale a información explícita.
Deduce significado por prefijos, colocaciones y contexto; comprueba que la palabra elegida mantenga el sentido de la frase.
En una transformación, conserva significado y tiempo; revisa auxiliares, concordancia y límites de palabras pedidos.
Ajusta saludos, petición y cierre al destinatario. Un texto formal requiere precisión sin frases artificialmente rebuscadas.
Sostén una postura con razones y ejemplos propios; un contraargumento bien respondido refuerza la coherencia.`);
  add('2.º Bachillerato', 'Física y Química', `Distingue campo de fuerza sobre una carga o masa concreta; representa dirección, sentido y dependencia con la distancia.
La frecuencia la fija la fuente y la velocidad depende del medio; un diagrama de rayos ayuda a explicar imágenes ópticas.
En equilibrio coexisten procesos directo e inverso. Predice el desplazamiento al cambiar condiciones, sin decir que la reacción se detiene.
El pH expresa concentración en escala logarítmica; distingue ácido fuerte de disolución concentrada.
Los grupos funcionales condicionan propiedades y reacciones. Identifica primero cadena principal y grupo antes de nombrar.`);
  add('2.º Bachillerato', 'Geografía e Historia', `Evalúa autor, fecha, propósito y límites de la fuente antes de usarla como prueba de un proceso histórico.
Organiza cambios y continuidades en España por etapas; vincula decisiones políticas con impactos sociales.
Cruza mapas, climogramas y pirámides de población para explicar el territorio; una sola fuente no basta.
Relaciona escalas municipal, autonómica, estatal y europea con competencias concretas antes de atribuir responsabilidades.
Compara indicadores demográficos y económicos entre territorios; distingue correlación de explicación causal.`);

  const guide = (subject, title) => {
    const name = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (subject === 'Matemáticas') {
      if (/probabilidad|estadistica|datos|grafic|media/.test(name)) return {recognition:'Hay datos, frecuencias o sucesos que comparar.',steps:['Define qué representa cada dato y su unidad.','Organiza los valores en tabla, gráfico o casos posibles antes de operar.','Interpreta el resultado en el contexto; comprueba si un extremo o caso cambia la conclusión.'],transfer:'Cambia un dato o un caso posible y explica cómo afecta a la conclusión.'};
      if (/geometr|area|perimetro|volumen|trigonom|formas|cuerpos/.test(name)) return {recognition:'La forma, las medidas y las unidades determinan el procedimiento.',steps:['Dibuja la figura y marca los datos conocidos.','Decide si buscas longitud, superficie, volumen o una relación entre lados.','Sustituye los valores, calcula y comprueba que la unidad final corresponde a la magnitud.'],transfer:'Modifica una medida del dibujo y anticipa qué magnitud cambia antes de calcular.'};
      if (/ecuacion|algebra|sistema|polinomio|factoriz|matric|determinante/.test(name)) return {recognition:'Aparece una relación entre cantidades conocidas y una desconocida.',steps:['Nombra la incógnita y traduce la relación a una igualdad o expresión.','Transforma paso a paso conservando la equivalencia.','Sustituye el resultado en la relación original y comprueba que cumple todas las condiciones.'],transfer:'Cambia un dato del enunciado y resuelve de nuevo explicando qué pasos se mantienen.'};
      if (/funcion|limite|derivad|integral|optimiz/.test(name)) return {recognition:'Interesa cómo cambia una cantidad al variar otra.',steps:['Identifica variables, dominio y unidades.','Relaciona la fórmula con una tabla o gráfica y aplica el procedimiento adecuado.','Interpreta el resultado como valor, tendencia, pendiente o acumulación según el caso.'],transfer:'Describe qué cambiaría en la gráfica si modificas un parámetro del ejemplo.'};
      return {recognition:'Los datos numéricos se relacionan mediante una operación o comparación.',steps:['Separa datos, pregunta y unidades antes de calcular.','Representa la relación con bloques, recta, tabla o expresión según el nivel.','Estima y comprueba el resultado con la operación inversa o con el contexto.'],transfer:'Inventa un caso parecido con otros números y comprueba si el método sigue funcionando.'};
    }
    if (subject === 'Inglés') {
      if (/read|infer|compreh|text/.test(name)) return {recognition:'La respuesta debe apoyarse en una pista del texto.',steps:['Lee título y pregunta para saber qué información buscas.','Subraya la frase que aporta la prueba y distingue dato explícito de inferencia.','Responde con tus palabras sin añadir información que el texto no permite afirmar.'],transfer:'Escribe otra pregunta sobre el mismo texto y señala la frase que permite responderla.'};
      if (/writ|essay|paragraph|opinion|message/.test(name)) return {recognition:'La intención y el destinatario organizan el escrito.',steps:['Define idea principal, lector y registro.','Escribe una idea por frase o párrafo y une las partes con conectores adecuados.','Revisa tiempos verbales, concordancia, ortografía y si cada ejemplo apoya tu idea.'],transfer:'Reescribe el mismo mensaje para otro destinatario y explica qué cambió en el tono.'};
      if (/animal|family|colour|number|food|school|place|greeting|direction/.test(name)) return {recognition:'El vocabulario cobra sentido dentro de una situación concreta.',steps:['Relaciona palabra, imagen u objeto real.','Construye una frase completa con el término nuevo.','Cambia un elemento de la frase para comprobar que puedes reutilizar el vocabulario.'],transfer:'Crea una frase distinta con dos palabras del tema, sin copiar el ejemplo.'};
      return {recognition:'Una pista de tiempo, sujeto o intención decide la estructura.',steps:['Busca marcadores de tiempo y determina si la acción es habitual, terminada, en curso o hipotética.','Elige auxiliar y forma verbal; comprueba el orden de palabras.','Contrasta la frase con el ejemplo y revisa concordancia y significado.'],transfer:'Cambia el sujeto o el marcador temporal del ejemplo y adapta toda la frase.'};
    }
    if (subject === 'Lengua') {
      if (/literatur|siglo|medieval|renacent/.test(name)) return {recognition:'Un rasgo literario se demuestra en un fragmento y se sitúa en su contexto.',steps:['Sitúa obra, época y voz que habla.','Identifica un recurso, tema o rasgo concreto en el texto.','Explica qué efecto produce y relaciónalo con el contexto sin generalizar.'],transfer:'Compara el mismo tema en otro fragmento e indica una semejanza y una diferencia.'};
      if (/texto|escri|redacc|argument|resumen|comentario|comprensi|narrac|descripcion/.test(name)) return {recognition:'El propósito del texto determina qué ideas seleccionar y cómo ordenarlas.',steps:['Identifica tema, intención y destinatario.','Organiza idea principal, apoyos y ejemplos en un orden comprensible.','Relee y justifica con una frase del texto o revisa cohesión y puntuación del propio escrito.'],transfer:'Cambia el destinatario o la intención y explica cómo reorganizarías el texto.'};
      return {recognition:'La función de una palabra o grupo se comprueba dentro de la oración.',steps:['Lee la oración completa y localiza el verbo o núcleo relevante.','Observa concordancia, sustitución o posición para justificar la categoría o función.','Prueba la identificación en otra oración para evitar memorizar solo el ejemplo.'],transfer:'Crea otra oración con la misma estructura y señala el elemento estudiado.'};
    }
    if (subject === 'Geografía e Historia') return {recognition:'Todo proceso debe situarse en tiempo, espacio y escala.',steps:['Localiza dónde y cuándo ocurre; identifica la fuente o indicador.','Relaciona al menos dos causas con los actores o condiciones del proceso.','Distingue consecuencias inmediatas, efectos posteriores y límites de la evidencia.'],transfer:'Compara el proceso con otro lugar o periodo indicando una similitud y una diferencia.'};
    if (subject === 'Física y Química') return {recognition:'La explicación debe conectar una observación con un modelo y sus unidades.',steps:['Describe fenómeno, datos y sistema de referencia sin interpretarlos aún.','Elige el modelo, ecuación o representación que relaciona las magnitudes.','Comprueba unidades, orden de magnitud y si la conclusión coincide con lo observado.'],transfer:'Modifica una condición del experimento y predice el resultado antes de comprobarlo.'};
    return {recognition:'Una idea científica se apoya en observaciones y relaciones comprobables.',steps:['Nombra los elementos que intervienen y qué cambia en cada uno.','Relaciona causa, proceso y consecuencia usando un dibujo o esquema.','Contrasta la explicación con el ejemplo y señala qué dato la sostiene.'],transfer:'Predice qué ocurriría si cambiara una condición del ejemplo y justifica tu respuesta.'};
  };
  for (const subjects of Object.values(catalogue)) {
    for (const [subject, topics] of Object.entries(subjects)) {
      topics.forEach(topic => {
        const objectives = {
          'Matemáticas': `Resolver una situación sobre ${topic.title.toLowerCase()}, justificar cada paso y comprobar si el resultado tiene sentido.`,
          'Lengua': `Reconocer y explicar ${topic.title.toLowerCase()} en un ejemplo propio, apoyando la respuesta en rasgos observables.`,
          'Inglés': `Comprender y usar ${topic.title.toLowerCase()} en contexto, eligiendo la forma adecuada y revisando el significado.`,
          'Ciencias Naturales': `Explicar ${topic.title.toLowerCase()} con un esquema de sus elementos y una observación que apoye la explicación.`,
          'Física y Química': `Interpretar ${topic.title.toLowerCase()} a partir de datos, modelos y unidades coherentes.`,
          'Geografía e Historia': `Situar y explicar ${topic.title.toLowerCase()} mediante causas, contexto y fuentes o indicadores concretos.`
        };
        topic.didactic.objective = objectives[subject] || topic.didactic.objective;
        topic.didactic.concepts = [topic.explanation, topic.didactic.deepDive]
          .flatMap(text => text.split(/[.;]/).map(part => part.trim()).filter(part => part.length > 18))
          .slice(0, 3);
        Object.assign(topic.didactic, guide(subject, topic.title));
        topic.didactic.examples = [topic.example, `${topic.question} → ${topic.answer}`];
        topic.didactic.practice = [
          {prompt: topic.question, answer: topic.answer},
          {prompt: `¿Cómo reconocerías una situación en la que debes usar ${topic.title.toLowerCase()}?`, answer: topic.didactic.recognition},
          {prompt: topic.didactic.transfer, answer: `Respuesta abierta. Debe aplicar la idea del tema y justificarla con claridad: ${topic.didactic.deepDive}`}
        ];
        topic.didactic.solutions = topic.didactic.practice.map(item => item.answer);
      });
    }
  }
  const all = Object.values(catalogue).flatMap(subjects => Object.values(subjects).flat());
  if (all.some(topic => !topic.didactic.deepDive || topic.didactic.deepDive.length < 70)) {
    throw Error('Hay temas sin una ampliación didáctica completa.');
  }
})();
