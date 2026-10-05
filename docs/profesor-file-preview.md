# Vista previa de archivos añadidos

Al pulsar Usar en un material propio, el archivo se muestra en el diálogo sin descargarlo. También se muestra en los materiales que tienen una respuesta para autocorrección.

- PDF: visor nativo del navegador con navegación y zoom.
- PNG, JPEG y WebP: imagen ajustada al espacio disponible.
- TXT: lectura con saltos de línea, sin interpretar etiquetas HTML.
- DOCX: vista de lectura de títulos, párrafos, negrita, cursiva, subrayado, listas y tablas. No reproduce la paginación exacta, imágenes incrustadas ni elementos especiales de Word. El documento original sigue disponible para descargar. Esta conversión necesita el servidor; no está disponible para DOCX guardados únicamente en el modo de demostración local.

La ruta existente `/api/profesor/materials/{id}/preview` mantiene la comprobación de propietario, organización y licencia. No se envían documentos a servicios externos ni se consume IA. Los archivos ya subidos funcionan sin migración. Los objetos temporales del visor se liberan al cerrar el diálogo. Un error de lectura muestra un mensaje y conserva la descarga.

Validación: `tests/profesor-files-browser.cjs` y `backend/tests/test_access_control.py` cubren formatos, lectura segura, privacidad, documentos dañados, móvil y cierre del visor.
