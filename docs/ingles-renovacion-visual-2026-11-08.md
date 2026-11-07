# Renovación visual de Inglés

8 de noviembre de 2026. Revisión de partida: `6c72da2`.

## Entrega

- Landing nueva con presentación breve, acceso habitual de Google, reto interactivo existente, seis accesos ilustrados, explicación en tres pasos y cobertura real de B2/C1/C2.
- Escritorio con escena de estudio, control de sesión compacto y tarjetas ilustradas de biblioteca, ruta, juegos, Speaking, Writing y progreso.
- Cabecera uniforme. En móvil se ven los siete accesos de navegación; el nivel y las acciones de cuenta siguen disponibles. La biblioteca mantiene su selector de categoría y evita duplicarlo con una fila de pestañas en pantallas pequeñas.
- Tarjetas de lecciones, entrenamiento y juegos, encabezados de biblioteca/Writing/Speaking/progreso y controles con el mismo lenguaje visual.
- Se conservan las funciones, identificadores, preguntas, respuestas, niveles, guardado y datos anteriores. No hay migración de base de datos para esta renovación.
- Seis ilustraciones nuevas, con una variante grande de la escena principal: siete WebP, 749.500 bytes en conjunto. Las miniaturas se cargan de forma diferida; los recursos originales generados permanecen en la carpeta de generación, fuera del paquete de producción.
- Los estilos e imágenes están en `apps/cambridge/assets/studio/`, se sirven desde `/assets/cambridge-studio/` y se copian en la imagen Docker. El control de despliegue comprueba los nueve recursos.

## Imágenes y prompts

Método: herramienta integrada `image_gen`, seis generaciones independientes, sin uso de una API de pago adicional. Paleta coherente azul marino, azul claro, marfil, verde azulado y ámbar. Ilustración editorial tridimensional cuidada para adolescentes y adultos. Sin logotipos, marcas de agua ni texto legible.

Prompts de producción, con el contexto común anterior:

1. **Academy:** “A premium English learning web app hero illustration, wide landscape 16:9. A beautiful inviting modern Oxford-inspired study studio overlooking a sunlit English university courtyard with stone arches, abundant green plants and pale blue sky. A tidy oak desk with open books, a slim tablet showing abstract blue practice cards, a blue pen, a cup and a subtle brass compass. Refined polished 3D editorial illustration, sophisticated but playful. Perspective creates depth, uncluttered middle area with soft light for a web UI overlay, more detail along the sides. Excellent natural materials and gentle cinematic light. No people, no legible writing, no logos, no badges, no watermark, no user interface screenshot.”
2. **Games:** “A miniature British coastal island adventure on a desk: a curved stone stepping-stone path across turquoise water, a small lighthouse at its destination, an open mysterious book, three tactile blue puzzle tiles and a tiny brass key on the path. Premium polished 3D editorial illustration. Beautiful soft daylight, strong clear central silhouette, subtle paper texture, clean uncluttered cream-blue background, objects entirely visible with generous margins. Looks like an appealing game world, not an icon or flat vector.”
3. **Writing:** “A miniature writer’s desk: an ivory page with abstract short blue lines, a premium cobalt-blue fountain pen, a pale blue envelope with a small amber wax seal, a notebook and two floating translucent comment cards with tiny green checkmarks. Tactile elegant 3D editorial illustration. Warm soft daylight, delicate paper texture, cream-blue clean uncluttered background, strong central composition, generous safe margins, all objects fully visible.”
4. **Audio:** “A stylish cobalt-blue studio microphone and comfortable sky-blue over-ear headphones on a small ivory desktop platform, floating glass speech bubbles and a subtle cyan audio wave behind them, with a small amber play symbol. Beautiful polished tactile 3D editorial illustration. Soft natural studio daylight, very clean pale blue background, central objects with generous safe margins.”
5. **Route:** “An open ivory book becomes a miniature winding path of cobalt-blue and teal stepping stones, leading through three small charming stone college arches toward a warm amber star. A tiny brass compass rests beside the book. Premium polished tactile 3D editorial illustration, soft natural daylight, pale blue-white clean background, centered composition and generous safe margins. Clear readable shapes and beautiful book-paper textures.”
6. **Progress:** “Three translucent blue rising steps on a small ivory platform with a small amber star medallion at the top, an elegant open study notebook with abstract checkmarks, a tiny leafy plant. Modern premium polished tactile 3D editorial illustration, soft natural daylight, subtle paper texture, pale blue clean uncluttered background, centered composition, all objects fully visible with generous safe margins. Encouraging and elegant for adults and teenagers.”

Archivos finales: `academy-v2.webp`, `academy-card-v2.webp`, `games-card-v2.webp`, `writing-card-v2.webp`, `audio-card-v2.webp`, `route-card-v2.webp`, `progress-card-v2.webp`, todos en `apps/cambridge/assets/studio/`.

## Verificación

Las pruebas de navegador comprueban landing y escritorio en Chromium y WebKit a 320, 390, 768 y 1440 píxeles: navegación, imágenes, borradores, los tres niveles, FAQ y reto público. Comprueban también que pausar la app desactive todos los accesos de la landing y mantenga disponible el reto público.

Las pruebas de backend comprueban los recursos locales y su alternativa empaquetada, junto con los contratos existentes de acceso a Inglés. Las pruebas anteriores de audio, rutas, lecciones y misiones siguen siendo la referencia funcional.

Las cuentas y las respuestas de IA en las pruebas son ficticias. No se han enviado avisos a usuarios, consumido créditos de estudio ni cambiado datos de producción.

Resultados: 117 pruebas de interfaz y catálogos aprobadas; 15 pruebas de navegador de Inglés aprobadas, incluidas tres de la nueva presentación; 11 comprobaciones de acceso y recursos del backend aprobadas. La imagen Docker se construyó y sirvió los nueve recursos nuevos y la landing sin montar el checkout. El ajuste final de avisos de guardado y del asistente móvil se vuelve a comprobar con las tres pruebas visuales.

Capturas de revisión con cuenta ficticia: `tmp/ingles-landing-portada.png`, `tmp/ingles-landing-renovada.png`, `tmp/ingles-escritorio-portada.png`, `tmp/ingles-escritorio-1440.png` y `tmp/ingles-escritorio-390.png`.
