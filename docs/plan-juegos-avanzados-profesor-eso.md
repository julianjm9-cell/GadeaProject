# Plan de rediseño de juegos avanzados · Profesor Particular y ESO Adultos

30 de octubre de 2026 · **Planificación, con el primer pack de Profesor Particular ya implementado.**

## Qué hay realmente

- **Profesor Particular:** 61 juegos públicos destacados con contenido y corrección definidos. El [inventario con una propuesta para cada uno](../design-previews/plan-juegos-avanzados.md) está organizado por mecánica. Hay fondos, colores y algunos objetos temáticos, pero el mismo componente de respuesta se repite en bastantes escenas. También hay **15 formatos avanzados** que un profesor puede crear: Pasapalabra, Ahorcado, Sopa de letras, Memory, Flashcards, Construye la frase, Línea temporal, Encuentra el error, Crucigrama, Arrastrar y soltar, Misterio, Intruso, Bingo, Descifra el mensaje y Carrera. Estos formatos no son otros 15 juegos públicos de contenido fijo: necesitan temas visuales adaptables a cualquier material.
- **ESO Adultos:** 65 misiones propias, una por tema, repartidas en Inglés (9), Lengua (11), Geografía (10), Historia y Ciudadanía (11), Matemáticas (12), y Ciencias y Tecnología (12). Cada misión tiene cuatro etapas y una respuesta comprobable. Las 56 misiones que declaran imagen propia usan 35 archivos diferentes; nueve misiones de Inglés toman el arte de su tema. Todas comparten en esencia un panel de tres respuestas sobre un fondo, así que la imagen aún no explica suficientemente la acción.
- Los juegos externos enlazados y los dos juegos básicos por tema de ESO Adultos quedan fuera de este rediseño de **avanzados**. La corrección y los resultados actuales deben conservarse.

## Patrón de entrega de cada juego

1. **Escena diseñada para la misión**, con huecos libres donde se colocará la interfaz. Ilustración raster sin texto ni respuestas incrustadas, optimizada y con versión/corte para móvil cuando haga falta.
2. **Objetos jugables sobre la escena**: mapa, mostrador, libro, máquina, documento, herramienta o personaje. La pregunta y las opciones aparecen en el objeto al que pertenecen, con áreas táctiles reales en HTML. No colocar tres botones idénticos sobre cualquier fondo.
3. **Efecto causal** al acertar: avanza la ruta, se abre el libro, se ilumina el circuito, se completa la factura. El error deja una pista breve y permite corregir, sin enseñar la solución antes de tiempo.
4. **Primera partida comprensible sin instrucciones largas**: objetivo en una frase, zona de respuesta evidente, progreso visible y control claro para salir o volver. Ratón, tacto y teclado; texto y estado además del color.
5. **Comprobación**: contenido académico, respuesta correcta e incorrecta, sesión del alumno cuando aplique, escritorio de portátil (incluido 1366 × 768), móvil, zoom de navegador y ausencia de barras de scroll internas innecesarias. Mantener los identificadores de juego y resultados guardados.

La primera versión de un pack debe incluir una captura antes/después por juego y una partida completa. La imagen debe apoyar la comprensión; si tapa texto o reduce el tablero, se rehace la composición.

## Profesor Particular · 61 juegos destacados

Las 61 propuestas individuales están en el [plan detallado existente](../design-previews/plan-juegos-avanzados.md). Agrupación de trabajo:

| Pack | Juegos | Resultado visual buscado |
| --- | ---: | --- |
| P1 · Colocar y clasificar | 10 | Vagones, bosque, periódicos, mensajes, instrumentos, archivadores, ciudad, oraciones, registros y fuentes como destinos físicos. |
| P2 · Recorrer y experimentar | 15 | Mercado, observatorio, laboratorio, feria, montaña, cocina, pista, matrices, ondas y relato con etapas dentro del escenario. |
| P3 · Emparejar y ordenar | 9 | Fábrica, mochila, portal, plaza, safari, calles, estación, jardín e invernadero con piezas ligadas a objetos visibles. |
| P4 · Encontrar pistas | 10 | Aeropuerto, cuerpo humano, mapas, textos, átomo, nutrición, asamblea y archivo como tableros señalables. |
| P5 · Elegir e interpretar | 10 | Isla, estudio, cine, diario, portal, biblioteca, álbum, puente y redacción con alternativas insertadas en documentos o escenas. |
| P6 · Mecánicas propias | 7 | Sentidos, signos, biblioteca, agencia, fracciones, decimales y circuitos con composición específica. |

