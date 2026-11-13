# Guía de desarrollo de Educame

Educame reúne herramientas para profesores particulares y para personas que preparan estudios o exámenes. Cada app debe permitir empezar una tarea enseguida y retomar después lo que ya se hizo. El sistema de agentes usa un resumen de esta guía en cada lote real.

## Criterios que reciben los agentes

<!-- agentes:inicio -->
**Criterios compartidos de Educame**

- Facilita el primer paso. Deja clara la acción principal, usa palabras sencillas y muestra controles secundarios cuando hagan falta. Mantén navegación y estética coherentes dentro de cada app.
- La ambientación debe ayudar a entender el juego. Si hay un tren, muestra vagones reconocibles y encaja las respuestas en ellos. Elige una estética apropiada para la edad y respeta la apariencia guardada.
- Da a cada juego un objetivo didáctico, reglas breves y respuestas defendibles. Explica los errores, permite continuar y muestra un resultado que corresponda a lo que hizo la persona.
- Piensa en móvil desde el principio. Asegura controles visibles, tacto y teclado, foco claro, contraste y movimiento reducido. Comprueba Chromium y WebKit cuando afecte a la interfaz.
- Protege el trabajo ya guardado. Conserva la identidad del producto, los datos, el progreso y las preferencias. Considera recarga, reintentos, doble pulsación y respuestas tardías.
- Profesor Particular combina gestión privada del profesor con práctica por código sin cuenta de alumno. ESO Adultos favorece el estudio directo y la autocorrección. Inglés organiza la práctica por nivel y usa la estética Ruta en Inicio y Juegos. Su landing explica Juegos, Temario y Práctica.
- Usa datos ficticios en pruebas y demos. Marketing se basa en funciones verificadas en la versión que se va a mostrar. Distingue borrador, prueba, aprobación y publicación.
- Deja una entrega concreta con resultado, comprobaciones y dudas. Trabaja en paralelo solo si los cambios son independientes. Para un pack de juegos, comprueba y explica el resultado de cada juego.
<!-- agentes:fin -->

## Producto e interfaz

- **Inicio y navegación.** La pantalla tiene que decir qué puedes hacer aquí, cuál es el siguiente paso y cómo volver. Evita encabezados o controles duplicados que le quiten espacio a la tarea. Un cambio de tema visual debe llegar al fondo, las tarjetas y los botones, con lectura cómoda y una opción reconocible para recuperar el estilo original.
- **LA TERRAZA.** Inicio da acceso a Agentes y al chat. Reúne la preparación, la cola, el progreso y los resultados en Agentes y trabajos. Las implementaciones enseñan su resultado directamente, con Subir y Deshacer última subida; los análisis conservan su vista de lectura. Guarda el borrador y deja añadir encargos mientras otros se ejecutan. Usa marfil, verde oliva y fotografía editorial. Comprueba creación, recarga, reintento, ejecución y revisión en escritorio y móvil.
- **Ilustración.** Usa imágenes que expliquen la función, como un tablero de vocabulario para Juegos o una vista de calendario para planificación. Verifica la carga en la ruta servida, el recorte en móvil y el aspecto de las tarjetas en estados vacíos. Mantén disponibles las acciones al pasar del escritorio al móvil.
- **Profesor Particular.** Mantén a mano alumnos, calendario y tareas. Usa curso y asignatura juntos al filtrar, conserva la diferencia entre materiales guardados y catálogos y permite encontrar los juegos destacados. Mantén las fichas de alumnos en el espacio privado del profesor. Para juego por código, separa las respuestas de las fichas y describe con precisión qué datos se piden. Verifica límites y tipo de cuenta en el servidor. [Privacidad y operación](../infra/TEACHER_PRIVACY_OPERATIONS.md) · [Límites del plan](profesor-plan-limits.md)
- **ESO Adultos.** Haz visibles el temario, la práctica y el avance real. La entrada a Exámenes presenta Practicar, Simulacro, Corregir examen e Historial. Una corrección por foto debe dejar revisar el texto detectado, recuperar el borrador y distinguir qué versión se corrigió. Los apuntes se leen con formato y los temas ofrecen una actividad que se puede comprobar. [Flujo de exámenes](eso-examenes-flujo.md)
- **Inglés.** Temario, Juegos, Práctica y Biblioteca tienen accesos claros. Juegos abre un recorrido vertical continuo con la próxima misión visible y el catálogo como alternativa. Integra el arte de las misiones y los accesos en la superficie completa de la tarjeta con contraste suficiente. La vista pública «Explora la app» muestra las cuatro funcionalidades mediante ejemplos de interfaz. Comprueba en móvil que se distinguen la siguiente acción y las paradas bloqueadas y que la vista pública se recorre sin jugar. [App](../apps/cambridge/index.html) · [Landing](../marketing/app_landings_demo/cambridge.html)
- **Landings.** Explica el producto con una imagen relacionada, una acción de entrada y texto fácil de recorrer. Verifica que el contenido y los metadatos describan la versión que se ofrece. Usa el nombre público de cada producto y términos que un usuario buscaría de forma natural.

