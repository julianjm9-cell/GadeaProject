# Rediseño de los 61 juegos avanzados

> Actualizado el 30 de octubre de 2026. Este inventario cubre los 61 juegos destacados de Profesor Particular. Los juegos 1, 5, 9, 12, 18, 26, 33, 36, 39, 42, 47 y 55 ya tienen un tablero ilustrado con respuestas integradas; las demás propuestas siguen pendientes. El plan de las 65 misiones de ESO Adultos y los criterios compartidos están en [plan-juegos-avanzados-profesor-eso.md](../docs/plan-juegos-avanzados-profesor-eso.md).

## Diagnóstico

Los 61 juegos tienen contenido y respuestas definidos, pero la presentación se apoya en mecánicas compartidas. Ya hay fondos y objetos temáticos en parte del CSS y de los tableros. Aun así, muchas respuestas siguen apareciendo en tarjetas o paneles que podrían intercambiarse entre juegos. En algunos casos el escenario reutilizado no representa la acción propuesta. Para convertirlos en juegos, el tablero debe contar visualmente qué se hace, dónde se responde y qué cambia al acertar.

Cada rediseño debe conservar la pregunta, la respuesta y la corrección existentes. Las imágenes serán escenarios sin texto ni respuestas impresas; las zonas interactivas serán HTML colocado sobre el escenario, con alternativa táctil y de teclado. El tablero tendrá un estado inicial, progreso visible, estados correcto/incorrecto, una pista breve y cierre. Se probará en la vista del profesor y en la sesión del alumno, en escritorio y móvil. Ninguna acción principal debe quedar debajo del pliegue en una ventana habitual de portátil.

## Bloque 1 · Colocar y clasificar (10)

**Bloque completo:** juegos 1, 12, 18 y 26 sitúan sus destinos sobre vagones, cuaderno de campo, bandejas y dossier de comunicación. Los juegos 33, 36, 39 y 42 usan estaciones de medición, cajones, un mapa de actividades y diagramas de proposiciones. Los juegos 47 y 55 usan canales de comunicación y vitrinas de archivo. Comparten selección táctil o con teclado, arrastre, corrección y un diseño adaptado a móvil.

Motor actual: arrastrar tarjetas a contenedores. Cambio común: los destinos pasan a ser objetos reconocibles del escenario, con selección por toque/clic además de arrastre.

| N.º | Juego | Tablero y acción propuesta |
| --- | --- | --- |
| 1 | El tren de las decenas | **Tren de verdad** ocupando el ancho útil: locomotora, vagones numerados con ventanas y enganches. Las cargas de decenas y unidades son cajas que se colocan **dentro del vagón correcto**; el vagón se ilumina y el tren avanza al completar la composición. |
| 12 | El bosque vivo | Tres zonas naturales del bosque, identificadas como nutrición, relación y reproducción. Cada observación es una ficha de campo que se coloca sobre la zona o el ser vivo correspondiente, no en tres rectángulos flotantes. |
| 18 | La redacción de titulares | Mesa de periódico con bandejas de **Sujeto** y **Predicado** y una maqueta de portada. Cada recorte se coloca físicamente en su bandeja; el titular se recompone al acertar. |
| 26 | La central de mensajes | Dos comunicaciones visibles como correo y aviso. Los elementos de emisor, receptor, canal y mensaje se colocan directamente en los espacios de cada comunicación. |
| 33 | El laboratorio de medidas | Mesa con instrumentos y cuatro estaciones de medida. Cada tarjeta se deposita en la estación de su magnitud; se muestra el instrumento y la unidad pertinente. |
| 36 | El archivo de los sintagmas | Archivadores rotulados por tipo de sintagma. Los fragmentos son fichas lingüísticas que se deslizan a un cajón; el cajón muestra la frase completa al cerrarse. |
| 39 | La ciudad de los sectores | Mapa urbano con áreas de cultivo, fábrica y servicios. Las actividades económicas se colocan sobre edificios y zonas del mapa, de modo que la clasificación tenga sentido espacial. |
| 42 | La redacción de las compuestas | Taller de frases con conexiones visuales entre proposiciones. Cada oración se sitúa en el diagrama de coordinación, subordinación o yuxtaposición, con la relación destacada. |
| 47 | La central de los registros | Panel de conversaciones en diferentes contextos. Los mensajes se envían a canales de registro formal, informal o especializado; cada canal conserva su ejemplo contextual. |
| 55 | La hemeroteca de las fuentes | Archivo con vitrinas de fuente primaria, secundaria, escrita, oral o material. Cada documento se coloca en la vitrina adecuada y muestra su procedencia al acertar. |

