# Inglés · Enfocado, Ruta y Directo

`index.html` incluye una galería que funciona al abrir el archivo directamente. El selector compara las capturas de la misma pantalla en las tres propuestas.

Desde la raíz del proyecto, inicia la revisión navegable con este comando.

```powershell
python design-previews/ingles-ux/serve.py
```

Abre [el comparador local](http://127.0.0.1:8780/). El menú «Pantalla» lleva a las vistas principales y los enlaces Enfocado, Ruta y Directo conservan la vista elegida. La app usa el temario, las misiones y los audios del proyecto. El servidor de prueba proporciona una cuenta ficticia, guarda cambios en memoria y simula Google, OCR y las respuestas de IA.

## Identidades

- **Enfocado** recomienda la siguiente lección al entrar. El índice se lee en una columna y Writing separa la redacción de la revisión.
- **Ruta** muestra la próxima misión y sus paradas cercanas. El mapa es vertical y mantiene la tarjeta de continuación a la vista en ordenador.
- **Directo** ofrece Speaking, Writing y Listening en el inicio, con un diseño claro y navegación lateral en ordenador e inferior en móvil.

## Ilustraciones

Las tres imágenes de `assets/` se generaron con la herramienta integrada de imágenes y se guardaron en WebP para el comparador.

- **`folio.webp`** — Use case: stylized-concept. Wide 16:9 editorial lifestyle photograph for Folio, a premium adult English learning app. Sunlit British reading room, pale ivory plaster, tall curved windows, a white oak table with a large open cream notebook, dark pine green book spine and a ceramic cup, a tiny sprig of eucalyptus. Refined editorial photography with soft light, sage and ivory tones and sculptural details, designed as hero art. A quiet composition with the objects on the right and sunlight left. No text or legible lettering, no logos, no graphic UI, no watermark.
- **`atlas.webp`** — Use case: illustration-story. Wide 16:9 atmospheric game-world artwork for an adult English learning app called Atlas. An inviting stylized 3D illustrated British coastal town, sea cliffs, vintage red train and station, a small lighthouse, a winding path through a grassy headland to a reading room, adventurous but sophisticated. Golden sunset ochre, marine navy, parchment and sage with rust red accents. Elevated scenic perspective, miniature tactile diorama, intricate foreground at right and quieter sea at left. A scene for a navigation journey and hero art, not a screenshot. No letters, logos, numbers, graphical UI, labels or watermark.
- **`signal.webp`** — Use case: stylized-concept. Wide 16:9 image for Signal, an adult English learning app. A late-evening London sound and broadcast studio with near-black navy, a dark indigo panoramic city window, warm hot coral status lights and electric ice-blue thin lights, a tactile broadcast console and a large professional microphone to the right. Architectural photography with restrained neon, clear intentional focal point and open dark left half. Premium, quiet, focused. No words, logos, signage, people, graphical interface overlays or watermarks.