**Formatos creados por profesores:** al terminar P1–P6, preparar tres variantes visuales por formato (infantil, adolescente y neutral) que se ajusten a contenidos de longitud variable. Para Pasapalabra, Ahorcado, Sopa, Memory, Flashcards, Frase, Línea temporal, Error y Crucigrama, partir de las interfaces actuales y mejorar el objeto central. Para Arrastrar, Misterio, Intruso, Bingo, Descifra y Carrera, crear plantillas de escenario que el profesor pueda elegir. Una ilustración de los 61 juegos públicos no debe imponerse automáticamente a materiales privados de otra temática.

## ESO Adultos · plan para cada una de las 65 misiones

En estas tablas, **escena → respuesta** describe la ilustración necesaria y el objeto exacto donde interactúa el usuario. Las cuatro etapas y la corrección existentes siguen siendo la fuente de contenido.

### E1 · Inglés (9)

| Misión | Escena → respuesta integrada |
| --- | --- |
| La pista del horario | Biblioteca y tablón con horario, aviso de préstamo y plano de la planta. Se pulsa el dato del aviso y la ruta de Maya se ilumina hasta la sala de estudio. |
| Una mañana en la ciudad | Calle con cafetería, estación, oficina y centro de salud. Cada expresión se ofrece como bocadillo junto a la persona o el mostrador correspondiente. |
| El calendario de Alex | Calendario con «cada día», «ayer», «desde hace cinco años» y «mañana». La forma verbal elegida se inserta en la casilla temporal antes de pasar a la siguiente. |
| Un correo para pedir información | Interfaz de correo ilustrada con campos de saludo, motivo, pregunta y despedida. El mensaje se compone línea por línea y queda listo para enviar. |
| En el punto de información | Plano de calle y ventanilla. La frase elegida aparece en el diálogo y se dibuja la dirección indicada. Es práctica **de lectura**, pues hoy no existe audio real. |
| Cuatro conversaciones | Cuatro microescenas de tienda, consulta, estación y despedida. La elección completa el bocadillo de la persona, con respuesta visible en el contexto. |
| Prepara el viaje | Panel de salidas, billete y formulario de reserva. Cada dato seleccionado se introduce en su campo real; se confirma el billete al terminar. |
| Ordena el mensaje | Nota dividida en cuatro líneas. Los conectores se colocan en el hueco de inicio, causa, contraste y cierre; se ve el texto final coherente. |
| Misión de examen | Mesa de examen con enunciado, texto, respuesta y revisión. Se marca la decisión correcta en el papel y se sellan las cuatro fases. |

### E2 · Lengua Castellana (11)

| Misión | Escena → respuesta integrada |
| --- | --- |
| Lee entre líneas | Aviso legible en el centro, lupa sobre dato, deducción y evidencia. La respuesta se anota al margen del fragmento pertinente. |
| Reduce sin perder la idea | Mesa de edición con texto largo y tarjeta de resumen. Se descartan detalles y queda la idea esencial en una tarjeta más breve. |
| Desmonta la oración | Frase sobre una mesa de análisis. Se tocan sustantivo, sujeto, predicado y tiempo en el propio renglón; las partes se colorean con etiqueta textual. |
| Revisa antes de enviar | Borrador de mensaje con tilde, coma y letra editables en su sitio. Cada corrección se ve sobre la línea antes de pulsar Enviar. |
| Escribe una petición clara | Formulario de solicitud con destinatario, motivo, petición y cierre. La opción elegida ocupa la casilla adecuada. |
| Dentro de un relato | Libro abierto con fragmento y capas de personaje, lugar y narrador; las pistas se fijan como notas a la frase que las justifica. |
| Presenta una solicitud | Ventanilla con documento administrativo. Se completan finalidad, identidad, petición y contacto en el formulario. |
| Comprueba la noticia | Portada de periódico con titular, cuerpo y firma. Se separan hecho y opinión, y se verifica la fuente antes de compartir. |
| Defiende una idea | Mesa de debate con tesis, prueba, objeción y conclusión. Cada argumento ocupa su turno y refuerza una línea visible. |
| Comenta un texto | Texto anotable con marcadores de tema, estructura, lenguaje y valoración, colocados junto a cada párrafo. |
| Entrega con claridad | Hoja final con checklist de orden, legibilidad y puntuación. Cada corrección se aplica al documento y habilita Entregar. |

### E3 · Geografía (10)

