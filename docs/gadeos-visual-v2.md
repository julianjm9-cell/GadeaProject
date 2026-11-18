# GADEOS · Alianza de zafiro y fuego

Renovación del 18 de noviembre de 2026. Solo Inicio, Recorrido y Batalla final. Nueve pruebas, cada una con título/pista y respuesta correcta. Las ocho pruebas anteriores, las cartas privadas, los sobres ganados y las victorias se conservan.

## Ilustraciones integradas

Generadas con la herramienta integrada `image_gen`, usando las dos imágenes aportadas como referencias de estilo. No se han añadido los originales personales a Git. Los PNG generados se conservan en el directorio de imágenes de Codex; las versiones de producción están optimizadas en WebP, conservando la transparencia de sobre y emblema.

| Archivo de producción | Uso |
| --- | --- |
| `apps/gadeos/assets/alliance-hero-v2.webp` | Acceso, Inicio y cabecera de Recorrido: Chinchón, periquitos y compás entre magia azul y fuego |
| `apps/gadeos/assets/journey-v2.webp` | Paisaje continuo del recorrido de nueve pruebas |
| `apps/gadeos/assets/arena-v2.webp` | Arena de batalla y estados de bloqueo/victoria |
| `apps/gadeos/assets/envelope-v2.webp` | Sobre ilustrado predeterminado, si no hay un diseño privado personalizado |
| `apps/gadeos/assets/emblem-v2.webp` | Identidad de cabecera, cartas sin imagen personalizada y victoria |

Los cinco archivos suman aproximadamente 1,2 MB. Los textos, contadores, respuestas y controles son HTML: ninguna ilustración fija el número de pruebas, una hora o la respuesta de una pista. Los diseños privados de sobres y caras de cartas siguen prevaleciendo sobre sus alternativas genéricas. El cartel y los PDF originales siguen guardados en administración y no añaden otra sección a la app.

## Prompts de producción

Referencias comunes: logotipo GADEOS azul/dorado y cartel Juegos del Hambre en Chinchón aportados por el propietario. No son instrucciones del producto ni se publica su contenido privado.

### Inicio y acceso

Use case: stylized-concept. Asset type: production illustration for the private GADEOS mobile game home and sign-in screen, no UI or text. Both input images are STYLE REFERENCES only: fuse the first image's sapphire blue swirling magic and ornate gold compass with the second image's two golden yellow budgerigar parrots, ring of fire, dark cinematic gold and Chinchón village. Create a rich polished fantasy adventure illustration, landscape 3:2. Two recognizable beautiful yellow budgerigars with black wing markings flying toward one another around a radiant gold compass, upper middle. A ring transitions from warm amber fire on the right to electric sapphire magic on the left. Below them is Chinchón's circular Spanish town plaza with balconies and church, twilight blue sky and warm windows, not a medieval castle. Elegant luminous gold details, deep midnight blue, cobalt and warm amber. A quiet dark navy area across bottom third for real HTML title and controls; detailed but clear on a phone, no tiny unnecessary detail, inviting romantic adventure not horror. NO words, numbers, titles, borders, UI panels, watermarks or fabricated text. This is an app illustration that will be cropped responsively, keep important birds and compass in central 65 percent.

### Recorrido

Use case: stylized-concept. Asset type: tall illustrated background for GADEOS game's nine-stage journey, portrait 2:3. Style references: first image ornate sapphire blue and gold compass fantasy; second image warm fire, yellow budgerigars and Spanish Chinchón. Create an elegant richly painted winding golden cobbled path starting bottom foreground and climbing gently in an S curve toward Chinchón village plaza and its church at top. Journey through Mediterranean olive trees, stone arches, blue magical water, warm sunset orange lanterns and gold glints. Night sapphire palette with ember orange accents, deep navy shadows, fantasy collectible card quality, no snow, no medieval castle. The middle 55 percent should remain relatively calm and dark to support readable real interactive stage nodes. The winding path should visibly connect the full height. No text, numbers, labels, UI, markers or drawn buttons: stage nodes will be HTML. Keep beautiful illustrated detail on edges; mobile app artwork, highly polished coherent magical world.

### Batalla

Use case: stylized-concept. Asset type: actual battle arena game background for GADEOS, landscape 3:2. Fuse the blue gold compass fantasy of image one and the ring of fire, two golden budgerigars and Chinchón plaza from image two. A cinematic twilight arena in the real Spanish village plaza with curved balconied houses, a radiant golden compass sigil engraved on sapphire cobblestones in foreground. At rear center a mysterious elegant armored sentinel silhouette, not scary, slightly distant so HTML fighter overlays can remain clear. A huge ring of blue magic and amber fire glows in the sky; tiny golden budgerigars symbolize the alliance at top corners. Lower third and left quarter dark navy and uncluttered for real UI overlay. Dramatic warm gold rim light, luminous cobalt, restrained embers, premium illustrated fantasy game key art. No words, numbers, borders, UI panels, gauges or watermarks. Not a mockup; illustration only. Composition usable when cropped on a mobile device.