## Bloque 2 · Recorrer, comprar y experimentar (15)

**Primer pack implementado:** juegos 5 y 9. El mercado integra la selección en tres bandejas de monedas del puesto; el observatorio la integra en tres lentes del astrolabio. Ambos conservan seis paradas, corrección y navegación accesible.

Motor actual: seis paradas y tres respuestas genéricas. Cambio común: las paradas serán lugares del escenario y la respuesta actuará sobre el objeto de la misión. No usar la misma «pista» dibujada para mercado, cocina y observatorio.

| N.º | Juego | Tablero y acción propuesta |
| --- | --- | --- |
| 5 | El mercado de las monedas | Calle de mercado con puestos sucesivos, productos y monedero. En cada compra se eligen monedas o cambio **sobre el mostrador**; la bolsa se llena y el personaje pasa al siguiente puesto. |
| 9 | El observatorio de los números | Cúpula astronómica con seis lentes/constelaciones. Al seleccionar el valor posicional correcto, la cifra se enfoca dentro del telescopio y se ilumina la constelación correspondiente. |
| 16 | El laboratorio de mezclas | Seis mesas con mezclas visibles. La respuesta es el instrumento o procedimiento que se aplica a la muestra; la mezcla se separa visualmente antes de abrir la siguiente mesa. |
| 17 | La feria de los porcentajes | **Casetas con forma real de caseta**, letreros y premios sobre estantes. La operación se muestra en un cartel de oferta; se toca el precio/premio correcto dentro de la caseta y se obtiene un sello para pasar a la siguiente. |
| 25 | La ruta bajo cero | Teleférico y montaña con una escala vertical de alturas positivas y negativas. Cada operación mueve la cabina al nivel elegido, con el cero marcado físicamente en la ladera. |
| 30 | La cocina de los racionales | Recetario, ingredientes y recipientes medidos. Las respuestas modifican cantidades de una receta visible; completar una preparación abre la siguiente, sin convertir la cocina en una pista abstracta. |
| 35 | El mercado de los porcentajes | Encargos comerciales con etiqueta original, descuento/impuesto y caja registradora. Se elige el importe en el terminal del puesto y se entrega un recibo correcto. Diferente del mercado infantil. |
| 41 | La torre de los radicales | Torre de observación con plantas numeradas por reto; simplificar radicales abre la compuerta de cada piso. Resultados y pasos se leen en un panel matemático, no flotando sobre la ilustración. |
| 44 | La pista del movimiento | Pista con tramos, distancia y tiempo señalados. La respuesta ajusta una magnitud en el marcador; un móvil recorre el tramo solo al escoger valor **y unidad** correctos. |
| 46 | El observatorio complejo | Plano complejo con eje real e imaginario. Cada respuesta coloca el punto/resultado en el plano y desbloquea la siguiente operación; no reutilizar el observatorio infantil. |
| 49 | La ruta de cinemática | Laboratorio de movimiento con sensores, cronómetro y gráfica. Cada valor calculado configura un sensor y dibuja el tramo de la gráfica; distinguirlo de la pista de 4.º ESO. |
| 51 | La cámara de matrices | Cámara de paneles matriciales: la operación elegida activa celdas de una matriz y abre una puerta. Mostrar las matrices y el cálculo en el tablero, no solo una terna de botones. |
| 54 | El observatorio de las ondas | Banco óptico con emisor, regla de longitud de onda y frecuencia. Al resolver cada dato, la onda se calibra visualmente y se ilumina una estación. |
| 58 | La crónica del pasado | Cuaderno de viaje con escenas fechadas. Cada forma verbal elegida se inserta en la escena y hace avanzar la narración en la línea temporal. |
| 60 | La central de los matices | Sala de interpretación con mensajes de voz/texto y medidor de intención. La respuesta sitúa el mensaje en una escala de certeza, duda, ironía o compromiso. |