| Misión | Escena → respuesta integrada |
| --- | --- |
| La ruta del refugio | Mapa grande con rosa de los vientos, leyenda y escala. La elección traza el siguiente tramo de la ruta. |
| El valle de los dos pueblos | Valle con costa, montaña y lluvia representadas en el paisaje. Se señalan altitud, clima y vegetación en el lugar concreto. Requiere arte nuevo: el actual es un safari. |
| El censo del barrio | Plano de barrio con gráfico de edades, movimientos y servicios. Cada dato elegido modifica la ficha censal y el mapa. |
| El mapa de los oficios | Ciudad con campo, fábrica, vías y comercios. Las actividades se colocan físicamente en su zona de trabajo. |
| El viaje de una camiseta | Ruta ilustrada de algodón, fábrica, barco, tienda y consumo. Una decisión abre el siguiente punto del mapa comercial. |
| La ruta de las instituciones | Mapa de España y Europa con capitales y sede institucional. Se arrastra la tarjeta al lugar o ámbito correcto. |
| El plan del embalse | Cuenca, embalse, hogares y cultivos conectados. Cada respuesta regula una compuerta o una decisión de uso del agua. |
| El informe de la comarca | Informe con dos gráficos y leyenda. Se marca la cifra, diferencia o límite de interpretación directamente en el gráfico. |
| Rediseña el barrio | Plano urbano con viviendas, aceras, transporte y servicios. Se sitúan las mejoras donde resuelven el problema descrito. |
| El presupuesto del mes | Mesa familiar con ingresos, gastos y saldo. La respuesta mueve fichas al presupuesto y actualiza el balance. |

### E4 · Historia y Ciudadanía (11)

| Misión | Escena → respuesta integrada |
| --- | --- |
| El museo de las civilizaciones | Galería con cuatro vitrinas para río, Grecia, Roma y legado. Se selecciona el objeto o documento de la vitrina activa. |
| La ciudad tras la muralla | Ciudad medieval ilustrada con campo, estamentos, mercado y puerta. La respuesta activa una zona y muestra qué cambió. |
| La imprenta de las ideas | Taller con imprenta, mapa de viajes, poder y textos ilustrados. Cada decisión imprime una hoja del archivo. |
| La fábrica y la asamblea | Ciudad industrial que cambia entre taller, fábrica, barrio y asamblea. Se coloca cada proceso sobre la escena histórica correcta. |
| La línea del tiempo reciente | Cronología del siglo XX con fotografías/documentos y espacios de fechas. Cada respuesta fija una pieza en su época. |
| El pleno del municipio | Salón de plenos con agenda de servicios, derechos y debate. La opción elegida se convierte en una propuesta votable. |
| El archivo de la Transición | Cuatro carpetas fechadas de historia de España. Se ordenan los documentos en la carpeta correcta antes de abrir la democracia. |
| El patrimonio habla | Museo y mapa de Andalucía con objeto, contexto y conservación. La elección se anota en una ficha de patrimonio. |
| La mediación del centro | Dos personajes y una mesa de mediación. Se elige la intervención apropiada en su turno y se construye un acuerdo. |
| ¿Qué cuenta este documento? | Documento histórico ampliable con fecha, autor y fuente. Se fijan notas de tipo, contexto, perspectiva y contraste. |
| La canción del archivo | Fonoteca con letra/frase legible y ficha histórica. Se relaciona mensaje, contexto y límites de la fuente. No simular reproducción de audio si no se incorpora una pista sonora real. |

### E5 · Matemáticas (12)

| Misión | Escena → respuesta integrada |
| --- | --- |
| La cuenta de la compra | Mercado y cesta con etiquetas de precio, descuento y cambio. Las respuestas aparecen en caja y recibo; arte nuevo, pues hoy usa una bóveda de racionales. |
| Prepara un encargo | Puesto de fruta con báscula, cesta y etiqueta de descuento; la escala del mapa ocupa un pequeño plano anexo. Se actualiza el pedido al acertar. |
| Descifra la entrada | Taquilla con ecuación, llave y comprobación. El número elegido se introduce en una cerradura y abre la puerta. |
| Diseña un jardín | Plano de jardín con longitudes visibles. Se colocan área, valla, parterre y diagonal sobre sus superficies respectivas. |
| La tarifa de bicicletas | Estación de alquiler con cartel de tarifa y gráfica tiempo/precio. Cada respuesta mueve el punto en la gráfica. |
| La encuesta del barrio | Tablón con cinco datos, tabla y gráfico. Media, mediana y probabilidad se escriben en su casilla de análisis. |
| Prepara una mudanza | Camión, cajas, botella y cronómetro, con etiquetas de unidades donde se escriben las conversiones. |
| Revisa la factura | Factura con líneas de precio, descuento, impuesto y envío. Cada respuesta rellena el subtotal correspondiente. |
| Una receta para seis | Cocina con receta para cuatro/seis personas, bolsa de arroz y medidor. Se ajustan cantidades en la propia receta; arte nuevo. |
| Interpreta la gráfica | Gráfica legible con ejes y serie de visitantes. Se señalan máximo, cambio y porcentaje sobre el dato pertinente. |
| Comprueba el recibo | Recibo junto a calculadora y zona de estimación. Se compara el cálculo con el total y se corrige el cambio. |
| Detecta el patrón | Laboratorio lógico con secuencia de fichas, ecuación y diagrama de azar. Cada solución ocupa un hueco verificable del patrón. |

