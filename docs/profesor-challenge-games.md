# Cuatro juegos: selección múltiple, tabla, mensaje y carrera

## Disponibilidad

Se incorporan dos juegos básicos y dos avanzados al creador, editor, biblioteca, jugador individual, sesiones anónimas con código, seguimiento del profesor y exportación PDF. No hay cambios de esquema ni migraciones. Se conservan materiales y partidas existentes.

| Tipo | Familia | Contenido | Corrección |
|---|---|---|---|
| `multiselect` · Selecciona todas las correctas | Básicos | De 3 a 6 opciones, al menos 2 correctas y 1 incorrecta. El profesor elige sí/no en el editor. | Comprueba también las correctas omitidas y las incorrectas descartadas. Cada opción recibe color y explicación de estado. |
| `table` · Completa la tabla | Básicos | Tabla completa de 2–6 filas y 2–4 columnas, hasta 12 casillas. Tamaños posibles: 4, 6, 8, 9, 10, 12. | Corrección por casilla, conserva respuestas al corregir. En móvil se agrupan las casillas por fila y se repite su columna, sin desplazamiento horizontal. |
| `cipher` · Descifra el mensaje | Avanzados | De 3 a 10 pistas, respuesta y letra premio. Las letras en orden forman el mensaje. Se admiten respuestas equivalentes separadas por `~`. | Cada pista acertada revela su letra. No se revela el resto del mensaje. Se conserva la pista actual y se celebra el mensaje completo. |
| `race` · Carrera del conocimiento | Avanzados | De 4 a 12 retos, cada uno con una respuesta correcta y dos distractores. Opciones mezcladas. | Avanza tras comprobar un acierto; permite reintentar errores. Casillas normales: 10 puntos; cada tercera casilla es estrella y vale 20. La puntuación es informativa dentro de la partida. |

## Creación y revisión

Cada tipo tiene campos estructurados, vista previa y validación compartida entre creación manual, IA y servidor. Las opciones no requieren escribir JSON. La generación con IA utiliza el contrato estructurado existente y conserva elementos válidos durante la recuperación de una respuesta parcial. El profesor debe revisar el contenido académico antes de utilizarlo: una estructura válida no garantiza que todas las afirmaciones generadas sean correctas.

La creación manual continúa libre. Solo `cipher` y `race` se añaden al cupo compartido de un juego avanzado con IA al día en cuentas normales; Premium conserva su régimen actual. Las sesiones con código siguen siendo Premium. Los dos básicos nuevos no consumen ese cupo diario avanzado; la generación con IA conserva los créditos habituales.

## Sesiones y datos

El servidor prepara el tablero y comprueba las respuestas. La vista del participante recibe enunciados, etiquetas y opciones, pero no recibe soluciones, indicadores sí/no ni letras todavía no ganadas. Las opciones de la carrera usan identificadores aleatorios independientes en cada sesión. Una respuesta correcta enviada como borrador no descubre letras: se necesita la comprobación del servidor.

Los avances se guardan con el sistema existente de borradores y confirmación. Al editar una respuesta se invalidan sus marcas anteriores; las otras casillas verificadas se mantienen. En una recarga se recuperan respuestas, casillas, letras y foco. El profesor ve respuestas legibles, no identificadores internos. No hay llamadas a IA durante una partida.

## Presentación y recursos

Ocho miniaturas raster nuevas, optimizadas en WebP (aproximadamente 526 KiB en conjunto), con versión infantil y adolescente. Se utiliza la misma selección de audiencia que el catálogo existente. Los fondos de juego ilustrados ya disponibles se reutilizan para mantener coherencia visual y carga ligera. Ningún control está dibujado dentro de la imagen: se conservan botones, casillas y campos HTML accesibles por teclado.

Los paneles se adaptan a escritorio y móvil, con el tablero al lado del reto en pantallas amplias. Se evita tapar la navegación o el botón de terminar; el contenido extenso puede desplazarse verticalmente. Se distingue «Siguiente pista» de «Siguiente ejercicio». El color de corrección se acompaña de texto. Los controles se bloquean mientras se comprueba y un error de red conserva la respuesta para reintentar.

Registro de imágenes y prompts: [profesor-challenge-thumbnails.json](assets/profesor-challenge-thumbnails.json). Herramienta utilizada: `image_gen` integrado, mediante la habilidad imagegen; sin llamadas de pago a las claves API del proyecto.

## Verificación

181 casos del servidor y 35 pruebas JavaScript superados (216 casos únicos), más comprobaciones de navegador con datos ficticios. La IA de contenido se validó con respuestas simuladas; no se hicieron llamadas de pago a Groq o Gemini durante las pruebas.

- Pruebas del generador y su recuperación, validación de contenido, límites, persistencia, cuotas existentes, sesiones, PDF y los 30 formatos del jugador (incluidos los dos formatos visuales heredados).
- Pruebas JavaScript de los cuatro formatos, normalización, corrección, miniaturas, división entre básicos/avanzados y regresión de juegos existentes.
- Navegador con cuenta y datos ficticios locales: creación manual, guardado y recarga; aciertos y errores de selección múltiple y tabla; mensaje completo; carrera individual con casilla estrella y meta; entrada anónima con código, corrección en servidor y recuperación de progreso.
- Vistas de escritorio y 390 × 844. Ocho imágenes servidas y cargadas. Exportación sin soluciones y copia con soluciones separadas.
- No se han desplegado cambios en Hostinger ni utilizado datos de usuarios reales.