## Bloque 3 · Tableros de pistas (10)

Motor actual: bingo 3 × 3. Cambio común: conservar la lógica de localizar conceptos, pero sustituir el mismo cartón por una superficie de búsqueda propia y fichas que se marcan dentro de ella.

| N.º | Juego | Tablero y acción propuesta |
| --- | --- | --- |
| 11 | El aeropuerto de los hábitos | Panel de salidas con nueve vuelos/frases; la pista es un anuncio de megafonía y se valida el vuelo correcto. |
| 24 | El atlas del cuerpo humano | Silueta y láminas de niveles de organización; la pista activa la estructura correcta sobre el atlas. |
| 29 | El atlas del explorador | Mapa grande con leyenda, rosa de los vientos, escala y coordenadas como puntos seleccionables. |
| 31 | La central de las explicaciones | Página de texto expositivo con piezas localizables; se resalta el bloque textual al identificarlo. |
| 34 | El mapa de las migraciones | Mapa con flujos y conceptos fijados como etiquetas; las pistas encienden la región o flujo adecuado. |
| 38 | El laboratorio del átomo | Modelo atómico interactivo; cada pista se resuelve señalando la partícula, capa o propiedad concreta. |
| 40 | El atlas de la nutrición | Lámina de sistemas del cuerpo conectados por rutas; se marca el órgano o proceso correcto sobre la ruta. |
| 45 | La asamblea de las revoluciones | Mesa de documentos y mural de ideas históricas; cada pista apunta a un concepto en el mural. |
| 50 | El archivo contemporáneo | Cronología mural con expedientes; se coloca un sello sobre el proceso histórico correspondiente. |
| 52 | La sala del comentario | Fragmento de texto ampliado con anotaciones marginales; cada recurso lingüístico se señala en el propio texto. |

## Bloque 4 · Elegir, editar e interpretar (10)

Motor actual: multiselección en tarjetas. Cambio común: situar cada alternativa en el soporte donde se leería realmente y dejar visible qué selección está pendiente de comprobar.

| N.º | Juego | Tablero y acción propuesta |
| --- | --- | --- |
| 14 | La isla de las tildes | Palabras sobre señales/rocas de la isla; se rescatan con un toque solo las que necesitan tilde. Al verificar, la tilde aparece en su lugar. |
| 27 | El estudio de los hábitos | Guion de un programa sobre rutinas con frases en sus viñetas; se seleccionan las emisiones correctas. |
| 32 | El cine del pasado | Guion y fotogramas en una mesa de edición; se eligen líneas gramaticalmente válidas y se incorporan al montaje. |
| 37 | El diario de los viajes | Entradas fechadas en páginas de diario, con postales/fotos; marcar frases correctas directamente en cada entrada. |
| 43 | El portal de los condicionales | Dos paneles conectados, condición y consecuencia; se eligen las parejas de frases válidas antes de abrir el portal. |
| 48 | El estudio de los tiempos | Línea de tiempo con escenas pasadas, presentes y futuras; las oraciones se validan respecto a la escena mostrada. |
| 53 | La biblioteca de inferencias | Texto fuente siempre visible en una página y conclusiones en notas adhesivas; seleccionar solo las inferencias sustentadas. |
| 57 | El álbum de los recuerdos | Fotografías con pies de foto; se aceptan únicamente los pies de foto gramaticalmente adecuados. |
| 59 | El puente del subjuntivo | Orillas de hecho y deseo/hipótesis; las oraciones correctas construyen tramos del puente. |
| 61 | La redacción de las interpretaciones | Frase ambigua en el centro de una mesa editorial; cada reformulación se acepta si aclara una interpretación legítima. |

