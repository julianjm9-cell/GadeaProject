# Diez misiones de Inglés con objetos interactivos

8 de noviembre de 2026. Base: `4499950`.

La renovación afecta a las diez misiones de la aplicación de Inglés, no a los juegos de Profesor Particular ni a los exámenes de Listening. Mantiene sus identificadores, las 38 etapas, preguntas, soluciones, explicaciones y registros de progreso.

## Interacción por juego

| Juego | Acción y respuesta del escenario |
| --- | --- |
| La sala de edición | Elegir un recorte y colocarlo en el hueco real del periódico; la línea correcta recibe un sello de verificación. |
| El archivo de pistas | Llevar una carpeta al expediente del caso. Las notas comprobadas completan su dossier. |
| La máquina de reformular | Escribir la expresión equivalente y accionar una palanca. Una solución válida enciende las luces, mueve el engranaje y aparece en la salida. |
| El texto incompleto | Reparar el hueco de un puente con la tabla correcta. El guía avanza por la ruta con cada tramo comprobado. |
| La forja de palabras | Elegir el molde de la palabra y colocarlo en el yunque. El martillo y el horno reaccionan a la transformación correcta. |
| El correo que decide | Elegir una frase adecuada al destinatario y colocarla en un sobre antes de enviarlo. El sello confirma cada entrega. |
| La mesa de investigación C1 | Contrastar documentos y añadir notas respaldadas a un informe con cinco fases. |
| La mesa redonda C1 | Elegir una intervención y tomar el turno de palabra en la mesa; el avance representa los pasos hacia un acuerdo compartido. |
| El observatorio editorial C2 | Orientar el instrumento al seleccionar una afirmación y fijarla en el registro; se ilumina solo el número de observaciones realmente comprobadas. |
| La imprenta de precisión C2 | Colocar una plancha en la prensa. La frase validada aparece en la prueba impresa y el mecanismo reacciona. |

Los controles son HTML accesible. Se puede arrastrar con ratón, tocar una pieza y después su destino, o usar Tab e Intro. Arrastrar nunca es obligatorio. Cada destino explica qué colocar y el feedback sigue mostrando la explicación educativa existente.

## Flujo y protección del progreso

- Al abrir una misión, el catálogo deja espacio a la escena; «Todos los juegos» vuelve a mostrarlo sin borrar la partida.
- Cada etapa necesita una solución válida antes de permitir avanzar. El doble clic no completa etapas nuevas ni registra dos veces la partida.
- La etapa comprobada se guarda como `solvedStage` dentro de la partida existente y se recupera tras recargar. Las partidas anteriores siguen siendo válidas sin ese campo.
- Una colocación incorrecta exige elegir de nuevo antes de contar otro intento; tocar repetidamente un destino no infla el contador.
- La máquina acepta las variantes de respuesta ya definidas y normaliza espacios, mayúsculas y apóstrofos tipográficos.
- El teclado recupera el foco al cambiar de etapa. El movimiento respeta la preferencia de reducir animaciones.
- Se conserva una presentación funcional alternativa si no se consigue cargar el módulo de escenas.

No se añade ninguna migración de base de datos ni se recalculan o eliminan logros anteriores.

## Archivos e imágenes

Módulo de escenas: `apps/cambridge/assets/studio/games.js`. Estilos: `apps/cambridge/assets/studio/games.css`. Las ilustraciones anteriores se reutilizan para los entornos; los objetos de respuesta son controles de verdad sobre la escena.

Dos ilustraciones nuevas generadas con la herramienta integrada `image_gen`, en llamadas independientes:

1. `apps/cambridge/assets/studio/bridge-world-v1.webp`. Prompt: “Wide 16:9 background plate for an interactive English bridge-building game. Premium tactile 3D educational adventure for teens and adults. An idyllic English university garden with a small turquoise river crossing horizontally through the foreground. Leave the lower-middle third as unobstructed water, with matching wooden bridge entrance and exit posts on the left and right banks. Do not draw a bridge deck: actual interactive wooden planks will be added in HTML. Charming stone university towers, willow trees, green hills, ivy and warm sunlight. Navy, teal, ivory and amber palette. No people, text, letters, logos, UI panels or watermark.”
2. `apps/cambridge/assets/studio/guide-v1.webp`. Prompt: “A single transparent-background game character sprite: a small cobalt-blue robin carrying a tiny tan leather messenger satchel, full body facing right, feet and tail visible, confident curious expression. Sophisticated polished 3D game art with soft feather texture, navy and cyan feathers, small orange beak and feet, brass satchel clasp, clear silhouette and transparent margins. One character only; no floor, scene, text, letters or watermark.”

Se conserva la transparencia del personaje. Los dos archivos WebP suman 413.914 bytes. Las imágenes originales de generación se mantienen fuera del paquete de producción.

## Verificación

La prueba específica recorre las 38 etapas a través de sus controles en Chromium y WebKit, prueba errores, arrastre, alternativas por teclado, recuperación de una etapa comprobada y finalización única. También abre y responde cada una de las diez misiones con tacto a 320 y 390 píxeles, comprobando el ancho disponible y la vuelta al catálogo.

Se mantienen las pruebas de rutas, borradores, guardado y progreso de Inglés. El despliegue comprueba el módulo, los estilos y las dos imágenes; Docker copia la carpeta completa. Las pruebas usan cuentas y servidores ficticios, sin llamadas de estudio de pago ni modificaciones en Hostinger.

Resultados de cierre: 117 comprobaciones de interfaz y catálogos, 11 de acceso/recursos del backend y 17 casos de navegador verificados entre las suites específicas de misiones, escritorio y continuidad de Inglés. Las 38 etapas se completaron mediante sus controles en ambos motores; se probó también un apóstrofo tipográfico válido en la máquina. La imagen Docker sirve los 13 recursos de Inglés, incluido JavaScript con el tipo de contenido correcto, sin montar el checkout.

Las capturas de cada escena y su variante móvil están en `tmp/english-missions/`. Los datos de esas capturas son ficticios.
