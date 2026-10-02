/* Base curricular de consulta. Cada ficha tiene una idea, un ejemplo resuelto y una práctica. */
(() => {
  const catalogue = {};
  const add = (course, subject, rows) => {
    catalogue[course] ??= {};
    catalogue[course][subject] = rows.trim().split('\n').map((line, index) => {
      const [title, explanation, example, question, answer] = line.split('|').map(part => part.trim());
      return { id: `${course}-${subject}-${index}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, explanation, example, question, answer };
    });
  };

  add('1.º Primaria', 'Matemáticas', `Números hasta 100|Las decenas agrupan diez unidades. El valor de una cifra depende de su posición.|47 son 4 decenas y 7 unidades.|¿Cuántas decenas y unidades hay en 63?|6 decenas y 3 unidades.
Sumas y restas|Sumar reúne cantidades; restar permite saber cuánto queda o cuánto falta. Usa objetos o una recta numérica.|8 + 5 = 13; si quitamos 3, quedan 10.|Calcula 9 + 6 y 15 − 7.|15 y 8.
Formas y cuerpos|Un cuadrado y un rectángulo son figuras planas; un cubo y una esfera ocupan espacio.|Una pelota se parece a una esfera; una caja, a un prisma.|Nombra una figura plana y un cuerpo de tu entorno.|Por ejemplo, ventana rectangular y dado cúbico.
Medidas cotidianas|Comparamos largo, peso y capacidad con una misma unidad para que la medida tenga sentido.|Una regla mide en centímetros; una botella puede contener un litro.|¿Usarías centímetros o litros para medir un lápiz?|Centímetros.
Problemas de un paso|Lee qué se pregunta, identifica los datos y elige sumar o restar. Escribe la respuesta con su unidad.|Ana tiene 6 cromos y gana 4: 6 + 4 = 10 cromos.|Hay 12 lápices y se pierden 5. ¿Cuántos quedan?|7 lápices.`);
  add('1.º Primaria', 'Lengua', `Letras, sílabas y palabras|Las palabras se forman con sílabas. Separarlas ayuda a leer y escribir sin saltarse sonidos.|«Mariposa» se separa en ma-ri-po-sa.|Separa «pelota» en sílabas.|pe-lo-ta.
Oraciones sencillas|Una oración comunica una idea completa, empieza con mayúscula y termina con punto.|«El gato duerme.» es una oración completa.|Corrige «la niña canta».|La niña canta.
Comprender un cuento|Reconoce quién participa, dónde ocurre y qué pasa al principio, durante y al final.|Si el personaje pierde su llave y la encuentra, esos hechos organizan la historia.|Después de leer un cuento, di quién es el protagonista.|Depende del cuento; debe ser el personaje principal.
Describir personas y objetos|Para describir, observa rasgos concretos: tamaño, color, forma y utilidad.|«La mochila es roja, pequeña y tiene dos bolsillos».|Describe un objeto con dos características.|Respuesta abierta con dos rasgos observables.
Escribir un mensaje|Un mensaje breve debe decir a quién va dirigido y qué necesitas comunicar.|«Hola, Leo: te espero en la biblioteca. Ana».|Escribe un mensaje para avisar de un cambio de hora.|Respuesta abierta que indique destinatario y nueva hora.`);
  add('1.º Primaria', 'Inglés', `Greetings|Usamos saludos distintos al llegar y al despedirnos.|Hello, I'm Mia. Goodbye!|¿Cómo saludas en inglés?|Hello o Hi.
Numbers and colours|Relaciona números y colores con objetos reales para recordar el vocabulario.|I have two blue pencils.|Traduce «tres libros rojos».|Three red books.
My family|Usa family words para presentar a personas cercanas.|This is my brother. His name is Sam.|Presenta a tu madre en inglés.|This is my mother.
School objects|Los nombres de objetos del aula se practican señalándolos y nombrándolos.|This is a pencil. That is a book.|¿Cómo dices «un cuaderno»?|A notebook.
I like…|I like expresa gustos y I don't like expresa lo contrario.|I like apples. I don't like milk.|Escribe una cosa que te guste.|I like + nombre de comida, juego u objeto.`);
  add('1.º Primaria', 'Ciencias Naturales', `Mi cuerpo y los sentidos|Los ojos, oídos, nariz, lengua y piel nos ayudan a percibir el entorno.|Oímos una campana con los oídos.|¿Qué sentido utilizas para reconocer un aroma?|El olfato.
Seres vivos e inertes|Los seres vivos realizan funciones vitales; una piedra no crece ni se reproduce.|Una planta es un ser vivo; una mesa no lo es.|¿Es un árbol un ser vivo? Explica por qué.|Sí; crece y realiza funciones vitales.
Animales y plantas|Los animales se alimentan; las plantas fabrican su alimento con luz, agua y aire.|Una mariposa necesita alimento; un girasol necesita luz.|Nombra una necesidad de una planta.|Luz, agua, aire o nutrientes.
Hábitos saludables|Dormir, moverse, comer variado y lavarse las manos ayudan a cuidar el cuerpo.|Lavarse las manos antes de comer reduce riesgos.|Di dos hábitos saludables.|Por ejemplo, dormir suficiente y lavarse las manos.
Materiales y objetos|Un objeto puede estar hecho de madera, metal, vidrio o plástico; cada material tiene propiedades.|El cristal deja pasar la luz, pero se puede romper.|¿Qué material elegirías para una ventana?|Vidrio, por ser transparente.`);

  add('2.º Primaria', 'Matemáticas', `Números hasta 1000|Las centenas agrupan cien unidades. Descomponer números facilita compararlos.|528 = 500 + 20 + 8.|Descompón 374.|300 + 70 + 4.
Sumas y restas con llevadas|Coloca unidades bajo unidades y decenas bajo decenas. Reagrupa cuando una columna llega a diez.|27 + 18: 7 + 8 = 15; escribimos 5 y llevamos 1; resultado 45.|Calcula 46 + 27.|73.
Introducción a la multiplicación|Multiplicar reúne grupos iguales; la suma repetida ayuda a entenderla.|4 grupos de 3 son 3 + 3 + 3 + 3 = 12; 4 × 3 = 12.|¿Cuánto es 5 × 2?|10.
Tiempo y dinero|Lee horas completas y medias horas; compara monedas y billetes para formar una cantidad.|Dos monedas de 50 céntimos hacen 1 euro.|¿Cuánto son 1 € y 50 céntimos más 50 céntimos?|2 €.
Datos en tablas|Las tablas ordenan datos. Cuenta cada categoría antes de responder.|Si 4 eligen manzana y 2 pera, la manzana tiene 2 votos más.|En una tabla hay 6 perros y 3 gatos. ¿Cuántos animales hay?|9 animales.`);
  add('2.º Primaria', 'Lengua', `Sustantivos y artículos|El sustantivo nombra personas, animales o cosas; el artículo lo acompaña y concuerda con él.|La casa, el perro, unas flores.|Pon un artículo delante de «montaña».|La montaña o una montaña.
Verbos en presente|El verbo indica una acción o estado. En presente, la acción ocurre ahora o habitualmente.|«Leo» en «Yo leo cada tarde».|Completa: «Ellos ___ en el patio» (jugar).|Juegan.
Mayúsculas y signos|Escribe mayúscula al empezar una oración y en nombres propios; usa ¿? en preguntas.|«¿Dónde vive Marta?»|Corrige «que hora es».|¿Qué hora es?
Idea principal|La idea principal resume lo más importante de un texto; los detalles la explican.|Si el texto cuenta cómo cuidar un huerto, esa es su idea central.|Lee un párrafo y exprésalo en una frase.|Respuesta abierta que recoja el asunto principal.
Escribir una pequeña historia|Ordena inicio, problema y final; usa conectores para que el lector siga la secuencia.|Primero salió de casa; después encontró un cachorro; finalmente lo ayudó.|Escribe tres frases con «primero», «después» y «finalmente».|Respuesta abierta con orden coherente.`);
  add('2.º Primaria', 'Inglés', `Daily routines|El presente simple sirve para hablar de rutinas: I get up, I eat, I play.|I get up at seven and go to school.|Completa: I ___ breakfast in the morning (eat).|Eat.
Animals|Aprende animales junto con una característica o un hábitat.|A dolphin lives in the sea.|Nombra dos animales en inglés.|Por ejemplo, dog and cat.
There is / There are|There is presenta un elemento; there are, varios.|There is a tree. There are two birds.|Completa: ___ three books.|There are.
Food and drinks|Combina vocabulario de comida con I like y I don't like.|I like bananas but I don't like cheese.|Escribe una frase sobre comida que te gusta.|I like + alimento.
Questions with What and Where|What pregunta qué; where pregunta dónde. La respuesta debe aportar el dato pedido.|Where is the ball? It is under the table.|¿Qué pregunta harías para saber dónde está el libro?|Where is the book?`);
  add('2.º Primaria', 'Ciencias Naturales', `Ciclo de vida de los seres vivos|Los seres vivos nacen, crecen, pueden reproducirse y mueren. Cada especie sigue un ciclo.|La mariposa pasa por huevo, oruga, crisálida y adulto.|Ordena huevo, mariposa y oruga.|Huevo → oruga → mariposa.
Ecosistemas cercanos|Un ecosistema incluye seres vivos y el medio donde se relacionan.|En un estanque hay peces, plantas, agua, luz y suelo.|Nombra un ser vivo y un elemento no vivo de un parque.|Árbol y suelo, por ejemplo.
El agua|El agua puede ser sólida, líquida o gaseosa. La temperatura puede cambiar su estado.|El hielo se derrite y pasa a agua líquida.|¿Qué ocurre al congelar agua?|Pasa de líquido a sólido.
Máquinas sencillas|Las máquinas ayudan a hacer tareas con menos esfuerzo o de otra manera.|Una rampa facilita subir una caja.|Nombra una máquina sencilla de tu entorno.|Por ejemplo, unas tijeras o una rampa.
Cuidar el entorno|Reducir residuos, reutilizar materiales y ahorrar agua ayuda a proteger el medio.|Cerrar el grifo mientras te cepillas ahorra agua.|Di una acción para generar menos residuos.|Reutilizar una botella o usar una bolsa duradera.`);

  add('3.º Primaria', 'Matemáticas', `Números de cuatro y cinco cifras|Cada posición multiplica por diez el valor de la anterior. Descompón antes de comparar.|12 405 = 10 000 + 2 000 + 400 + 5.|¿Qué valor tiene el 3 en 13 620?|3 000.
Multiplicaciones|Multiplicar es sumar grupos iguales. Las tablas ayudan a calcular con rapidez.|23 × 4 = 20 × 4 + 3 × 4 = 92.|Calcula 32 × 3.|96.
División como reparto|Dividir reparte una cantidad en grupos iguales; comprueba multiplicando.|15 caramelos entre 3 niños: 15 ÷ 3 = 5 para cada uno.|Reparte 24 cromos entre 6 personas.|4 cromos por persona.
Fracciones sencillas|Una fracción muestra partes iguales de un todo: arriba van las partes elegidas y abajo las partes totales.|3/4 significa tres de cuatro partes iguales.|Si comes 2 de 8 porciones, ¿qué fracción has comido?|2/8, equivalente a 1/4.
Perímetro|El perímetro es la longitud del borde de una figura. Suma todos sus lados con la misma unidad.|Rectángulo de 5 cm y 3 cm: 5 + 3 + 5 + 3 = 16 cm.|Calcula el perímetro de un cuadrado de 4 cm de lado.|16 cm.`);
  add('3.º Primaria', 'Lengua', `Clases de palabras|Sustantivos nombran, adjetivos describen y verbos expresan acciones.|«El perro pequeño corre»: perro es sustantivo, pequeño adjetivo y corre verbo.|Encuentra el adjetivo de «La flor amarilla crece».|Amarilla.
Sujeto y predicado|El sujeto indica de quién se habla; el predicado dice qué hace o qué le sucede.|«Mis amigos juegan»: Mis amigos es sujeto; juegan es predicado.|Separa sujeto y predicado en «La lluvia cae».|La lluvia / cae.
Sinónimos y antónimos|Los sinónimos tienen significado parecido; los antónimos expresan oposición.|Alegre y contento son sinónimos; alegre y triste, antónimos.|Da un antónimo de «rápido».|Lento.
Comprensión y resumen|Localiza ideas importantes y exprésalas con tus palabras, sin copiar todos los detalles.|Un texto sobre una excursión puede resumirse con lugar, actividad y resultado.|Resume en dos frases un texto leído.|Respuesta abierta que incluya las ideas principales.
Párrafos y conectores|Cada párrafo desarrolla una idea. Los conectores muestran orden o relación.|«Primero preparé la mochila. Después salí de casa».|Escribe dos frases unidas con «porque».|Respuesta abierta con una causa coherente.`);
  add('3.º Primaria', 'Inglés', `Present simple|Usamos el presente simple para hábitos; con he y she el verbo suele acabar en -s.|I play tennis. She plays tennis.|Completa: He ___ to school (walk).|Walks.
Can and can't|Can expresa capacidad y can't indica que no podemos hacer algo.|A fish can swim but it can't fly.|Traduce «Puedo cantar».|I can sing.
Places in town|Relaciona lugares de la ciudad con actividades y direcciones sencillas.|We borrow books at the library.|¿Dónde compras pan? Responde en inglés.|At the bakery.
Describing people|Usa have got y adjetivos para describir rasgos visibles.|She has got brown eyes and curly hair.|Describe el pelo de una persona en inglés.|He/She has got + colour/type of hair.
Reading short texts|Busca quién, dónde y cuándo antes de responder; relee la frase que contiene la prueba.|«Tom plays on Sunday» responde cuándo juega Tom.|¿Qué dato buscarías para responder «Where?»?|Un lugar.`);
  add('3.º Primaria', 'Ciencias Naturales', `Los seres vivos y sus funciones|Nutrición, relación y reproducción son funciones comunes de los seres vivos.|Una planta capta luz y agua; un animal obtiene alimento.|Nombra dos funciones vitales.|Nutrición, relación o reproducción.
Alimentación equilibrada|El cuerpo necesita alimentos variados, agua y actividad física; ningún alimento por sí solo cubre todo.|Una comida variada combina verduras, cereales y proteínas.|Propón una merienda que incluya fruta y agua.|Respuesta abierta con fruta y agua.
Estados de la materia|Sólidos mantienen su forma, líquidos adoptan la del recipiente y gases se expanden.|El agua líquida toma la forma del vaso.|¿Qué estado tiene el vapor de agua?|Gaseoso.
La luz y las sombras|La luz viaja y una sombra aparece cuando un objeto opaco la bloquea.|Una linterna delante de una mano proyecta su sombra en la pared.|¿Qué pasa si acercas la mano a la linterna?|La sombra proyectada suele hacerse mayor.
Ecosistemas y cadenas alimentarias|Los seres vivos se relacionan al alimentarse; una cadena muestra ese recorrido de energía.|Hierba → conejo → zorro.|¿Qué es el productor en la cadena hierba → conejo?|La hierba.`);

  add('4.º Primaria', 'Matemáticas', `Números grandes y operaciones|Descompón cantidades para estimar el resultado antes de operar.|3 245 + 2 000 = 5 245.|Calcula 4 380 − 1 200.|3 180.
División con divisor de una cifra|Divide de izquierda a derecha y comprueba multiplicando el cociente por el divisor.|84 ÷ 4 = 21 porque 21 × 4 = 84.|Calcula 96 ÷ 3.|32.
Fracciones equivalentes|Dos fracciones son equivalentes si representan la misma parte del todo.|1/2 = 2/4 porque ambas son la mitad.|Escribe una fracción equivalente a 3/5.|6/10, por ejemplo.
Números decimales|La coma separa unidades de décimas y centésimas. Compara cifras en la misma posición.|2,35 € son 2 euros y 35 céntimos.|¿Qué es mayor: 3,4 o 3,35?|3,4 (equivale a 3,40).
Áreas de figuras|El área mide la superficie. En un rectángulo, multiplica base por altura.|Rectángulo de 6 cm × 4 cm: área 24 cm².|Calcula el área de 5 cm × 3 cm.|15 cm².`);
  add('4.º Primaria', 'Lengua', `Determinantes y pronombres|El determinante acompaña al nombre; el pronombre puede sustituirlo.|«Esa niña» lleva determinante; «ella» sustituye a niña.|Sustituye «Marcos» en «Marcos lee» por un pronombre.|Él lee.
Tiempos verbales|El verbo puede situar la acción en pasado, presente o futuro.|Ayer jugué, hoy juego, mañana jugaré.|Pasa «canto» al futuro.|Cantaré.
Acentuación básica|Identifica la sílaba tónica; las agudas llevan tilde si terminan en vocal, n o s.|Café es aguda y termina en vocal.|¿Lleva tilde «camion»? Escríbela bien.|Camión.
Tipos de texto|Una noticia informa, una receta da instrucciones y un cuento narra hechos.|Una receta ordena ingredientes y pasos.|¿Qué tipo de texto usarías para explicar un experimento?|Un texto instructivo.
Escritura y revisión|Planifica, escribe y revisa si las ideas siguen un orden y los signos están bien usados.|Un párrafo mejora al separar frases largas y añadir puntos.|Revisa una frase sin puntuación y añade los signos necesarios.|Respuesta abierta con puntuación coherente.`);
  add('4.º Primaria', 'Inglés', `Present simple questions|Do y does ayudan a formular preguntas sobre hábitos.|Do you play? Does she play?|Completa: ___ he like music?|Does.
Past simple of be|Was y were sitúan estados en el pasado; el sujeto decide cuál usar.|I was at home. They were at school.|Completa: We ___ happy yesterday.|Were.
Comparatives|Comparamos dos cosas con -er o more, según el adjetivo.|A bike is faster than walking.|Escribe el comparativo de «small».|Smaller.
Directions|Las indicaciones usan verbos de movimiento y puntos de referencia.|Go straight and turn left at the park.|Traduce «gira a la derecha».|Turn right.
Writing a short paragraph|Un párrafo breve presenta una idea y añade dos o tres detalles conectados.|My town is small. It has a park. I like it.|Escribe tres frases sobre tu barrio.|Respuesta abierta con tres frases relacionadas.`);
  add('4.º Primaria', 'Ciencias Naturales', `Aparatos del cuerpo humano|El aparato digestivo transforma alimentos; el respiratorio obtiene oxígeno y el circulatorio lo transporta.|El aire entra por la nariz y llega a los pulmones.|¿Qué aparato transporta oxígeno por el cuerpo?|El circulatorio.
Clasificar animales|Podemos agrupar animales por características observables, como tener o no columna vertebral.|Un perro es vertebrado; una mariposa, invertebrada.|¿Es una lombriz vertebrada?|No, es invertebrada.
Mezclas y materiales|Una mezcla reúne sustancias sin crear una nueva; algunas pueden separarse por filtración o evaporación.|Arena y agua pueden separarse con un filtro.|¿Cómo separarías arena de agua?|Por filtración.
Fuerzas y movimiento|Una fuerza puede mover, frenar o deformar un objeto.|Al empujar una pelota, cambia su movimiento.|¿Qué pasa si tiras de una goma elástica?|Se deforma.
La Tierra y la Luna|La Tierra gira sobre sí misma y alrededor del Sol; la Luna gira alrededor de la Tierra.|El giro de la Tierra causa día y noche.|¿Qué movimiento causa día y noche?|La rotación terrestre.`);

  add('5.º Primaria', 'Matemáticas', `Divisibilidad y múltiplos|Un múltiplo se obtiene multiplicando por un número natural; un divisor divide sin dejar resto.|24 es múltiplo de 6 porque 6 × 4 = 24.|¿Es 7 divisor de 42?|Sí, 42 ÷ 7 = 6.
Operaciones con fracciones|Para sumar fracciones con igual denominador, suma numeradores y conserva el denominador.|2/7 + 3/7 = 5/7.|Calcula 1/8 + 4/8.|5/8.
Porcentajes sencillos|Un porcentaje indica partes de cada cien. El 50 % es la mitad y el 25 % un cuarto.|50 % de 30 es 15.|Calcula el 25 % de 20.|5.
Áreas y perímetros|No confundas borde y superficie: el perímetro se mide en unidades y el área en unidades cuadradas.|Rectángulo 4 × 3: perímetro 14 cm; área 12 cm².|Calcula área y perímetro de un cuadrado de lado 5 cm.|25 cm² y 20 cm.
Gráficas y media|Lee ejes y unidades antes de comparar datos. La media suma valores y divide por su cantidad.|Notas 6, 8 y 10: media (6 + 8 + 10) ÷ 3 = 8.|Calcula la media de 3, 5 y 7.|5.`);
  add('5.º Primaria', 'Lengua', `Categorías gramaticales|Distingue sustantivos, adjetivos, verbos y adverbios por su función en la oración.|«Corre rápidamente»: corre es verbo; rápidamente es adverbio.|¿Qué clase de palabra es «alegre» en «niña alegre»?|Adjetivo.
Oración: sujeto y predicado|Busca el verbo y pregunta quién realiza o recibe la acción; el sujeto puede estar omitido.|«Llegamos tarde»: el sujeto omitido es nosotros.|Encuentra el sujeto en «Los pájaros cantan».|Los pájaros.
Ortografía y tildes|Las llanas llevan tilde cuando no terminan en vocal, n o s; revisa también hiatos frecuentes.|Árbol es llana y termina en l.|¿Lleva tilde «lapiz»?|Sí: lápiz.
Textos expositivos|Un texto expositivo explica un tema con orden, definiciones y ejemplos.|Un párrafo sobre volcanes puede definirlos y explicar cómo erupcionan.|Escribe una frase que defina un ecosistema.|Respuesta abierta con seres vivos y medio.
Argumentar una opinión|Una opinión se sostiene mejor con una razón y un ejemplo, sin confundirla con un hecho.|«Conviene leer: amplía vocabulario; por ejemplo, aprendemos palabras nuevas».|Defiende en dos frases una actividad escolar.|Respuesta abierta con opinión y razón.`);
  add('5.º Primaria', 'Inglés', `Past simple regular verbs|Los verbos regulares suelen añadir -ed para hablar de acciones terminadas.|I visited my grandparents yesterday.|Pasa «play» al pasado.|Played.
Irregular past verbs|Algunos verbos tienen formas de pasado que debemos aprender en contexto.|Go → went; I went to school.|Completa: Yesterday I ___ a film (see).|Saw.
Future with going to|Going to expresa planes o intenciones.|I'm going to study tonight.|Escribe «voy a leer» en inglés.|I'm going to read.
Countable and uncountable|Some y any ayudan a hablar de cantidades; some suele ir en afirmativas.|There is some water. There are some apples.|¿Es «water» contable?|No, es incontable.
Reading and inference|Una inferencia combina pistas del texto con lo que ya sabes; distingue lo dicho de lo deducido.|«She took an umbrella» sugiere que puede llover, pero no lo afirma.|¿Es seguro que llueve si alguien lleva paraguas?|No; es una inferencia posible.`);
  add('5.º Primaria', 'Ciencias Naturales', `La célula|La célula es la unidad básica de los seres vivos; muchas células forman tejidos.|Las plantas y los animales están formados por células.|¿Qué es más pequeño: célula o tejido?|La célula.
Nutrición humana|Digestión, respiración y circulación trabajan juntas para obtener y transportar nutrientes y oxígeno.|El intestino absorbe nutrientes que luego viajan por la sangre.|¿Qué sistema transporta nutrientes?|El circulatorio.
Materia y cambios|La materia tiene masa y ocupa espacio. Algunos cambios modifican su estado sin cambiar su composición.|Al derretirse, el hielo sigue siendo agua.|¿Al evaporarse el agua deja de ser agua?|No; cambia de estado.
Energía y electricidad|La energía permite cambios; un circuito cerrado deja pasar la corriente.|Una pila, cables y una bombilla forman un circuito sencillo.|¿Se encenderá la bombilla si el circuito está abierto?|No.
Ecosistemas y conservación|Los seres vivos y el ambiente se afectan mutuamente; proteger hábitats conserva relaciones ecológicas.|Si desaparecen flores, ciertos polinizadores pierden alimento.|¿Por qué conviene proteger las flores silvestres?|Ayudan a polinizadores y a la biodiversidad.`);

  add('6.º Primaria', 'Matemáticas', `Fracciones y decimales|Una fracción puede escribirse como decimal al dividir numerador entre denominador.|3/4 = 3 ÷ 4 = 0,75.|Convierte 1/5 a decimal.|0,2.
Proporcionalidad|Si dos magnitudes aumentan en la misma proporción, usa una tabla para hallar valores desconocidos.|2 cuadernos cuestan 4 €; 4 cuestan 8 €.|Si 3 entradas cuestan 15 €, ¿cuánto cuestan 5?|25 €.
Porcentajes|Convierte el porcentaje a fracción de cien o decimal para calcularlo.|20 % de 50 = 0,20 × 50 = 10.|Calcula el 15 % de 100.|15.
Geometría y volumen|El volumen mide espacio ocupado y se expresa en unidades cúbicas; un prisma rectangular multiplica largo, ancho y alto.|Caja 2 × 3 × 4 cm: volumen 24 cm³.|Calcula el volumen de 5 × 2 × 3 cm.|30 cm³.
Estadística y probabilidad|La frecuencia cuenta apariciones; la probabilidad compara casos favorables con casos posibles.|En un dado, sacar un 6 tiene probabilidad 1/6.|¿Qué probabilidad hay de sacar cara en una moneda equilibrada?|1/2.`);
  add('6.º Primaria', 'Lengua', `Análisis de oraciones|Identifica verbo, sujeto y predicado; después localiza complementos de forma gradual.|«Laura lee un libro»: Laura, sujeto; lee un libro, predicado.|Separa sujeto y predicado en «El viento mueve las hojas».|El viento / mueve las hojas.
Clases de textos|Narrar cuenta hechos; describir presenta rasgos; explicar aclara un tema; argumentar defiende una idea.|Una receta es instructiva; una crónica narra hechos.|¿Qué texto usarías para defender una opinión?|Argumentativo.
Conectores y cohesión|Usa conectores para mostrar causa, contraste y consecuencia, y evita repetir palabras sin necesidad.|«Estudié; por eso entendí el tema» expresa consecuencia.|Une dos ideas con «sin embargo».|Respuesta abierta con contraste lógico.
Ortografía en contexto|Revisa tildes y signos al final, leyendo en voz alta para detectar frases confusas.|«¿Por qué llegaste tarde?» pregunta por una causa.|Corrige «porque no viniste?».|¿Por qué no viniste?
Resumen y comentario|Selecciona las ideas clave sin copiar literalmente; explica después qué quiere comunicar el autor.|Un resumen conserva la información central y omite ejemplos accesorios.|Resume un párrafo en dos frases.|Respuesta abierta fiel al texto.`);
  add('6.º Primaria', 'Inglés', `Present and past|Distingue hábitos del presente y acciones terminadas del pasado por los marcadores temporales.|I play on Mondays; I played yesterday.|Completa: Last week we ___ football (play).|Played.
Comparatives and superlatives|El comparativo relaciona dos elementos; el superlativo destaca uno dentro de un grupo.|Tall → taller → the tallest.|Escribe el superlativo de «small».|The smallest.
Modal verbs|Can expresa capacidad; must suele indicar obligación y should, consejo.|You should drink water. You must stop at the sign.|¿Qué modal usarías para dar un consejo?|Should.
Giving opinions|Expresa una opinión y justifícala con because; añade un ejemplo cuando puedas.|I like science because experiments are interesting.|Escribe una opinión con because.|Respuesta abierta con opinión y causa.
Short writing|Planifica inicio, dos detalles y cierre; revisa tiempos verbales y conectores.|My trip was fun. We visited a museum. I learned a lot.|Redacta tres frases sobre un viaje.|Respuesta abierta coherente y con tiempos consistentes.`);
  add('6.º Primaria', 'Ciencias Naturales', `Organización del cuerpo|Células forman tejidos; tejidos forman órganos y órganos colaboran en aparatos o sistemas.|El corazón es un órgano del sistema circulatorio.|Ordena órgano, célula y tejido.|Célula → tejido → órgano.
Reproducción y pubertad|Durante la pubertad se producen cambios físicos y emocionales diferentes en cada persona.|Los ritmos de desarrollo no son iguales para todos.|¿Cambian todas las personas al mismo ritmo?|No.
Fuerzas y máquinas|Una máquina transmite o transforma fuerzas; la energía se transfiere durante el movimiento.|Una palanca facilita levantar una carga.|¿Qué máquina simple usarías para mover una roca?|Una palanca.
Circuitos eléctricos|La corriente circula en un circuito cerrado. Materiales conductores y aislantes se comportan de forma distinta.|El cobre conduce; el plástico suele aislar.|¿Por qué se recubren los cables de plástico?|Para aislar y proteger.
Medio ambiente y clima|Diferencia tiempo atmosférico de clima y relaciona acciones humanas con impactos ambientales.|La lluvia de hoy es tiempo; el patrón de décadas describe clima.|¿Una tormenta de un día demuestra cambio climático?|No; el clima se estudia con periodos largos.`);

  add('1.º ESO', 'Matemáticas', `Números enteros|Los negativos representan valores bajo una referencia. En la recta numérica, el número más a la derecha es mayor.|−3 + 5 = 2; desde −3 avanzamos cinco pasos.|Calcula −4 + 7.|3.
Divisibilidad y potencias|Las potencias son productos repetidos; los criterios de divisibilidad ahorran operaciones.|2³ = 2 × 2 × 2 = 8; 36 es divisible entre 3 porque 3 + 6 = 9.|¿Es 45 divisible entre 5 y entre 3?|Sí, entre ambos.
Fracciones y decimales|Para sumar fracciones, busca un denominador común; para comparar decimales, iguala sus cifras decimales.|1/2 + 1/4 = 2/4 + 1/4 = 3/4.|Calcula 2/3 + 1/6.|5/6.
Proporcionalidad y porcentajes|Una relación proporcional mantiene constante la razón; el porcentaje expresa una parte de cien.|Si 4 kg cuestan 12 €, 1 kg cuesta 3 €.|¿Cuánto cuestan 7 kg a ese precio?|21 €.
Álgebra inicial|Una letra puede representar un número variable. Sustituye su valor para comprobar una expresión.|Si x = 3, entonces 2x + 1 = 7.|Calcula 3a − 2 cuando a = 4.|10.
Geometría y estadística|Usa fórmulas con unidades correctas y lee gráficos comprobando escala y fuente.|Triángulo de base 6 y altura 4: área (6 × 4)/2 = 12 u².|Calcula el área de base 8 y altura 5.|20 u².`);
  add('1.º ESO', 'Lengua', `Comunicación y tipos de texto|Emisor, receptor, mensaje, canal y contexto ayudan a comprender una situación comunicativa.|Un correo tiene emisor, destinatario y mensaje escrito.|¿Quién es el receptor en una carta dirigida a Ana?|Ana.
Clases de palabras|La función de una palabra ayuda a identificar sustantivos, determinantes, adjetivos y verbos.|«Mi perro pequeño duerme»: mi, determinante; perro, sustantivo.|¿Qué palabra es adjetivo en «cielo azul»?|Azul.
Oración simple|Localiza el verbo y comprueba la concordancia con el sujeto; el sujeto no siempre aparece escrito.|«Llegaron temprano»: el sujeto puede estar omitido.|Separa sujeto y predicado en «Las niñas leen».|Las niñas / leen.
Narración y descripción|La narración organiza acciones en el tiempo; la descripción selecciona rasgos relevantes.|Una aventura narra hechos; un retrato describe a alguien.|¿Qué recursos usarías para describir un lugar?|Rasgos sensoriales y orden espacial.
Comprensión y resumen|Diferencia asunto, idea principal y detalles; redacta un resumen breve con palabras propias.|«El reciclaje ahorra recursos» puede ser idea central; los ejemplos de materiales son detalles.|Resume un texto en tres frases.|Respuesta abierta que conserve ideas clave sin copiar todo.`);
  add('1.º ESO', 'Inglés', `Present simple|Se usa para hábitos y hechos generales; en tercera persona singular suele añadirse -s.|She studies every day, but I study on Mondays.|Completa: My brother ___ football (play).|Plays.
Present continuous|Be + verbo en -ing describe acciones en desarrollo ahora.|They are reading right now.|Completa: I ___ (write) a message now.|Am writing.
Past simple|Los hechos terminados suelen llevar una referencia temporal y el verbo en pasado.|We visited London last year; she went yesterday.|Pasa «go» al pasado.|Went.
Questions and short answers|El auxiliar sitúa la pregunta y la respuesta breve retoma ese auxiliar.|Do you like music? Yes, I do.|Responde afirmativamente: Does he swim?|Yes, he does.
Reading and writing|Identifica propósito, idea central y detalles antes de escribir una respuesta organizada.|Un email informal abre con saludo, explica motivo y cierra.|Escribe una apertura para un email a un amigo.|Hi/Hello + nombre.`);
  add('1.º ESO', 'Ciencias Naturales', `Método científico|Una investigación plantea una pregunta, formula una hipótesis y compara datos observables.|Si una planta recibe menos luz, podemos medir su crecimiento frente a otra.|¿Qué variable medirías al estudiar crecimiento?|La altura de la planta, por ejemplo.
La Tierra en el universo|Los movimientos terrestres explican fenómenos como día, noche y estaciones junto con la inclinación del eje.|La rotación dura aproximadamente un día.|¿Qué movimiento se relaciona con las estaciones?|La traslación, junto con la inclinación del eje.
Atmósfera e hidrosfera|Aire y agua participan en ciclos y condicionan la vida; distingue reservas y cambios de estado.|Evaporación y condensación forman parte del ciclo del agua.|¿Qué proceso forma nubes?|Condensación.
Los seres vivos y las células|La célula es la unidad básica; clasificar exige comparar características, no solo apariencia.|Una bacteria es unicelular; un árbol, pluricelular.|¿Qué diferencia hay entre ambos?|Número de células que forman el organismo.
Ecosistemas|Productores, consumidores y descomponedores se relacionan con factores no vivos.|Hierba → saltamontes → ave; los hongos descomponen restos.|¿Qué papel cumple la hierba?|Productor.`);
  add('1.º ESO', 'Geografía e Historia', `Mapas y coordenadas|Escala, leyenda y orientación permiten interpretar un mapa sin confundir distancias reales y dibujadas.|Con escala 1:100 000, 1 cm representa 1 km.|¿Cuántos kilómetros son 3 cm en esa escala?|3 km.
Relieve y clima|El relieve describe formas del terreno; el clima resume condiciones atmosféricas de largos periodos.|Una cordillera es relieve; la temperatura media pertenece al clima.|¿Una nevada de hoy es clima o tiempo?|Tiempo atmosférico.
Prehistoria|Organiza Paleolítico, Neolítico y Edad de los Metales por cambios en vida y tecnología.|La agricultura se extendió en el Neolítico.|¿En qué etapa se generaliza la agricultura?|Neolítico.
Primeras civilizaciones|Ríos, agricultura, ciudades y escritura transformaron sociedades antiguas.|Egipto se desarrolló alrededor del Nilo.|¿Por qué fueron importantes los ríos?|Aportaban agua y facilitaban agricultura y transporte.
Grecia y Roma|Compara instituciones, cultura y legado evitando pensar que todas las personas tenían los mismos derechos.|La democracia ateniense excluía a mujeres, esclavos y extranjeros.|¿Era universal la ciudadanía ateniense?|No.`);

  add('2.º ESO', 'Matemáticas', `Números racionales|Los racionales pueden expresarse como fracción de enteros y representarse en la recta numérica.|−3/2 = −1,5, situado entre −2 y −1.|Ordena −1/2 y −3/4.|−1/2 es mayor.
Potencias y raíces|Una raíz cuadrada deshace una potencia de exponente dos; estima entre cuadrados conocidos.|√49 = 7 porque 7² = 49.|Calcula √81.|9.
Proporcionalidad directa e inversa|En la directa, el cociente se mantiene; en la inversa, el producto se mantiene.|Más trabajadores tardan menos tiempo si hacen la misma tarea a igual ritmo.|Si 2 personas tardan 6 h, ¿cuánto tardan 4 a igual ritmo?|3 h.
Expresiones algebraicas|Reduce términos semejantes y respeta paréntesis y jerarquía de operaciones.|3x + 2x − 4 = 5x − 4.|Simplifica 4a − a + 2.|3a + 2.
Ecuaciones de primer grado|Haz la misma operación en ambos miembros para mantener la igualdad y comprueba sustituyendo.|2x + 3 = 11 → 2x = 8 → x = 4.|Resuelve 3x − 5 = 10.|x = 5.
Funciones y geometría|Una tabla de pares ayuda a representar una relación; en geometría, dibuja y anota unidades antes de calcular.|Para y = 2x, los puntos (0,0), (1,2) y (2,4) están alineados.|Si y = 2x, ¿cuánto vale y cuando x = 5?|10.`);
  add('2.º ESO', 'Lengua', `Texto expositivo|Explica un asunto con claridad, orden, definiciones y ejemplos verificables.|Un texto sobre volcanes define el fenómeno y describe fases.|¿Qué añadirías para aclarar una palabra técnica?|Una definición o ejemplo.
Sujeto, predicado y complementos|El verbo es el núcleo del predicado; los complementos amplían la información.|«Ana envió un mensaje ayer»: ayer indica tiempo.|¿Qué indica «en clase» en «Leemos en clase»?|Lugar.
Verbos y tiempos|Reconoce persona, número, tiempo y modo para interpretar cuándo y cómo se presenta una acción.|«Cantábamos» es pasado, primera persona del plural.|¿En qué tiempo está «leerán»?|Futuro.
Ortografía y puntuación|La puntuación organiza ideas; las tildes distinguen pronunciación o significado en algunos casos.|«Tú» pronombre y «tu» posesivo.|Completa: «___ libro está aquí» (tu/tú).|Tu.
Literatura medieval y renacentista|Relaciona cada obra con su contexto y sus rasgos, evitando memorizar fechas aisladas.|Un romance es una composición narrativa transmitida en la tradición oral.|¿Por qué importa el contexto de una obra?|Ayuda a interpretar temas, lenguaje y propósito.`);
  add('2.º ESO', 'Inglés', `Past simple and continuous|Past continuous presenta una acción en curso; past simple puede interrumpirla.|I was reading when the phone rang.|Completa: I ___ (walk) when it started to rain.|Was walking.
Future forms|Will expresa predicciones o decisiones espontáneas; going to presenta planes o indicios.|I'm going to study tonight; I think it will rain.|¿Qué forma usarías para un plan ya decidido?|Going to.
Comparatives and superlatives|Elige la forma según la longitud del adjetivo y revisa las irregularidades.|Good → better → the best.|Completa: This is ___ book (interesting, superlativo).|The most interesting.
Modal verbs|Must, have to y should expresan obligación o consejo con matices distintos.|You must wear a helmet; you should rest.|Da un consejo con should.|You should + verbo base.
Opinion paragraphs|Introduce opinión, aporta razones y concluye; usa conectores de contraste.|I think sport is useful because… However,…|Escribe un conector de contraste.|However, but o although.`);
  add('2.º ESO', 'Física y Química', `Medir en ciencia|Toda medida necesita valor, unidad e instrumento; distingue precisión de estimación.|Una mesa mide 1,2 m, no solo «1,2».|¿Qué unidad usarías para la masa de un libro?|Gramos o kilogramos.
Estados y cambios de la materia|Las partículas se organizan de forma distinta en sólidos, líquidos y gases; un cambio de estado no crea una sustancia nueva.|Al hervir, agua líquida pasa a vapor de agua.|¿La fusión del hielo es cambio físico o químico?|Físico.
Mezclas y disoluciones|Una mezcla reúne sustancias; una disolución tiene aspecto uniforme. La separación depende de propiedades físicas.|Filtramos arena y agua; evaporamos agua salada para obtener sal.|¿Cómo separarías limaduras de hierro y arena?|Con un imán.
Átomos y elementos|Un elemento está formado por un tipo de átomo; una molécula puede combinar varios átomos.|H₂O contiene hidrógeno y oxígeno.|¿Cuántos átomos hay en H₂O?|Tres: dos de H y uno de O.
Movimiento y fuerzas|Describe movimiento con distancia y tiempo; una fuerza puede cambiar velocidad o dirección.|Recorrer 100 m en 20 s equivale a 5 m/s de velocidad media.|Calcula 60 m en 10 s.|6 m/s.`);
  add('2.º ESO', 'Geografía e Historia', `Población y migraciones|Densidad relaciona habitantes y superficie; migración significa desplazarse para vivir en otro lugar.|1 000 habitantes en 10 km² dan 100 hab/km².|Calcula densidad de 500 personas en 5 km².|100 hab/km².
Espacios urbanos y rurales|Compara actividades, servicios y población, evitando pensar que una zona es homogénea.|Una ciudad concentra servicios, pero también hay actividades agrarias próximas.|Nombra una diferencia entre ambos espacios.|Por ejemplo, densidad o tipos de servicios.
La Edad Media|Ordena los procesos en el tiempo y relaciona poder, economía y vida cotidiana.|El feudalismo articuló vínculos entre señores y vasallos.|¿Era igual la vida de nobles y campesinos?|No; tenían funciones y recursos distintos.
Al-Ándalus y reinos cristianos|Analiza convivencia, conflictos e intercambios culturales sin reducir siglos de historia a una sola idea.|La arquitectura y la lengua muestran influencias culturales duraderas.|Cita un ejemplo de legado andalusí.|Arquitectura, léxico o avances científicos.
Edad Moderna|Renacimiento, expansión marítima y cambios religiosos transformaron Europa y otros territorios.|La imprenta facilitó la difusión de ideas.|¿Qué efecto tuvo la imprenta?|Difusión más rápida de textos e ideas.`);

  add('3.º ESO', 'Matemáticas', `Números enteros y racionales|Los negativos expresan valores por debajo de una referencia. Las fracciones y decimales también pueden representar cantidades negativas.|−3 + 7 = 4. Para −2 × (−5), dos signos negativos dan +10.|Calcula −8 + 3 y −4 × 6.|−5 y −24.
Fracciones, decimales y porcentajes|Para comparar fracciones, busca un denominador común. Un porcentaje es una razón con base cien y puede expresarse como decimal.|3/4 = 0,75 = 75 %. En una rebaja del 20 % sobre 50 €, pagamos 40 €.|Convierte 2/5 a porcentaje y calcula el 10 % de 80.|40 % y 8.
Ecuaciones|Una ecuación mantiene la igualdad entre dos expresiones. Aísla la incógnita haciendo la misma operación a ambos lados y comprueba el resultado.|3(x − 2) = 12 → x − 2 = 4 → x = 6. Comprobación: 3(6 − 2) = 12.|Resuelve 2(x + 3) = 16.|x = 5.
Proporcionalidad|En una relación directa, duplicar una cantidad duplica la otra; en una inversa, el producto se mantiene. Comprueba qué relación hay antes de aplicar una regla.|Tres cuadernos cuestan 7,50 €; uno cuesta 2,50 € y cinco cuestan 12,50 €.|Cuatro entradas cuestan 36 €. ¿Cuánto cuestan seis?|54 €.
Geometría básica|Dibuja la figura, marca datos y unidades. El teorema de Pitágoras relaciona los lados de un triángulo rectángulo.|Si los catetos miden 3 y 4, la hipotenusa mide √(3² + 4²) = 5.|Calcula la hipotenusa de catetos 6 y 8.|10.
Estadística y probabilidad|La media resume valores, pero puede verse afectada por extremos. La probabilidad compara casos favorables y posibles.|Datos 2, 3 y 10: media 5; mediana 3. En un dado, P(par) = 3/6 = 1/2.|Calcula la media de 4, 6 y 8.|6.`);
  add('3.º ESO', 'Lengua', `Comprensión y estructura textual|Distingue tema, tesis e ideas secundarias. Un párrafo suele desarrollar una idea central con detalles o ejemplos.|Tema: redes sociales; tesis: conviene limitar su uso nocturno por el descanso.|Formula una tesis sobre lectura diaria.|Respuesta abierta, concreta y debatible.
Oración simple y sintagmas|Localiza el verbo y comprueba la concordancia. Después agrupa palabras que funcionan juntas como sintagmas.|«Las alumnas del taller prepararon un cartel»: sujeto «Las alumnas del taller».|Identifica el sujeto en «Ayer llegaron los invitados».|Los invitados.
Coordinación y subordinación|Dos proposiciones coordinadas tienen una relación distinta de una subordinada, que depende de otra.|«Estudié y descansé» coordina; «Sé que vendrás» subordina.|¿Es coordinada «Leo y escribo»?|Sí.
Texto argumentativo|Defiende una tesis con razones, ejemplos y un posible contraargumento; evita confundir opinión con dato.|Tesis: usar transporte público; razón: reduce emisiones por pasajero.|Escribe una razón verificable para una propuesta escolar.|Respuesta abierta con razón vinculada a la tesis.
Literatura del Siglo de Oro|Relaciona géneros y autores con el contexto, atendiendo a temas, recursos y recepción de las obras.|La novela picaresca usa un narrador de origen humilde y episodios de supervivencia.|Nombra una característica de la novela picaresca.|Narración autobiográfica ficticia o crítica social.`);
  add('3.º ESO', 'Inglés', `Present perfect and past simple|Present perfect conecta una experiencia o resultado con el presente; past simple sitúa un hecho terminado en un momento concreto.|I have visited London; I visited London in 2022.|Completa: She ___ (finish) her homework already.|Has finished.
Conditionals 0 and 1|El condicional cero expresa relaciones generales; el primero, consecuencias posibles futuras.|If you heat ice, it melts. If it rains, we'll stay home.|Completa: If I study, I ___ (pass).|Will pass.
Passive voice|En la pasiva, el foco está en quien recibe la acción; be cambia de tiempo y el verbo va en participio.|They built the bridge → The bridge was built.|Pasa a pasiva: «They make cars».|Cars are made.
Reading critically|Distingue información explícita, inferencias y opinión del autor; localiza pruebas en el texto.|«Probably» señala posibilidad, no certeza.|¿Una inferencia es una frase copiada literalmente?|No; se deduce de pistas.
Writing an opinion text|Abre con postura, añade dos razones y cierra retomando la idea. Usa conectores sin repetirlos.|In my view…, Firstly…, However…, In conclusion…|Escribe una frase inicial de opinión.|In my view… / I think… + idea.`);
  add('3.º ESO', 'Física y Química', `Estructura atómica|Protones y neutrones están en el núcleo; los electrones se distribuyen alrededor. El número atómico indica protones.|Un átomo con Z = 8 tiene 8 protones.|¿Cuántos protones tiene un átomo con Z = 11?|11.
Elementos y compuestos|Un elemento contiene un tipo de átomo; un compuesto une elementos en proporciones definidas.|O₂ es una sustancia simple de oxígeno; H₂O es un compuesto.|¿El CO₂ es elemento o compuesto?|Compuesto.
Reacciones químicas|Los reactivos se transforman en productos; los átomos se conservan y la ecuación se ajusta.|2 H₂ + O₂ → 2 H₂O conserva H y O en ambos lados.|¿Cuántos átomos de H hay en 2 H₂O?|4.
Movimiento|Velocidad media relaciona espacio recorrido y tiempo; una gráfica ayuda a ver cómo cambia el movimiento.|120 km en 2 h → 60 km/h.|Calcula velocidad media de 90 m en 15 s.|6 m/s.
Energía y electricidad|La energía se transfiere y transforma. En un circuito, intensidad, tensión y resistencia se relacionan por la ley de Ohm.|Con 12 V y 4 Ω, I = V/R = 3 A.|Calcula I con 9 V y 3 Ω.|3 A.`);
  add('3.º ESO', 'Geografía e Historia', `Población mundial|Compara natalidad, mortalidad y migraciones para explicar cambios demográficos; mira el periodo y la fuente.|Si llegan más personas de las que se marchan, el saldo migratorio es positivo.|¿Qué significa saldo migratorio negativo?|Salen más personas de las que llegan.
Actividades económicas|Sectores primario, secundario y terciario clasifican actividades por lo que producen o hacen.|Cultivar trigo es primario; fabricar pan, secundario; venderlo, terciario.|Clasifica un hospital.|Sector terciario.
Globalización|Conecta producción, comercio y comunicaciones entre territorios; analiza beneficios y desigualdades.|Un móvil puede diseñarse y fabricarse en países diferentes.|Da una ventaja y un reto de la globalización.|Respuesta abierta: intercambio y dependencia, por ejemplo.
Desigualdad y desarrollo|Un único indicador no describe toda una sociedad; combina renta, salud, educación y contexto.|Dos países con igual renta pueden diferir en esperanza de vida.|¿Basta la renta para medir bienestar?|No.
El territorio español y europeo|Sitúa espacios y explica cómo población, instituciones y recursos interactúan en distintas escalas.|Una decisión de la UE puede afectar a una región concreta.|Nombra una escala de análisis territorial.|Local, regional, estatal o europea.`);
  add('3.º ESO', 'Ciencias Naturales', `Organización del cuerpo humano|Células, tejidos, órganos y sistemas se coordinan; una alteración local puede afectar al conjunto.|El corazón impulsa sangre dentro del sistema circulatorio.|Ordena tejido, órgano y célula.|Célula → tejido → órgano.
Nutrición y salud|Digestión, respiración, circulación y excreción intervienen en la nutrición del organismo.|El intestino absorbe nutrientes; la sangre los distribuye.|¿Dónde se absorbe gran parte de los nutrientes?|En el intestino delgado.
Relación y sistema nervioso|Los receptores captan estímulos; el sistema nervioso procesa información y coordina respuestas.|Al tocar algo caliente, retiramos la mano rápidamente.|¿Qué detecta el calor en la piel?|Receptores sensoriales.
Reproducción humana|Explica procesos biológicos con lenguaje preciso y respeto a los distintos ritmos y situaciones personales.|La fecundación une gametos; el desarrollo embrionario ocurre después.|¿Son fecundación y gestación el mismo proceso?|No.
Ecosistemas y sostenibilidad|La biodiversidad favorece relaciones ecológicas; estudia impactos con evidencias y escalas temporales.|La pérdida de polinizadores puede reducir reproducción de plantas.|Nombra una medida de conservación de hábitats.|Protección, restauración o reducción de contaminación.`);

  add('4.º ESO', 'Matemáticas', `Números reales y radicales|Los números reales incluyen racionales e irracionales; simplifica radicales separando factores cuadrados.|√50 = √(25 × 2) = 5√2.|Simplifica √72.|6√2.
Polinomios y factorización|Opera términos semejantes y utiliza productos notables para reconocer factores.|x² − 9 = (x − 3)(x + 3).|Factoriza x² − 16.|(x − 4)(x + 4).
Ecuaciones y sistemas|Elige sustitución, igualación o reducción según convenga y comprueba ambas ecuaciones.|x + y = 5; x − y = 1 → 2x = 6 → x = 3, y = 2.|Resuelve x + y = 7 y x − y = 3.|x = 5, y = 2.
Funciones|Dominio, crecimiento y cortes con ejes describen una función; no deduzcas la tendencia sin mirar la escala.|y = 2x − 1 corta el eje y en −1.|¿Dónde corta y = 3x + 4 al eje y?|En 4.
Trigonometría|En un triángulo rectángulo, seno, coseno y tangente relacionan ángulos con lados.|sen θ = cateto opuesto / hipotenusa.|Si opuesto = 3 e hipotenusa = 5, ¿sen θ?|3/5.
Probabilidad compuesta|Usa diagramas de árbol para ordenar casos; distingue sucesos independientes de dependientes.|Dos monedas: P(dos caras) = 1/2 × 1/2 = 1/4.|¿Probabilidad de dos cruces al lanzar dos monedas?|1/4.`);
  add('4.º ESO', 'Lengua', `Oraciones compuestas|Identifica proposiciones y nexos; describe la relación entre ellas antes de etiquetarla.|«Aunque llueva, saldré» introduce una subordinada concesiva.|¿Qué expresa «porque» en «Salgo porque puedo»?|Causa.
Texto y discurso|La coherencia organiza ideas; la cohesión las enlaza mediante conectores y referencias.|«María llegó. Ella saludó» evita repetir el nombre.|¿A quién remite «ella» en el ejemplo?|A María.
Argumentación crítica|Separa hechos, interpretación y opinión; comprueba fuente y contexto de una afirmación.|Una estadística sin muestra ni fecha requiere cautela.|¿Qué preguntarías ante un porcentaje sin fuente?|Quién lo calculó, con qué datos y cuándo.
Literatura del siglo XIX|Relaciona Romanticismo y Realismo con sus contextos y recursos narrativos.|El Realismo observa vida cotidiana y conflictos sociales con detalle.|Nombra un rasgo del Realismo.|Atención a la vida cotidiana y detalle social.
Comentario de texto|Formula tema, estructura, intención y recursos con pruebas breves del propio texto.|No basta decir «es persuasivo»: señala una llamada a actuar o un argumento.|¿Qué evidencia usarías para justificar una tesis?|Una cita breve o dato del texto.`);
  add('4.º ESO', 'Inglés', `Conditionals|Los condicionales distinguen hechos generales, posibilidades y situaciones hipotéticas.|If I had more time, I would read more (segunda condicional).|Completa: If she studies, she ___ (pass).|Will pass.
Reported speech|Al contar palabras ajenas, pueden cambiar pronombres, tiempos y referencias temporales.|«I am tired» → She said that she was tired.|Transforma «I like music» → He said…|He said that he liked music.
Relative clauses|Who, which y that añaden información sobre personas o cosas.|The teacher who helped me is here.|Completa: The book ___ I bought is new.|That o which.
Passive and causative|La voz pasiva destaca el objeto o resultado; el causativo expresa que alguien encarga una acción.|The room was painted yesterday.|Pasa a pasiva «They built a bridge».|A bridge was built.
Writing for purpose|Ajusta registro, estructura y tono: un email formal no se redacta igual que un mensaje a un amigo.|Dear Sir or Madam… / Yours faithfully…|Escribe un saludo formal.|Dear Sir or Madam,`);
  add('4.º ESO', 'Física y Química', `Movimiento y gráficas|Relaciona posición, velocidad y aceleración; la pendiente de una gráfica posición-tiempo indica velocidad.|Si la posición cambia 20 m en 4 s, v media = 5 m/s.|Calcula velocidad media de 150 m en 30 s.|5 m/s.
Fuerzas y leyes de Newton|La fuerza neta cambia el movimiento; masa y aceleración se relacionan con F = m·a.|2 kg con aceleración 3 m/s² requieren fuerza neta 6 N.|Calcula F para 4 kg y 2 m/s².|8 N.
Energía y trabajo|El trabajo transfiere energía cuando una fuerza produce desplazamiento; cuida unidades.|Una fuerza de 10 N a lo largo de 2 m realiza 20 J si va en la dirección del movimiento.|Calcula 5 N por 3 m.|15 J.
Enlace químico y formulación|Los átomos se unen mediante enlaces; la fórmula indica tipos y proporciones de elementos.|NaCl representa una proporción 1:1 de sodio y cloro.|¿Qué indica el subíndice 2 en CO₂?|Dos átomos de oxígeno por unidad.
Reacciones y estequiometría|Ajusta la ecuación antes de comparar cantidades: los átomos se conservan.|2 H₂ + O₂ → 2 H₂O.|¿Cuántas moléculas de agua se forman con 2 H₂ y 1 O₂?|2 H₂O.`);
  add('4.º ESO', 'Geografía e Historia', `Ilustración y revoluciones|Ideas sobre razón, derechos y soberanía influyeron en cambios políticos, con procesos distintos en cada país.|La Revolución francesa cuestionó el Antiguo Régimen.|Nombra una idea de la Ilustración.|Razón, libertad o crítica del absolutismo.
Industrialización|Relaciona nuevas máquinas, energía, fábricas y cambios sociales sin olvidar costes humanos y ambientales.|La máquina de vapor impulsó producción y transporte.|¿Qué cambio produjo el trabajo fabril?|Concentración de trabajadores y nuevas condiciones laborales.
Siglo XX y guerras mundiales|Distingue causas, desarrollo y consecuencias; contrasta fuentes y sitúa hechos en una línea temporal.|La Primera Guerra Mundial ocurrió antes que la Segunda.|¿Es una causa lo mismo que una consecuencia?|No.
Dictadura y democracia en España|Analiza etapas con fechas y fuentes, distinguiendo instituciones y derechos.|La Constitución de 1978 pertenece al periodo democrático.|¿Qué documento se aprobó en 1978?|La Constitución española.
Mundo actual|Interpreta conflictos, organismos internacionales y retos globales con diversas fuentes.|La ONU es un foro de cooperación entre Estados.|¿Por qué conviene comparar fuentes sobre un conflicto?|Para detectar sesgos y completar perspectivas.`);

  add('1.º Bachillerato', 'Matemáticas', `Números reales y complejos|Los complejos amplían los reales con i² = −1; opera partes reales e imaginarias por separado.|(2 + 3i) + (1 − i) = 3 + 2i.|Calcula (3 + 2i) + (−1 + 4i).|2 + 6i.
Álgebra y sistemas|Plantea ecuaciones a partir de condiciones y comprueba soluciones que puedan ser no válidas para el problema.|x + y = 10 y x − y = 2 → x = 6, y = 4.|Resuelve x + y = 8 y x − y = 4.|x = 6, y = 2.
Funciones y límites|Un límite describe a qué valor se acerca una función, aunque en el punto pueda no estar definida.|(x² − 1)/(x − 1) = x + 1 para x ≠ 1; límite en 1 = 2.|Calcula lim x→2 de x + 3.|5.
Derivadas iniciales|La derivada mide la tasa de cambio instantánea y la pendiente de la tangente.|Si f(x) = x², f'(x) = 2x; en x = 3 la pendiente es 6.|Deriva f(x) = 3x².|6x.
Estadística y probabilidad|Distingue población, muestra y sesgo; aplica reglas de probabilidad con condiciones claras.|P(A ∪ B) = P(A) + P(B) − P(A ∩ B).|Si A y B son incompatibles, ¿cuánto vale P(A ∩ B)?|0.`);
  add('1.º Bachillerato', 'Lengua', `Comunicación y variedades lingüísticas|La lengua varía según región, grupo y situación; adecuar el registro no implica que una variedad sea inferior.|Un informe académico usa un registro distinto a un chat informal.|¿Qué registro elegirías para solicitar una beca?|Formal.
Morfología y sintaxis|Analiza la estructura de las palabras y su función en la oración, comprobando concordancia y relaciones.|En «inútil», in- es prefijo y útil es base léxica.|Identifica el prefijo de «imposible».|Im-.
Comentario de texto|Explica tema, tesis, estructura y recursos con pruebas breves; distingue resumen de interpretación.|Una tesis debe expresarse en una oración debatible.|¿Por qué citar un fragmento del texto?|Para justificar el análisis.
Argumentación y ensayo|Ordena tesis, argumentos y contraargumentos; comprueba la solidez de las fuentes.|Un dato con fecha y procedencia refuerza un argumento.|¿Qué debilita un argumento basado solo en una anécdota?|No permite generalizar con seguridad.
Literatura hasta el siglo XIX|Relaciona movimientos, autores y obras con su contexto, géneros y temas sin reducirlos a listas de fechas.|El Romanticismo valora subjetividad y libertad creativa.|Cita un rasgo del Romanticismo.|Subjetividad, imaginación o libertad.`);
  add('1.º Bachillerato', 'Inglés', `Advanced tenses|Escoge tiempos verbales según secuencia y relevancia: past perfect sitúa un hecho anterior a otro pasado.|When I arrived, they had left.|Completa: She ___ (finish) before the exam started.|Had finished.
Conditionals and wishes|Los condicionales expresan posibilidades o hipótesis; wish puede expresar deseo sobre el presente o pasado.|If I had known, I would have called.|Completa: If I had studied, I ___ (pass).|Would have passed.
Passive and reported speech|La pasiva cambia el foco; el estilo indirecto reformula palabras ajenas respetando sentido y referencias.|He said, «I am ready» → He said he was ready.|Pasa a pasiva «They have built a school».|A school has been built.
Reading complex texts|Identifica postura, matices, ejemplos y posibles sesgos; una palabra de contraste puede cambiar la conclusión.|However introduce una objeción a lo anterior.|¿Qué indica «nevertheless»?|Contraste o concesión.
Essay writing|Plantea una tesis, desarrolla párrafos con evidencia y concluye sin añadir ideas nuevas.|A topic sentence presenta la idea de un párrafo.|¿Qué función cumple una topic sentence?|Presentar la idea central del párrafo.`);
  add('1.º Bachillerato', 'Física y Química', `Cinemática|Usa sistema de referencia, unidades y gráficas; distingue velocidad de aceleración.|En MRUA, v = v₀ + at.|Con v₀ = 2 m/s, a = 3 m/s² y t = 4 s, ¿v?|14 m/s.
Dinámica|Dibuja fuerzas antes de aplicar ΣF = m·a; diferencia masa de peso.|Un cuerpo de 2 kg con a = 5 m/s² tiene fuerza neta 10 N.|Calcula ΣF para 3 kg y 2 m/s².|6 N.
Energía y conservación|En un sistema ideal sin pérdidas, la energía mecánica se conserva; identifica transformaciones.|Al caer, la energía potencial disminuye y la cinética aumenta.|¿Qué ocurre con la energía potencial al subir una pelota?|Aumenta.
Estructura y enlace|La configuración electrónica ayuda a explicar tendencias periódicas y tipos de enlace.|El Na tiende a perder un electrón; el Cl a ganarlo.|¿Qué enlace predomina en NaCl?|Iónico.
Cantidad de sustancia|El mol cuenta entidades; la masa molar conecta gramos y moles.|18 g de agua equivalen aproximadamente a 1 mol de H₂O.|¿Cuántos moles son 36 g de agua? (18 g/mol)|2 mol.`);
  add('1.º Bachillerato', 'Geografía e Historia', `El mundo contemporáneo|Sitúa procesos históricos en su contexto y diferencia causa estructural de detonante inmediato.|La industrialización cambió producción, urbanización y relaciones laborales.|¿Es una fecha aislada suficiente para explicar un proceso?|No.
Revoluciones liberales|Compara demandas de derechos, formas de gobierno y participación política en distintos lugares.|Las constituciones limitaron algunos poderes absolutos.|Nombra un cambio asociado al liberalismo.|Constituciones o reconocimiento de derechos.
Imperialismo y descolonización|Analiza actores, intereses, resistencias y consecuencias con fuentes de distintas perspectivas.|El control colonial alteró economías y fronteras.|¿Por qué conviene estudiar fuentes locales?|Para incluir experiencias de las poblaciones afectadas.
Conflictos del siglo XX|Construye líneas temporales y separa propaganda de evidencia al explicar guerras y posguerras.|La Segunda Guerra Mundial terminó en 1945.|¿Qué ayuda a comprobar una afirmación histórica?|Fuentes contrastadas y contextualizadas.
Globalización actual|Relaciona comercio, tecnología, migraciones y problemas comunes sin asumir efectos iguales para todos.|Una cadena de producción puede repartir fases entre países.|Da un beneficio y un reto de esa interdependencia.|Intercambio y vulnerabilidad ante interrupciones.`);

  add('2.º Bachillerato', 'Matemáticas', `Matrices y determinantes|Una matriz organiza datos y permite representar sistemas; comprueba dimensiones antes de multiplicar.|Una matriz 2×3 puede multiplicar una 3×2, dando una 2×2.|¿Puede multiplicarse una 2×3 por una 2×2?|No, no coinciden dimensiones interiores.
Sistemas lineales|Analiza compatibilidad antes de resolver y expresa todas las soluciones cuando sean infinitas.|Dos ecuaciones proporcionales pueden describir la misma recta.|¿Cuántas soluciones tiene x + y = 2 y 2x + 2y = 4?|Infinitas.
Derivadas y optimización|Busca puntos críticos y contrasta extremos con el dominio y los límites del problema.|Para f(x) = −x² + 4x, f'(x) = −2x + 4; máximo en x = 2.|¿Dónde tiene máximo f(x) = −x² + 6x?|En x = 3.
Integrales|Una primitiva deshace la derivación; una integral definida calcula acumulación con límites.|∫ 2x dx = x² + C.|Calcula ∫ 3x² dx.|x³ + C.
Probabilidad y estadística|Modela sucesos con condiciones explícitas y decide si las variables son independientes antes de multiplicar.|P(A|B) = P(A∩B)/P(B) si P(B)>0.|Si A y B son independientes, ¿P(A∩B)?|P(A)·P(B).`);
  add('2.º Bachillerato', 'Lengua', `Comentario lingüístico|Analiza tema, intención, estructura y recursos con ejemplos del texto; evita limitarte a nombrar etiquetas.|Una pregunta retórica puede reforzar una postura sin buscar respuesta literal.|¿Qué prueba necesitas para afirmar que el tono es irónico?|Una expresión concreta interpretada en contexto.
Sintaxis de la oración compuesta|Distingue coordinación y subordinación y justifica el nexo y la función de cada proposición.|«Creo que vendrá»: «que vendrá» depende de «creo».|¿Qué tipo de relación hay en «Vino y habló»?|Coordinación copulativa.
Léxico y semántica|Explica significado en contexto, connotación y relaciones semánticas; una palabra puede cambiar de sentido según uso.|«Banco» puede ser asiento o entidad financiera.|¿Cómo resuelves una ambigüedad léxica?|Leyendo el contexto.
Literatura del siglo XX y XXI|Relaciona obra, movimiento y contexto; comenta forma y contenido sin memorizar resúmenes aislados.|La Generación del 27 reunió voces poéticas diversas con diálogo entre tradición y vanguardia.|¿Basta el año para explicar un poema?|No; analiza temas y recursos.
Redacción argumentativa|Defiende una postura con tesis precisa, razones y ejemplos, reconociendo límites o contraargumentos.|Una conclusión sintetiza, no introduce pruebas nuevas.|¿Qué debe hacer una conclusión?|Retomar y sintetizar la tesis.`);
  add('2.º Bachillerato', 'Inglés', `Reading and inference|Separa hechos explícitos, inferencias y actitud del autor; justifica respuestas con palabras del texto.|Although señala una concesión que puede matizar la idea principal.|¿Qué debes buscar para justificar una inferencia?|Pistas concretas del texto.
Vocabulary in context|El sentido de una palabra depende del contexto y de sus colocaciones habituales.|«Issue» puede significar asunto, problema o publicación según la frase.|¿Debe traducirse siempre una palabra igual?|No.
Grammar transformations|Al reformular, conserva significado y tiempo mientras cambia la estructura pedida.|I last saw her in 2020 → I haven't seen her since 2020.|Reformula «It is necessary to study» usando must.|You must study.
Formal and informal writing|Ajusta propósito, destinatario y registro; cada párrafo debe cumplir una función.|Una reclamación formal describe hechos, solicitud y cierre cortés.|¿Usarías «Hey!» al iniciar una carta formal?|No.
Opinion essay|Organiza tesis, desarrollo equilibrado y conclusión; enlaza ideas sin repetir conectores.|On the one hand… On the other hand… In conclusion…|Escribe una tesis breve sobre tecnología.|Respuesta abierta con postura clara.`);
  add('2.º Bachillerato', 'Física y Química', `Campos y fuerzas|Un campo asigna una magnitud a cada punto; dirección, sentido y unidades importan.|El campo gravitatorio apunta hacia la masa que lo crea.|¿Es el campo gravitatorio escalar o vectorial?|Vectorial.
Ondas y óptica|Distingue amplitud, frecuencia y longitud de onda; relaciona velocidad con frecuencia y longitud.|v = λf; con λ = 2 m y f = 3 Hz, v = 6 m/s.|Calcula v con λ = 0,5 m y f = 10 Hz.|5 m/s.
Equilibrio químico|En equilibrio, las reacciones directa e inversa continúan a igual velocidad; la composición es constante.|Cambiar concentración puede desplazar el equilibrio.|¿Equilibrio significa que la reacción se detiene?|No.
Ácidos y bases|pH ayuda a describir acidez; interpreta la escala y usa medidas de seguridad de laboratorio.|Una disolución con pH 3 es ácida.|¿Es básica una disolución con pH 11?|Sí.
Química orgánica|La estructura y grupos funcionales explican propiedades y reacciones de compuestos del carbono.|El etanol contiene un grupo hidroxilo −OH.|¿Qué grupo funcional caracteriza a los alcoholes?|Hidroxilo −OH.`);
  add('2.º Bachillerato', 'Geografía e Historia', `Fuentes históricas|Identifica autor, fecha, destinatario, propósito y contexto antes de sacar conclusiones.|Una ley es fuente primaria para estudiar decisiones de su época.|¿Por qué importa quién escribió un documento?|Puede revelar perspectiva e intención.
Historia contemporánea de España|Ordena etapas, causas y consecuencias; compara cambios políticos, sociales y económicos.|La Constitución de 1978 se sitúa en la Transición.|¿Fue la Transición anterior o posterior a la dictadura franquista?|Posterior.
Geografía física y humana|Relaciona relieve, clima, población y actividades; evita explicar fenómenos complejos con una sola causa.|La densidad de población varía por historia, economía y medio físico.|¿El clima explica por sí solo la distribución de población?|No.
Organización territorial|Distingue competencias y escalas de gobierno, usando mapas y fuentes institucionales actualizadas.|Un municipio y una comunidad autónoma tienen ámbitos distintos.|¿Qué escala es más cercana: municipio o Estado?|Municipio.
Retos demográficos y económicos|Interpreta tasas, pirámides y series temporales atendiendo a fuente, periodo y diferencias regionales.|Una pirámide con base estrecha puede indicar baja natalidad reciente.|¿Qué debes mirar antes de comparar dos gráficas?|Escala, periodo, fuente y unidades.`);

  window.PROFESOR_TEMARIO = catalogue;
})();

let temarioCourse = '3.º ESO';
let temarioSubject = 'Matemáticas';
let temarioQuery = '';
let temarioPreparation = 'all';
let temarioSelected = '';
let temarioView;
let openTemarioLesson;
const temarioNorm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
function temarioTopics() { return window.PROFESOR_TEMARIO?.[temarioCourse]?.[temarioSubject] || []; }
function temarioTopic(id) { return temarioTopics().find(topic => topic.id === id); }
function temarioMaterials(topic) {
  if (!topic) return [];
  const title = temarioNorm(topic.title);
  return state.library.filter(material => {
    if (material.subject !== temarioSubject) return false;
    const course = material.activity?.context?.course;
    if (course && temarioNorm(course) !== temarioNorm(temarioCourse)) return false;
    const name = temarioNorm(material.activity?.context?.topic || material.title);
    return name && (name.includes(title) || title.includes(name)) && Math.min(name.length, title.length) >= 6;
  });
}
function temarioVisibleTopics() {
  const query = temarioNorm(temarioQuery);
  return temarioTopics().filter(topic => (!query || temarioNorm(topic.title + ' ' + topic.explanation).includes(query)) && (temarioPreparation === 'all' || (temarioMaterials(topic).length > 0) === (temarioPreparation === 'ready')));
}
function planTemarioWithStudent(topic) {
  const pupils = state.students.filter(pupil => temarioNorm(pupil.course) === temarioNorm(temarioCourse) && pupil.subjects.includes(temarioSubject));
  if (!pupils.length) { notify('No hay alumnos de este curso y asignatura. Puedes crear una actividad general.'); return; }
  modal('Planificar · ' + topic.title, `<p>Se añadirá a tus tareas como recordatorio para trabajar este tema con un alumno. No se enviará a ninguna cuenta del alumno.</p><label for="temarioStudent">Alumno</label><select id="temarioStudent" name="studentId">${pupils.map(pupil => `<option value="${esc(pupil.id)}">${esc(pupil.name)}</option>`).join('')}</select><label for="temarioDue">Fecha (opcional)</label><input id="temarioDue" name="due" type="date">${submit('Añadir a mi plan')}`, form => {const pupil = student(form.get('studentId'));state.tasks.push({id:uid(),title:'Trabajar ' + topic.title,studentId:pupil.id,priority:'Normal',due:form.get('due') || '',done:false});save();render();notify('Tema añadido a tus tareas para ' + pupil.name);});
}
document.addEventListener('change', event => {
  if (event.target.id === 'temarioCourse') { temarioCourse = event.target.value; temarioSubject = Object.keys(window.PROFESOR_TEMARIO?.[temarioCourse] || {})[0] || '';temarioSelected = '';render(); }
  if (event.target.id === 'temarioSubject') { temarioSubject = event.target.value;temarioSelected = '';render(); }
  if (event.target.id === 'temarioPreparation') { temarioPreparation = event.target.value;temarioSelected = '';render(); }
});
document.addEventListener('input', event => {
  if (event.target.id !== 'temarioSearch') return;
  temarioQuery = event.target.value;
  const cursor = event.target.selectionStart;
  render();
  $('temarioSearch')?.focus();
  $('temarioSearch')?.setSelectionRange(cursor, cursor);
});
document.addEventListener('click', event => {
  const subjectButton = event.target.closest('[data-temario-subject]');
  if (subjectButton) { temarioSubject = subjectButton.dataset.temarioSubject;temarioSelected = '';render();return; }
  const topicButton = event.target.closest('[data-temario-topic]');
  if (topicButton) { temarioSelected = topicButton.dataset.temarioTopic;render();return; }
  const actionButton = event.target.closest('[data-temario-action]');
  if (!actionButton) return;
  const action = actionButton.dataset.temarioAction;
  if (action === 'reveal') {const answer = actionButton.nextElementSibling;answer.hidden = !answer.hidden;actionButton.textContent = answer.hidden ? 'Mostrar solución' : 'Ocultar solución';return;}
  const topic = temarioTopic(actionButton.dataset.id);
  if (!topic) return;
  if (action === 'open') openTemarioLesson(topic);
  if (action === 'create') {if ($('dialog').open) $('dialog').close();openWorkshop({course:temarioCourse,subject:temarioSubject,topic:topic.title});}
  if (action === 'plan') planTemarioWithStudent(topic);
});

/* Una ficha rica por tema; la navegación solo muestra lo imprescindible. */
const temarioActivityTypes = (subject, title) => {
  const name = temarioNorm(title);
  if (subject === 'Matemáticas') return /ecuacion|fraccion|operacion|calculo|derivada|integral/.test(name) ? ['gaps', 'problem', 'error'] : ['problem', 'quiz', 'short'];
  if (subject === 'Inglés') return /reading|writing|text|essay/.test(name) ? ['reading', 'short', 'error'] : /vocab|word|family|colour|number/.test(name) ? ['pairs', 'flashcard', 'memory'] : ['gaps', 'sentence', 'quiz'];
  if (subject === 'Lengua') return /lectur|comprensi|cuento|texto|comentario/.test(name) ? ['reading', 'short', 'quiz'] : ['short', 'error', 'order'];
  if (subject === 'Geografía e Historia') return ['timeline', 'order', 'quiz'];
  if (subject === 'Física y Química') return /calculo|movimiento|fuerza|energia/.test(name) ? ['problem', 'quiz', 'error'] : ['classify', 'quiz', 'short'];
  return ['classify', 'quiz', 'short'];
};
const temarioCommonError = (subject, title) => {
  const name = temarioNorm(title);
  if (/ecuacion/.test(name)) return 'Cambiar un término de lado sin aplicar la misma operación a ambos miembros o no comprobar la solución.';
  if (/fraccion/.test(name)) return 'Operar numeradores y denominadores por separado cuando se suman fracciones.';
  if (/porcent/.test(name)) return 'Confundir la cantidad inicial con la cantidad después del cambio porcentual.';
  if (subject === 'Matemáticas') return 'Aplicar una fórmula antes de identificar los datos, las unidades y lo que se pide.';
  if (subject === 'Inglés') return 'Traducir palabra por palabra sin comprobar el tiempo verbal y el contexto de la frase.';
  if (subject === 'Lengua') return 'Nombrar una regla o recurso sin justificarlo con una parte concreta del texto.';
  if (subject === 'Geografía e Historia') return 'Explicar un proceso por una sola causa sin situarlo en su época y lugar.';
  if (subject === 'Física y Química' || subject === 'Ciencias Naturales') return 'Confundir una observación con su explicación sin contrastarla con los datos.';
  return 'Memorizar el ejemplo sin entender cuándo se aplica la idea.';
};
for (const [course, subjects] of Object.entries(window.PROFESOR_TEMARIO)) {
  for (const [subject, topics] of Object.entries(subjects)) {
    for (const topic of topics) {
      topic.didactic = {
        objective: `Explicar ${topic.title.toLocaleLowerCase()} y aplicarlo en una situación adecuada a ${course}.`,
        explanation: topic.explanation,
        concepts: topic.explanation.split(/[.;]/).map(part => part.trim()).filter(part => part.length > 12).slice(0, 3),
        examples: [topic.example],
        commonErrors: [temarioCommonError(subject, topic.title)],
        practice: [{prompt: topic.question, answer: topic.answer}],
        activities: temarioActivityTypes(subject, topic.title),
        solutions: [topic.answer]
      };
    }
  }
}

temarioView = function () {
  const courses = Object.keys(window.PROFESOR_TEMARIO || {});
  if (!courses.includes(temarioCourse)) temarioCourse = courses[0] || '';
  const subjects = Object.keys(window.PROFESOR_TEMARIO?.[temarioCourse] || {});
  if (!subjects.includes(temarioSubject)) temarioSubject = subjects[0] || '';
  const topics = temarioVisibleTopics();
  if (!topics.some(topic => topic.id === temarioSelected)) temarioSelected = topics[0]?.id || '';
  const current = topics.find(topic => topic.id === temarioSelected);
  return `<div class="temario-page temario-simple">
    <div class="temario-controls" aria-label="Buscar en el temario">
        <label for="temarioCourse">Curso<select id="temarioCourse">${courses.map(course => `<option value="${esc(course)}" ${course === temarioCourse ? 'selected' : ''}>${esc(course)}</option>`).join('')}</select></label>
        <label for="temarioSubject">Asignatura<select id="temarioSubject">${subjects.map(item => `<option value="${esc(item)}" ${item === temarioSubject ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></label>
        <label for="temarioSearch">Buscar tema<input id="temarioSearch" type="search" value="${esc(temarioQuery)}" placeholder="Buscar tema…" autocomplete="off"></label>
        <label for="temarioPreparation">Preparación<select id="temarioPreparation"><option value="all" ${temarioPreparation === 'all' ? 'selected' : ''}>Todos</option><option value="ready" ${temarioPreparation === 'ready' ? 'selected' : ''}>Con material</option><option value="pending" ${temarioPreparation === 'pending' ? 'selected' : ''}>Por preparar</option></select></label>
        <span class="temario-base-count">${Object.values(window.PROFESOR_TEMARIO || {}).reduce((total, bySubject) => total + Object.values(bySubject).reduce((sum, list) => sum + list.length, 0), 0)} temas de base</span>
    </div>
    <div class="temario-stage">
      <section class="temario-list-panel" aria-label="Temas de ${esc(temarioSubject)}">
        <div class="temario-topic-list">${topics.map(topic => `<button type="button" class="temario-topic ${topic.id === temarioSelected ? 'active' : ''}" data-temario-topic="${esc(topic.id)}" aria-current="${topic.id === temarioSelected ? 'true' : 'false'}"><span class="temario-topic-index">${String(temarioTopics().indexOf(topic) + 1).padStart(2, '0')}</span><span class="temario-topic-copy"><strong>${esc(topic.title)}</strong><small>${esc(topic.explanation)}</small></span><span class="temario-topic-meta"><small>3 recursos</small></span><span class="temario-topic-arrow">→</span></button>`).join('') || '<div class="temario-empty">No hay temas con esa búsqueda.</div>'}</div>
      </section>
      <aside class="temario-detail" aria-label="Previsualización del tema"><h2 class="temario-preview-title">Vista previa</h2>${current ? `<h3>${esc(current.title)}</h3><p class="temario-preview-meta">${esc(temarioSubject)} · ${esc(temarioCourse)}</p><p class="temario-preview-explanation">${esc(current.explanation)}</p><div class="temario-example"><strong>Ejemplo</strong><p>${esc(current.example)}</p></div><p class="temario-includes"><strong>Incluye</strong><br>Explicación · Ejemplo · Práctica</p><div class="temario-main-actions"><button type="button" class="primary" data-temario-action="open" data-id="${esc(current.id)}">Ver tema</button><button type="button" data-temario-action="use" data-id="${esc(current.id)}">Usar en material</button></div>` : '<p>Selecciona un tema para ver un resumen.</p>'}</aside>
    </div>
  </div>`;
};

openTemarioLesson = function (topic) {
  const content = topic.didactic;
  modal(topic.title, `<div class="temario-lesson"><p class="temario-lesson-meta">${esc(temarioSubject)} · ${esc(temarioCourse)}</p>
    <section class="temario-lesson-intro"><h3>Explicación</h3><p>${esc(content.explanation)}</p></section>
    <section class="temario-lesson-example"><h3>Ejemplo resuelto</h3><p>${esc(content.examples[0])}</p></section>
    <section class="temario-lesson-practice"><h3>Practica</h3><p>${esc(content.practice[0].prompt)}</p><div class="actions"><button type="button" class="primary" data-temario-action="practice" data-id="${esc(topic.id)}">Practicar ahora</button></div><details><summary>Ver solución orientativa</summary><p class="temario-lesson-answer">${esc(content.solutions[0])}</p></details></section>
    <details class="temario-extra"><summary>Más contenido</summary><div><h4>Objetivo</h4><p>${esc(content.objective)}</p><h4>Conceptos clave</h4><ul>${content.concepts.map(concept => `<li>${esc(concept)}</li>`).join('')}</ul><h4>Error frecuente</h4><p>${esc(content.commonErrors[0])}</p></div></details>
    <div class="temario-lesson-footer"><button type="button" data-temario-action="use" data-id="${esc(topic.id)}">Usar en material</button>${button('Cerrar', 'close')}</div>
  </div>`, () => {});
  $('dialog').classList.add('temario-dialog');
  $('dialog').addEventListener('close', () => $('dialog').classList.remove('temario-dialog'), {once: true});
};

function temarioUseInMaterial(topic) {
  if ($('dialog').open) $('dialog').close();
  const pupils = state.students.filter(pupil => pupil.subjects.includes(temarioSubject));
  modal('Usar en material', `<p>El curso, la asignatura y el tema ya están preparados. Elige para quién será el material.</p><label for="temarioOwner">¿Para quién?</label><select id="temarioOwner" name="studentId"><option value="">Material general</option>${pupils.map(pupil => `<option value="${esc(pupil.id)}">${esc(pupil.name)}</option>`).join('')}</select>${submit('Continuar a Materiales')}`, form => {
    const pupil = student(form.get('studentId'));
    const course = pupil?.course || temarioCourse;
    const subject = temarioSubject;
    const type = topic.didactic.activities[0];
    selected = null; view = 'Biblioteca'; render();
    setTimeout(() => {
      const suggested = Object.fromEntries(Object.keys(activityLabels).map(key => [key, key === type ? 3 : 0]));
      openWorkshop({course, subject, topic: topic.title, theme: pupil?.interests || '', ...suggested});
      if (pupil) {
        const selector = $('workshopStudent');
        selector.value = pupil.id;
        selector.dispatchEvent(new Event('change', {bubbles: true}));
        $('workshopCourse').value = course;
        $('workshopSubject').value = subject;
        $('workshopTopic').value = topic.title;
        $('workshopTopic').dispatchEvent(new Event('input', {bubbles: true}));
      }
    }, 0);
  });
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-temario-action="use"],[data-temario-action="practice"]');
  if (!button) return;
  const topic = temarioTopic(button.dataset.id);
  if (!topic) return;
  if (button.dataset.temarioAction === 'use') temarioUseInMaterial(topic);
  else {
    if ($('dialog').open) $('dialog').close();
    const question = topic.didactic.practice[0];
    const material = {id: `temario-${topic.id}`, title: topic.title, subject: temarioSubject, activity: {version: 1, context: {course: temarioCourse, subject: temarioSubject, topic: topic.title}, questions: [{id: `q-${topic.id}`, type: 'short', prompt: question.prompt, answer: question.answer, text: '', options: []}]}};
    setTimeout(() => runActivity(material, ''), 0);
  }
});
