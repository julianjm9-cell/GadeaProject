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

La práctica muestra un ejercicio o tablero por pantalla, con flechas y cierre discretos,
sin encabezado de material ni selector de vista. El pasaje de lectura se mantiene accesible
al cambiar de pregunta. Los PDF incluyen cada lectura una sola vez y separan los
bancos de relacionar por actividad. La exportación admite hasta 80 preguntas.
El reproductor mantiene la navegación y el botón de terminar/cerrar a la vista;
solo el contenido de las actividades largas necesita desplazamiento, también en móvil.

## Corrección y resultados

- Quiz y verdadero/falso: corrección al elegir, con color y símbolo.
- Huecos y números: confirmar con Enter o Comprobar; cada hueco de un texto también se
  comprueba al salir del campo. Escribir no dispara una corrección prematura.
- Pasapalabra: confirmar cada letra, aciertos verdes, fallos rojos y pasadas diferenciadas;
  se puede volver a cualquier letra antes de terminar y repasar los fallos.
- Relacionar, clasificar y arrastrar: cada colocación se comprueba y puede deshacerse.
- Orden y frase: corrección al confirmar la secuencia. El crucigrama comprueba palabras
  completas; Memory, Ahorcado y sopa de letras mantienen la respuesta inmediata del juego.
- Respuestas abiertas: guardadas y pendientes del profesor, sin nota automática inventada.

Las pistas y soluciones se consultan expresamente. La sesión distingue el primer intento
de los aciertos con ayuda o reintentos mediante `firstGrades` y `practice`; estos datos
acompañan a los campos existentes, sin cambiar el formato de materiales guardados.
Terminar admite ejercicios incompletos y muestra un resumen navegable de resultados,
pendientes y ejercicios para repasar. Repetir el envío no duplica la sesión. La valoración
posterior del profesor actualiza la misma sesión; las pruebas sin alumno no guardan notas.
La corrección, las pistas y el repaso se realizan localmente, sin nuevas peticiones de IA.

## Presentación compartida

`profesor-rich-text.js` presenta texto seguro, énfasis, fórmulas, sistemas y tablas en el
reproductor, la vista previa del editor, el temario y la revisión de sesiones. Los datos
originales y las respuestas usadas para corregir se conservan. KaTeX 0.19.0 se distribuye
localmente con su licencia MIT y fuentes WOFF2; no se depende de un CDN.
[API oficial de KaTeX](https://katex.org/docs/api): renderizado sin comandos de confianza.

Los PDF comparten `teacher_rich_text.py`: tablas reales, pasos separados, fuentes Unicode
incrustadas y fórmulas de Mathtext. Fracciones, raíces, potencias, sistemas y matrices se
presentan visualmente. Mathtext admite un subconjunto de LaTeX; una notación no admitida
conserva un texto legible. No se ejecuta TeX ni se envían fórmulas a servicios externos.
[Mathtext de Matplotlib](https://matplotlib.org/stable/users/explain/text/mathtext.html).
Este cambio requiere reconstruir la imagen de Docker para instalar Matplotlib.

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

## Calidad por pregunta y regeneración individual

El generador nuevo envía `qualityVersion: 1`. Quiz, verdadero/falso y clasificación incluyen
una explicación específica por opción, también para los distractores. Huecos y tableros
guardan una explicación por elemento; cada hueco conserva su razonamiento en el orden real
del texto. Las respuestas numéricas pueden incluir un cálculo elemental verificable.
Los materiales antiguos siguen siendo compatibles sin estos campos.

La práctica muestra el motivo de la opción elegida o del hueco comprobado. La revisión de
sesiones y «Ver solución» conservan las explicaciones. El editor permite modificarlas en
un apartado plegable; el PDF de soluciones las incluye y la ficha del alumno las omite.

El servidor comprueba operaciones aritméticas explícitas, igualdades y simplificaciones
numéricas en las explicaciones, opciones equivalentes y unidades solicitadas reconocidas.
Detecta algunos datos imposibles, como conteos fraccionarios de personas. No ejecuta código
ni intenta verificar automáticamente álgebra simbólica o afirmaciones lingüísticas.
Una comprobación fallida solicita corregir el borrador antes de entregarlo. Las instrucciones
exigen distractores plausibles, pistas inequívocas y razonamientos acordes al objetivo.

«Regenerar esta pregunta» sustituye únicamente la pregunta o tablero actual. Conserva las
demás ediciones, identificadores, grupo, pasaje de lectura y categorías. Admite instrucciones
concretas y deshacer antes de guardar. La regeneración es una petición nueva: consume
**un crédito solo si termina correctamente**; un fallo deja el ejercicio intacto. Reintentar
la misma petición no duplica el cargo. Editar o deshacer localmente no consume créditos.

Referencia de integración: [Structured Outputs de Groq](https://console.groq.com/docs/structured-outputs).
Las restricciones del proveedor se complementan con la validación propia del servidor.

## Verificación

Los materiales incluidos con el catálogo tienen una revisión editorial persistente, sin llamadas de IA al abrirlos. Hay seis actividades por tema, con ejemplos y contrastes específicos y tipos elegidos por su utilidad didáctica. Las copias guardadas se editan independientemente y conservan la revisión de origen. El alcance y las comprobaciones se describen en `profesor-temario.md`.

Pruebas del backend: `test_teacher_question_quality.py`, `test_teacher_generator_quality.py`, `test_teacher_generator.py`,
`test_teacher_pdf.py`, `test_teacher_spanish.py`, `test_teacher_temario.py`,
`test_teacher_support.py`, `test_teacher_rich_text.py` y `test_teacher_math_assets.py`.
Pruebas en navegador: `profesor-generator-quality-browser.cjs`,
`profesor-question-quality-browser.cjs`, `profesor-generator-wizard-browser.cjs` y `profesor-material-renewal-browser.cjs`.
También: `profesor-immediate-practice-browser.cjs`, `profesor-game-feedback-browser.cjs`,
`profesor-activity-play-browser.cjs`, `profesor-new-material-types-browser.cjs`,
`profesor-visual-browser.cjs` y `profesor-temario-presentation-browser.cjs`.
La prueba de calidad cubre selección, cantidades, petición de IA, guardado, rosco de 18
letras, texto de 12 huecos, lectura compartida y móvil de 390 px.

Para desplegar en Hostinger:

```bash
cd /opt/educa-suite && git pull && docker compose --profile proxy up -d --build && docker compose ps
```
