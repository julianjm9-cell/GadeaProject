# Materiales completos y actividades con identidad propia

El generador distingue la cantidad de actividades y el contenido de cada una. Por ejemplo,
una actividad de elección puede tener ocho preguntas; un rosco, dieciocho letras; un texto,
doce huecos. Se mantienen los 21 tipos y las actividades con fotografía de Premium.

## Configuración y edición

- Cinco parámetros iniciales visibles y una caja amplia para instrucciones concretas.
- Extensión orientativa breve, media o amplia y práctica guiada, autónoma o de reto.
- Control de preguntas, parejas, palabras, letras o pasos por actividad seleccionada.
- Cada visita empieza sin tipos marcados. Al seleccionar un tipo se añade una actividad.
- Edición de una pregunta por pantalla, con el grupo de actividad identificado y vista previa.
- Las pistas de crucigramas, parejas y rosco permiten varias líneas y se leen completas.
- El texto de una lectura se comparte entre sus preguntas y editarlo actualiza todo el grupo.
- El alumno ve cada juego con sus controles propios: rosco circular, pasar y volver, textos
  con huecos en línea, piezas que se arrastran o colocan por clic y secuencias reordenables.

La vista de ficha evita repetir pasajes largos. En la vista de una actividad por pantalla,
el pasaje se mantiene accesible. Los PDF incluyen cada lectura una sola vez y separan los
bancos de relacionar por actividad. La exportación admite hasta 80 preguntas.
El reproductor mantiene la navegación y los botones de comprobar/cerrar a la vista;
solo el contenido de las actividades largas necesita desplazamiento, también en móvil.

## Generación y controles de calidad

El contrato antiguo sigue admitido. Los clientes nuevos envían `activitySizes`, `instructions`,
`extent` y `difficulty`. El servidor conserva `activityGroup` en cada pregunta y divide las
actividades extensas en lotes de hasta seis preguntas; cada tablero es un objeto completo.
Las lecturas y categorías se conservan entre lotes. Los rosco admiten 3–27 letras; los textos,
2–20 huecos. Las preguntas básicas admiten hasta 12 por actividad y el material, hasta 80.

Los textos con huecos se construyen a partir de un relato resuelto y localizadores de las
respuestas. La app oculta las palabras y añade los infinitivos sin depender del recuento de
guiones de la IA. Los localizadores deben identificar una sola respuesta; si el fragmento
está parafraseado, solo se acepta cuando la palabra aparece una única vez en el relato.

La validación comprueba cantidades, tipos, soluciones, duplicados, opciones, letras del
rosco y la continuidad de las lecturas. No acepta pistas con huecos ni pistas que revelen
la respuesta. Las pistas de conjugación de Español especifican verbo, persona y tiempo.
Para el contraste imperfecto/indefinido se detectan construcciones compuestas excluidas.
La naturalidad, concordancia y precisión pedagógica se refuerzan en las instrucciones de
generación. Estos controles no constituyen una revisión lingüística exhaustiva: el profesor
conserva la edición y la revisión del borrador antes de guardarlo.

Cada petición incluye solo las reglas del tipo actual. Groq GPT-OSS usa esquemas JSON
concretos por lote; otros proveedores conservan el modo JSON existente. Presupuesto máximo
de 3000 tokens por lote, o 4000 para lecturas, textos con huecos y rosco. Se permiten hasta
dos correcciones de un borrador inválido, con una referencia acotada a 6000 caracteres.
Los 429 respetan Retry-After, con hasta tres intentos y como máximo 60 segundos de espera
acumulada por envío. Si el proveedor sigue sin responder, se conserva la petición del formulario.

Se cobra **un crédito al completar todo el material**, no por pregunta, lote ni corrección.
Los fallos y materiales incompletos no consumen créditos. Repetir el mismo `request_id` y
contexto recupera la respuesta guardada sin un nuevo cargo.

Referencia de integración: [Structured Outputs de Groq](https://console.groq.com/docs/structured-outputs).
Las restricciones del proveedor se complementan con la validación propia del servidor.

## Verificación

Pruebas del backend: `test_teacher_generator_quality.py`, `test_teacher_generator.py`,
`test_teacher_pdf.py` y `test_teacher_spanish.py`.
Pruebas en navegador: `profesor-generator-quality-browser.cjs`,
`profesor-generator-wizard-browser.cjs` y `profesor-material-renewal-browser.cjs`.
La prueba de calidad cubre selección, cantidades, petición de IA, guardado, rosco de 18
letras, texto de 12 huecos, lectura compartida y móvil de 390 px.

Para desplegar en Hostinger:

```bash
cd /opt/educa-suite && git pull && docker compose --profile proxy up -d --build && docker compose ps
```