## Qué debe superar una partida

1. Una persona identifica el objetivo, entiende dónde tocar y puede empezar sin leer un manual. El escenario sugiere la acción, como elegir un vagón, ordenar una ruta o colocar una pista.
2. Cada consigna tiene nivel y objetivo. Las soluciones son verificables y las alternativas admitidas están documentadas. Una respuesta errónea explica qué revisar. Un resultado distingue aciertos, intentos y avance.
3. El tablero y los botones caben en pantallas pequeñas. Las soluciones y avisos tienen su espacio y se pueden cerrar. Si hay arrastre, ofrece también una forma de elegir origen y destino por toque o teclado cuando corresponda.
4. Comprueba una partida completa, un error, un reintento y una recarga en las variantes y navegadores afectados. Usa un resultado guardado anterior cuando cambies el formato o el modo de guardar.

## Entregas entre agentes

| Agente | Encargo mínimo | Evidencia o material para entregar |
| --- | --- | --- |
| Mantenimiento | App, pantalla, pasos, resultado esperado y fallo observado | Diagnóstico, cambio acotado y prueba reproducible |
| Juegos | Nivel, tema, destreza, mecánica y variante visual | Reglas, respuestas y explicaciones, ejemplos de prueba y material para una partida de revisión |
| Marketing | Función verificada, versión, público y canal | Guion y texto, enlace de destino y afirmaciones que requieren comprobación |
| Adaptación | Público, problema, señal de demanda y app de referencia | Recorrido de la demo, piezas que se pueden reutilizar y pruebas de compatibilidad |
| Revisión | Encargo original, entrega y evidencia | Dictamen, fallos reproducibles, comprobaciones pendientes y cambios concretos |
| Copiador | App de destino, enlaces públicos y foco del análisis | Observaciones con fuente, límites de acceso e ideas adaptadas con comprobaciones |

En paralelo, Juegos y Marketing pueden avanzar con entradas independientes. Si Marketing va a mostrar un juego nuevo, su versión revisada es una entrada del guion. Cuando dos cambios tocan la misma pantalla o el mismo formato de datos, acuerda el alcance antes de integrar.

En el Centro de mando, las entregas de implementación muestran el resultado sin abrir una vista detallada. El propietario elige **Subir** y puede **Deshacer última subida**. Subir integra y comprueba los cambios antes de guardarlos en main. Deshacer crea una nueva revisión con el contenido anterior a la última subida del panel, sin borrar el historial; se bloquea si hay cambios posteriores locales o remotos. Conserva las revisiones para reintentar sin duplicar. Si la web requiere actualizarse, ofrece el siguiente paso de Hostinger. Copiador conserva su vista de análisis y sus fuentes.

## Cómo incorporar lo aprendido

- El Centro de mando guarda la decisión y la nota al aprobar un borrador o pedir cambios. Usa la nota para describir el resultado que esperabas y lo que observaste. Una corrección puntual se queda en el encargo. Si el criterio debe aplicarse en trabajos futuros, confírmalo en **Memoria** con su ámbito y una comprobación. Las convenciones estables de cada producto se resumen en su [ficha base](../scripts/educame-dashboard/project-context.mjs).
- Cada agente puede tener instrucciones propias desde **Agentes → Gestionar agentes**. Los cambios se aplican cuando empieza un lote nuevo. Comprueba que un lote interrumpido conserva las instrucciones con las que arrancó y que sus entregas conservan el nombre registrado del agente.
- Para una regla nueva, escribe **observación → decisión → comprobación**. Si una solución tapaba los botones, ábrela en un espacio propio con cierre claro y comprueba que puedes volver al juego con los controles accesibles.
- El panel lee el bloque breve al iniciar cada lote real. Mantén ahí solo criterios generales y útiles para el equipo. Añade los casos específicos en las secciones de producto o en la documentación de la app. Evita incluir conversaciones completas, credenciales o datos de usuarios.
- Si una decisión nueva sustituye a otra, edita la regla y conserva el motivo en Git. Prioriza la petición más reciente, verifica el repositorio y distingue lo que está en local de lo que ya está publicado.
