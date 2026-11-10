# Próxima versión del Centro de mando de Educame

El panel ya reúne los encargos de cinco agentes, ejecuta hasta dos a la vez, guarda borradores y registra decisiones. Su unidad de trabajo es un lote de hasta seis encargos. El siguiente paso es que cada iniciativa tenga un lugar propio, con la app a la que pertenece, el objetivo, las entregas y la decisión pendiente. Así se puede retomar una mejora días después y ver exactamente dónde quedó.

## Cómo se usaría

Al abrir **Hoy**, ves tres listas breves. **Revisar** reúne entregas que esperan tu decisión. **Continuar** señala iniciativas con un siguiente paso. **Resolver** muestra fallos o dependencias, con su causa y la acción disponible. Cada tarjeta lleva a la entrega o a la iniciativa concreta.

En **Apps**, cada producto reúne sus iniciativas, enlaces y criterios propios. En **Flujos**, eliges una plantilla, completas unos pocos campos y revisas el plan antes de ejecutarlo. **Entregas** permite comparar versiones, comentar y aprobar la versión que estás viendo. Las revisiones y los resultados quedan accesibles desde la iniciativa que los originó.

| Plantilla | Datos que introduces | Resultado que puedes revisar |
| --- | --- | --- |
| Crear una misión | App, nivel, destreza y tema | Reglas, preguntas, soluciones, explicación y revisión didáctica |
| Mejorar una pantalla | App, pantalla, captura o descripción y cambio deseado | Propuesta con criterios visuales y comprobaciones para móvil y escritorio |
| Preparar una campaña | App, función verificable, público y canal | Guion, texto, piezas pendientes y enlaces |
| Investigar un fallo | Pasos, resultado esperado y observado | Diagnóstico, propuesta de cambio y prueba que permite reproducir el fallo |

## Orden de construcción

### 1. Iniciativas y bandeja de Hoy

Agrupa los encargos, las versiones, las entregas y las decisiones bajo una iniciativa con nombre, app y objetivo. Conserva los enlaces y el historial actuales. Empieza por dos plantillas, **Crear una misión** e **Investigar un fallo**. La portada se calcula con estados y decisiones reales, con acceso directo a la acción pendiente.

**Prueba de salida.** Crea una iniciativa de Inglés y otra de Profesor Particular. Ejecuta una simulación en cada una, recarga el panel y encuentra el objetivo, las entregas y el siguiente paso de ambas. Abre también una entrega anterior al cambio.

### 2. Revisiones que ayudan a mejorar

Añade **Pedir una nueva versión** para convertir una nota de revisión en un encargo relacionado. Guarda el borrador original y muestra qué cambió en la versión siguiente. Una aprobación apunta a una versión concreta. Con **Proponer criterio**, una nota recurrente se convierte en una propuesta para la guía de desarrollo, con su ámbito y una comprobación. Una vez confirmada, se incorpora al bloque que reciben los agentes.

**Prueba de salida.** Pide corregir dos respuestas ambiguas, compara ambas versiones y aprueba la corregida. Después registra una regla reutilizable y comprueba que aparece en las instrucciones de un encargo posterior.

### 3. Flujos que se pueden retomar

Permite encadenar pasos y ejecutar en paralelo los que tengan entradas independientes. Guarda cada paso antes de lanzarlo y registra su estado, resultado, duración y consumo cuando esté disponible. Al reabrir el panel, muestra los pasos terminados y los interrumpidos. Al reintentar, reutiliza las entregas válidas. Si una llamada quedó en estado incierto, muestra el bloqueo y su motivo.

El primer recorrido completo será **misión → revisión → vista previa local → pieza de marketing**. Marketing recibe la versión validada que se vaya a mostrar. Otro flujo posterior podrá preparar cambios de código en una rama aislada, ejecutar las pruebas y mostrar la diferencia para revisión.

**Prueba de salida.** Interrumpe un lote de ensayo, vuelve a abrirlo y recupera los pasos ya completados. Comprueba que una revisión se queda a la espera de su borrador y que una tarea independiente puede terminar.

### 4. Conexiones y publicación

Empieza con accesos y señales de solo lectura, como el estado de las pruebas de GitHub o un enlace a la vista previa. Después incorpora una acción por canal. Para código, preparar una propuesta revisable con su rama y pruebas. Para redes, abrir una vista previa con texto, pieza, cuenta y destino, y publicar la versión aprobada cuando se indique. Guarda el enlace o identificador devuelto por el servicio.

**Prueba de salida.** Desde una iniciativa, abre las pruebas y su vista previa. Realiza una publicación de ensayo autorizada en el primer canal elegido y comprueba que el panel puede identificarla sin crear otra al repetir el paso.

## Primera entrega propuesta

Construir **Hoy**, la ficha de iniciativa y la plantilla **Crear una misión**. El caso de prueba será «Inglés B2 · Cafetería». Desde un único encargo debe salir un borrador de misión, llegar a Revisión y volver con una decisión visible. Puede ensayarse con la simulación local y después comprobarse con la API configurada.

La [guía de desarrollo](guia-desarrollo-educame.md) define los criterios que usan los agentes. La [guía del piloto](agentes-educame.md) documenta el panel actual. La [hoja de ruta de Educame](roadmap-ecosistema-agentes.md) sitúa este trabajo dentro del plan general.