## Bloque 5 · Emparejar y ordenar (9)

Motores actuales: memory, construcción de frases y líneas temporales. Cambio común: mover tarjetas y piezas a objetos narrativos reconocibles, sin perder la opción de teclado y táctil.

| N.º | Juego | Tablero y acción propuesta |
| --- | --- | --- |
| 2 | La fábrica de palabras | Cinta transportadora con tarjetas-palabra y segmentos silábicos; cada pareja correcta se une y sale de la fábrica. |
| 3 | La mochila bilingüe | Mochila abierta con bolsillos y objetos de aula; emparejar imagen/nombre para guardar cada objeto en su bolsillo. |
| 19 | El portal al pasado | Dos marcos de tiempo, presente y pasado; unir cada verbo con su forma pretérita hace cruzar la pareja. |
| 56 | La plaza de los saludos | Personajes situados en una plaza; destapar pregunta y respuesta en bocadillos de diálogo emparejados. |
| 7 | Safari en el parque | Escena con animal/objeto visible; ordenar palabras en un bocadillo asociado a lo que se está señalando. |
| 15 | La ciudad de las direcciones | Mapa de calles y destino; ordenar instrucciones provoca que una ruta se dibuje sobre las calles reales. |
| 23 | La estación de los tiempos | Andenes de presente/pasado/futuro; ordenar la frase en un billete y enviarlo al andén correcto. |
| 8 | El jardín de la mariposa | Etapas del ciclo como estaciones del jardín; colocar huevo, oruga, crisálida y mariposa sobre el recorrido circular. |
| 28 | El invernadero científico | Mesa de investigación con pregunta, hipótesis, experimento y conclusión; ordenar las fases en el cuaderno de laboratorio. |

## Bloque 6 · Mecánicas propias (7)

Estas actividades no deberían heredar un tablero genérico. Cada una necesita una composición específica.

| N.º | Juego | Tablero y acción propuesta |
| --- | --- | --- |
| 4 | Exploradores de los sentidos | Cinco misterios como estaciones del cuerpo/sentidos. Escribir cada respuesta en la etiqueta vacía junto al órgano, con una animación corta al resolverla. |
| 6 | Detectives de los signos | Mensajes impresos con el signo o mayúscula ausente; editar exactamente el hueco de la línea, con lupa y pista de corrección. |
| 10 | La biblioteca secreta | Estantería con seis libros cerrados; cada acertijo abre uno y revela una letra de una clave final dentro de un libro mayor. |
| 22 | La agencia de las oraciones | Seis expedientes gramaticales; resolver la pista sella el expediente y forma una clave en la mesa de investigación. |
| 13 | La cocina de las fracciones | Recetario interactivo: cada fila es una receta con numerador/denominador en ingredientes medidos; introducir valores en la propia ficha. |
| 21 | El observatorio de los decimales | Tanques graduados con fracción, decimal y porcentaje; completar valores directamente en indicadores conectados al mismo tanque. |
| 20 | El taller de los circuitos | Banco con pila, cable, bombilla y distractor representados como piezas del circuito; retirar la pieza intrusa permite encender la bombilla. |

## Orden recomendado

1. **Bloque 1 (10)** para resolver el ejemplo del tren y establecer el sistema de objetos-destino.
2. **Bloque 2 (15)** para las casetas, mercados y rutas; es el grupo más numeroso y visible.
3. **Bloque 5 (9)** para hacer memorias, frases y secuencias más táctiles.
4. **Bloque 3 (10)** para sustituir el cartón genérico por tableros de búsqueda.
5. **Bloque 4 (10)** para integrar la lectura y las respuestas en guiones, mapas y documentos.
6. **Bloque 6 (7)** para los tableros de diseño específico.

Antes de pasar de un bloque al siguiente, revisar al menos una partida completa de cada juego, una respuesta correcta e incorrecta, una pantalla pequeña y el acceso del alumno con código. Así evitamos dar por terminado un juego solo porque tenga una imagen atractiva.
