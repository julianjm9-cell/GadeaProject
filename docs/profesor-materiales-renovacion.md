# Renovación de actividades — 5 de octubre de 2026

La biblioteca y el selector conservan sus entradas. La renovación se concentra en
el editor y en la actividad abierta; los materiales guardados con `version: 1`
siguen siendo compatibles. No requiere una migración de datos.

## Uso

- Se puede alternar entre ficha completa y una actividad por pantalla sin perder
  respuestas. Al terminar, «Repasar errores» crea un nuevo intento con las preguntas
  incorrectas o parcialmente correctas. Las respuestas abiertas se revisan con el
  profesor; no se presentan como corregidas automáticamente.
- Relacionar agrupa las parejas del material en un tablero. Clasificar agrupa los
  elementos que comparten categorías. Ambos admiten arrastre, selección por toque,
  teclado y devolución de piezas. Arrastrar y soltar admite varios elementos en un destino.
- Completar y texto con huecos tienen campos integrados, banco de palabras opcional,
  variantes admitidas y corrección por hueco. Se permiten soluciones repetidas.
- Respuesta numérica acepta fracciones y decimales escritos con punto o coma,
  muestra la unidad separada y aplica la tolerancia absoluta configurada.
- Elegir respuesta, verdadero/falso y quiz visual destacan la solución después de
  comprobar. Las explicaciones se muestran cuando están incluidas en el material.
- Respuesta breve tiene un campo compacto; problemas se divide en datos,
  planteamiento, cálculo y comprobación. Comprensión separa lectura y respuesta,
  con subrayado del texto. Encuentra el error permite seleccionar palabras antes
  de escribir la corrección.
- Ordenar muestra corrección por posición y permite confirmar el orden. Construye
  la frase usa un banco de fragmentos. Línea temporal muestra los hitos en vertical.
- Flashcards presenta anverso y reverso con tres valoraciones. Memory adapta las
  tarjetas al contenido y muestra parejas e intentos.
- Sopa de letras admite arrastre continuo o selección de extremos. Crucigrama tiene
  pistas numeradas, palabra activa, escritura seguida, flechas, pegado y ayuda por letra.
- Pasapalabra presenta un rosco de 3 a 27 letras, distingue «empieza por» y
  «contiene», y permite pasar y volver a las letras pendientes.
- Ahorcado usa un dibujo SVG, casillas por letra y teclado físico o en pantalla.
  Sopa de letras, Memory, Pasapalabra y Ahorcado tienen cronómetro opcional, sin
  límite de tiempo ni penalización automática.
- Quiz visual permite ampliar la imagen. Señalar imagen admite una zona rectangular
  por ejercicio, dibujada por arrastre o ajustada con coordenadas. Los puntos de
  materiales anteriores conservan la tolerancia circular anterior.

## Edición y generación

Las opciones y parejas se editan en filas con campos separados. Los campos opcionales
son `explanation`, `hints`, `rubric`, `alternatives`, `wordBank`, `unit`, `tolerance`
y `errorSegment`. La zona de imagen añade `width` y `height` al objeto `target`.
Se validan los tamaños y tipos tanto al guardar en el editor como al recibir
contenido del generador (las imágenes siguen siendo de preparación manual).

El prompt del generador solicita razonamiento, pistas progresivas y criterios
concretos. Esto se aplica a nuevas generaciones; no inventa explicaciones para
los materiales antiguos ni los regenera automáticamente.

## PDF

La ficha y las soluciones siguen separadas. Las secuencias se desordenan en la
ficha, las asociaciones se imprimen en columnas, los problemas reservan espacios
por paso y las soluciones incluyen explicaciones y criterios. El crucigrama
identifica la posición y dirección de sus pistas. Las zonas de imagen se dibujan
solo en la versión de soluciones.

## Comprobaciones

- Cinco pruebas de navegador: creador manual/IA simulada/fotos, editor y vista previa
  desplazable, tipos existentes y nuevos, tableros agrupados, respuestas equivalentes,
  fracciones, correcciones, revisión del profesor, repaso, arrastre continuo, escritura
  en crucigrama, zonas de imagen y anchuras de móvil.
- 22 pruebas de backend de generación y PDF, incluidas validación antes de cobrar,
  tiempos de espera, formatos incompatibles y separación de soluciones.
- Inspección visual del rosco en escritorio/móvil y de las páginas de ficha y soluciones.
- Las llamadas a IA de prueba usan respuestas simuladas; no se consumieron créditos
  ni se comprobó una generación real contra el proveedor configurado.

## Despliegue

Desde `/opt/educa-suite`, ejecutar `git pull --ff-only` y
`bash infra/deploy-hostinger.sh`. Los recursos del reproductor llevan una nueva
versión de caché. El despliegue en producción no forma parte de las pruebas locales.
