# Encuentra el error, Crucigrama y Arrastrar y soltar

Los tres juegos pasan a Ejercicios avanzados y comparten controles entre el
reproductor personal y las sesiones con código. El catálogo tiene diez juegos
avanzados; se oculta la categoría de juegos antiguos cuando queda vacía. La cuota
de IA de cuentas normales incluye los diez tipos. Crear manualmente sigue libre.

## Interacción

- **Encuentra el error:** tocar una palabra la sustituye por un campo en la misma
  oración. Se puede ampliar el fragmento a palabras contiguas, cambiar la selección
  y comprobar con botón o Enter. El resultado colorea el propio campo e incluye un
  símbolo y un mensaje. Editar borra la valoración anterior. Los materiales antiguos
  sin `errorSegment` y `correctedSegment` conservan la revisión del profesor; no se
  inventa una solución automática a partir de explicaciones en texto libre.
- **Crucigrama:** casillas reales compartidas en los cruces, numeración, pista
  activa, flechas, borrado y pegado de palabras. Se comprueba explícitamente y las
  casillas incompletas quedan pendientes. Las pistas mantienen su altura aunque
  sean largas. Un tablero ancho se desliza dentro de su panel, conservando casillas
  legibles. En móvil la pista activa va antes del tablero. La ayuda personal revela
  una letra y se contabiliza como asistencia.
- **Arrastrar y soltar:** tarjetas y destinos, arrastre HTML y alternativa mediante
  dos toques o teclado. Se puede devolver una pieza, sustituir una pareja y reiniciar.
  Admite varios elementos con el mismo destino. Se corrige al comprobar y se borra
  la valoración al editar. En sesiones el orden permanece estable al comprobar o
  recargar. La corrección del participante la realiza el servidor.

Las soluciones personales se muestran en el diálogo moderno existente, separado
del tablero. La navegación queda fuera del área desplazable para evitar que las
tarjetas la tapen. No se cambia el formato de materiales guardados ni el esquema de
base de datos. Los borradores y sus revisiones se conservan al recargar una sesión.

## Imágenes

Por elección del usuario se reutilizan imágenes rasterizadas del proyecto. No se
generaron imágenes nuevas ni se utilizó la API de pago. Fondos: `sentence-stage.png`
para corrección, `memory-stage.png` para crucigrama y `timeline-stage.png` para
emparejar. Se mantienen las miniaturas específicas, también en su versión madura.
Letras, campos, pistas y botones son HTML; las respuestas no están pintadas en el fondo.

## Validación

45 pruebas de servidor pasan: sesiones, respuestas parciales, destinos repetidos, corrección
exacta, ausencia de soluciones en la respuesta pública, recarga, borrado de
valoraciones al editar, cuota de los diez tipos y publicación de activos en ambos
reproductores. Revisión de navegador con una cuenta ficticia y base aislada:
corrección roja/verde, crucigrama completo, tableros grandes, clasificaciones y
recarga de la sesión. Escritorio y móvil de 390 × 844; sin desbordamiento horizontal
de la página. Los tableros que exceden el espacio disponible permiten desplazarse.