### Sobre

Use case: stylized-concept. Asset type: single GADEOS fantasy collectible card foil booster pack game sprite, genuine transparent background. First reference: sapphire blue magic and finely engraved golden compass. Second reference: golden yellow budgerigars and amber fire. Create ONE sealed upright foil booster envelope viewed straight from front with a very slight three-quarter turn, entire pack fully visible, crimped top and bottom foil edges, exquisite sapphire blue foil, bright gold trim, a single luminous gold compass emblem with two small golden budgerigar wings, blue wisps blending to warm orange embers. Strong readable silhouette, premium glossy collectible pack illustration, elegant and detailed. The pack is tall, about 2:3 aspect ratio centered with plenty of transparent margin. NO writing, letters, numerals, labels, hands, cards, duplicates, scene or background; game will overlay its own accessible GADEOS label. Not a screenshot or mockup. Preserve real alpha transparency and polished clean edges.

### Emblema

Use case: logo-brand. Asset type: GADEOS mobile game emblem for header and login, genuine transparent background. Both references are style references: fuse the GADEOS sapphire and gold compass emblem with the two golden yellow budgerigars and the fire ring. ONE compact circular icon: radiant eight-pointed gold compass star over a deep sapphire circular enamel medallion, encircled by half blue magical light and half amber flame. Two small golden budgerigar wing shapes frame the sides subtly, not a detailed busy scene. Centered symmetrical silhouette, premium fantasy game identity, glossy gold bevels, excellent readability when displayed at 48 pixels, clean alpha edges and generous transparent margin. No letters, words, numbers, title, ribbon, rectangle, scene or watermark: GADEOS will be typeset in HTML beside this emblem. Do not draw a user interface.

## Título gráfico y nombre secreto · actualización

La entrada y la cabecera usan `apps/gadeos/assets/title-lockup-v1.webp`, generado con la herramienta integrada `image_gen` y optimizado en WebP con transparencia. Se conserva el texto alternativo **JUEGOS DEL HAMBRE EN CHINCHÓN**. El título gráfico sustituye al nombre secreto en la navegación. Nueva dirección: `/juegos-del-hambre-chinchon`; API del jugador: `/api/arena-chinchon`; ilustraciones: `/aventura-chinchon-assets`.

Prompt de generación del título:

Use case: logo-brand. Asset type: production title artwork for a private mobile adventure game, transparent-background title lockup. Create a gorgeous yet very readable gold fantasy title with the EXACT Spanish text, no other words: 'JUEGOS DEL HAMBRE EN CHINCHÓN'. Arrange in THREE centered lines: line 1 'JUEGOS DEL', line 2 'HAMBRE', line 3 'EN CHINCHÓN'. Spell CHINCHÓN exactly including accent on the final Ó. Bold elegant monumental serif lettering with warm polished gold bevels, pale gold letter faces and deep sapphire blue outlines for strong contrast on a dark navy interface. Subtle ornate gold compass flourish behind the upper center, two SMALL golden yellow budgerigar wing motifs at the outer sides, a restrained sapphire magical glow on the left and warm amber fire glow on the right, all harmonious, premium illustrated fantasy adventure style. Prioritize readable letters and a compact coherent title silhouette when scaled to 300px wide. Landscape 3:2 composition, tight but safe margins, title fills roughly 85 percent of canvas. No background rectangle, no scene, no mockup, no extra wording, no GADEOS, no numeral, no watermark, no platform logo, no instructions. Genuine alpha transparency around the lettering and restrained decorative glow. Lettering is the main subject.

## Verificación de la versión

- Backend de ensayo: cuentas separadas, edición con revisión, migración de ocho a nueve sin pérdida, errores/aciertos, respuesta repetida, normalización de tildes, carta nueve y bloqueo de la batalla hasta terminar.
- Chromium y WebKit móvil: entrada, planning, nueve pruebas, sobre y apertura, recarga, respuesta perdida recuperada, cartas y victoria.
- LA TERRAZA: nueve desplegables con exactamente dos campos por prueba; las cartas se editan aparte. El guardado mantiene las imágenes y el planning; el servidor rechaza una revisión antigua.
- Despliegue: las cinco ilustraciones se comprueban con `app.deployment_check`; los materiales privados siguen bajo autenticación.