### E6 · Ciencias y Tecnología (12)

| Misión | Escena → respuesta integrada |
| --- | --- |
| La planta misteriosa | Dos plantas y mesa de ensayo. Se sitúan observación, hipótesis, variable controlada y conclusión en el cuaderno. |
| La ruta del oxígeno | Lámina del cuerpo con pulmón, sangre y células conectados. La respuesta ilumina el tramo correcto y luego la medida preventiva. |
| El bosque en equilibrio | Ecosistema con planta, animal, descomponedor e impacto humano. Cada elección activa una relación de la cadena. |
| El laboratorio de las mezclas | Mesa con sustancias, embudo, filtro y avisos de seguridad. Se aplica el método a la muestra concreta. El fondo actual muestra átomos. |
| El viaje de la bicicleta | Pista con marcas de distancia, reloj, zona de frenada y unidad. La bicicleta avanza al colocar el valor correcto. |
| La hoja de cálculo útil | Pantalla de hoja de cálculo con celdas, fórmula y menú de compartir. Se responde en la celda o control correspondiente; arte nuevo, no circuito eléctrico. |
| El observatorio del planeta | Corte de la Tierra, agua, roca y mapa de riesgo. Se señalan capas y procesos sobre la ilustración. |
| El recorrido de un almuerzo | Plato, aparato digestivo, sangre y riñones conectados. Las respuestas guían el alimento y los desechos por su ruta. |
| El informe de los termómetros | Dos termómetros y tabla de mediciones. Variable, lectura, gráfica y conclusión se completan en un informe real. |
| La energía del centro | Plano de un centro con luces, calefacción y residuos. Cada decisión cambia un indicador de consumo y muestra el balance. |
| Protege tu cuenta | Pantalla ficticia de acceso, mensaje sospechoso, doble verificación y permisos. Las opciones se eligen en el control que habría que revisar; arte nuevo. |
| Construye un soporte | Taller con boceto, materiales, prototipo y prueba. Cada respuesta modifica el objeto construido y culmina en una mejora visible. |

## Packs de ejecución recomendados

Hacer packs pequeños de **4 a 6 juegos** y cerrarlos visual y funcionalmente antes de avanzar. Dentro de cada pack: inventario de preguntas, boceto, recursos, tablero, corrección, móvil y sesión completa. No sumar 126 fondos nuevos de golpe: en algunos basta una escena por misión, en otros hacen falta 2–4 objetos recortados y estados visuales. Generar solo los recursos que necesita el gesto del juego.

| Orden | Pack inicial | Por qué empezar ahí |
| --- | --- | --- |
| 1 | P1a: Tren de las decenas, Bosque vivo, Redacción de titulares, Central de mensajes | Son ejemplos claros de colocar **dentro** del escenario y sirven para fijar el patrón de destino, pieza y acierto. |
| 2 | E5a: Cuenta de la compra, Prepara un encargo, Revisa la factura, Una receta para seis | Permite crear objetos cotidianos de ESO Adultos y corregir fondos temáticamente equivocados. |
| 3 | E1a: Pista del horario, Mañana en la ciudad, Calendario de Alex, Correo para pedir información | Define el patrón adulto de lectura y respuesta contextual; Inglés es el grupo sin arte de misión propio. |
| 4 | P2a: Feria de porcentajes, Mercado de monedas, Ruta bajo cero, Laboratorio de mezclas | Casetas, puesto, teleférico y mesa deben verse y responderse de manera distinta. |
| 5 | E3a + E6a: Valle de los dos pueblos, Ruta del refugio, Hoja de cálculo útil, Laboratorio de mezclas | Corrige imágenes que hoy cuentan otra historia. |

Después seguir con los demás juegos de cada bloque P1–P6 y E1–E6, agrupando reutilización de componentes por **acción**, no por simple color o asignatura. Al final abordar los 15 formatos libres para materiales creados por profesores.

**Criterio de terminado:** una persona entiende dónde tocar sin explicación, el acierto transforma un objeto del escenario, la corrección académica sigue siendo fiable, las opciones no tapan la imagen ni obligan a desplazar unos píxeles dentro del juego, y la misma partida funciona en portátil, móvil y, cuando procede, sesión compartida.
