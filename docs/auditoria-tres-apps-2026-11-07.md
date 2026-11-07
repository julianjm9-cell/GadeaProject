# Auditoría interna y plan de cierre de las tres aplicaciones

Fecha: 7 de noviembre de 2026. Versión revisada: `90e5028`.

Aplicaciones: Profesor Particular, ESO Adultos y Título de inglés/Cambridge.

Esta entrega es una auditoría y un plan. No modifica código de las aplicaciones, cuentas, contenido, licencias ni Hostinger. Las reproducciones usan datos ficticios y bases aisladas.

## Condición de trabajo acordada

Conservar los avances del temario, todos los juegos, los materiales guardados, los perfiles, el progreso y la navegación conseguida. El objetivo es consolidar y pulir lo existente. Cada cambio posterior debe mantener los identificadores y el formato de los datos históricos, o incluir una conversión compatible y comprobada.

No propongo una reescritura general, sustituir el escritorio, retirar juegos ni introducir de forma obligatoria pagos automáticos, nuevas cuentas de alumnos o servicios externos.

## Resultado de la revisión

Hay una base funcional que conviene conservar. Las pruebas de catálogos y navegador comprueban contenido estructurado, corrección de los casos ensayados, navegación, adaptación de pantalla y recuperación en varios flujos. También hay fallos concretos que deben resolverse antes de la siguiente entrega y diferencias de fiabilidad entre aplicaciones.

Los hallazgos se distinguen así:

- **Fallo comprobado:** reproducido con código o datos aislados, o verificado en la configuración de publicación.
- **Riesgo técnico:** existe el patrón que puede provocarlo, pero no se ha medido aquí su incidencia con tráfico real.
- **Mejora:** oportunidad de calidad, claridad o mantenimiento; no significa que la función actual esté rota.

## Lo que funciona y debe protegerse

- Profesor Particular: el catálogo tiene 351 temas con estructura y material preparado; los 61 juegos destacados se abren sin excepciones. Los controles de preferencias de curso/asignatura y los catálogos privados, públicos, avanzados y de temario tienen pruebas específicas.
- ESO Adultos: existen 65 temas, 260 lecciones y 520 preguntas asociadas a unidades. El catálogo comprueba los tres modos propios de juego por tema, 195 combinaciones, además de los enlaces externos.
- Inglés: las pruebas recorren las 18 lecciones y las 10 misiones por nivel. Comprueban reanudación, guardado entre navegadores, conflicto entre pestañas, Writing, OCR simulado, Speaking simulado y progreso por destreza.
- Las pruebas actuales pasan en Chromium y WebKit para tamaños de teléfono, tableta y escritorio. Los cuatro tipos de audio de Listening B2 se reproducen y pausan en ambos motores.
- Profesor Particular ya dispone de renovación de sesión, borradores por cuenta, recuperación de ediciones y copias históricas. Inglés dispone de copias locales pendientes y detección de conflictos. Las tres aplicaciones utilizan controles de versión en los guardados revisados.

Estas comprobaciones no equivalen a una revisión pedagógica humana de cada enunciado, ni a una prueba de cada combinación de contenido largo o de cada dispositivo físico.

## Hallazgos prioritarios

### A01. El script nuevo de notificaciones no se empaqueta para Hostinger

**Fallo comprobado. Prioridad alta.**

Las páginas nuevas solicitan `/app-notifications.js`. La ruta busca primero el archivo del proyecto y después el recurso empaquetado. `backend/Dockerfile` copia individualmente los scripts de la raíz de Profesor Particular, pero omite `app-notifications.js`. Copiar la carpeta de imágenes y CSS no incorpora ese archivo.

Consecuencia: puede funcionar en el equipo de desarrollo y devolver 404 en la imagen Docker. Las campanas nuevas no se inicializarían. No se ha confirmado en esta auditoría qué revisión está ejecutando ahora el servidor.

Evidencia: `backend/Dockerfile`, `backend/app/api/app_routes.py:801`, `apps/profesor/app-notifications.js` y las referencias añadidas en las cinco páginas.

Corrección prevista: incluir el recurso y probar las rutas de la imagen construida, sin permitir que la prueba utilice los archivos del checkout como alternativa.

### A02. La migración nueva falla si la tabla ya nace con el modelo actual

**Fallo comprobado. Prioridad alta.**

La migración 0024 crea las tablas importando los modelos vigentes. Esos modelos ahora incluyen `product_code`. La 0025 intenta añadir esa columna y su índice sin comprobar si existen.

Reproducción aislada: crear el esquema con el modelo vigente y ejecutar 0025 devuelve `duplicate column name: product_code`. La secuencia afecta a una instalación nueva o a una actualización que tenga que crear todavía la tabla de notificaciones. La prueba que pasa sobre una tabla antigua no cubre ese caso.

Evidencia: `backend/alembic/versions/0024_profesor_notifications.py:12`, `backend/alembic/versions/0025_app_notifications.py:11` y el modelo de notificaciones.

Corrección prevista: migraciones compatibles con ambas situaciones y pruebas de actualización desde una base antigua y de instalación desde cero. Conservar los mensajes existentes como avisos de Profesor Particular.

### A03. ESO permite sustituir el progreso por un objeto vacío sin confirmación

**Fallo comprobado. Prioridad alta.**

En una cuenta ficticia se guardaron temas completados y apuntes. Después, un POST con `{}` y el ETag vigente devolvió 200 y la lectura posterior devolvió `{}`. Los controles de versión evitan una pestaña anticuada, pero no impiden este vaciado con versión actual.

Cambridge y Profesor Particular ya incluyen una confirmación especial para vaciar el estado; ESO no tiene esa protección equivalente.

Evidencia: `backend/app/api/app_routes.py:1950`, función `save_state`.

Corrección prevista: validación del estado de ESO, protección de vaciado y comprobación de que omitir campos importantes no borra silenciosamente apuntes o progreso. No convertir un fallo de carga en un escritorio nuevo.

### A04. ESO conserva los cambios pendientes solo en la pantalla

**Limitación comprobada. Prioridad alta.**

Cuando falla `saveState`, ESO muestra un error, permite reintentar, ofrece descargar JSON y avisa antes de cerrar. No conserva una copia recuperable por cuenta en almacenamiento local. Si se cierra el navegador o el sistema termina la pestaña móvil, puede perderse el trabajo todavía no guardado.

Profesor Particular e Inglés ya tienen mecanismos de copia local; conviene trasladar el patrón a ESO sin sobreescribir automáticamente una versión más nueva del servidor.

Evidencia: `apps/e25/index.html:6187` y comparación con `profesor-editor-recovery.js` y `cambridgePendingKey`.

Corrección prevista: copia local por usuario y pestaña, recuperación explícita, guardado visible y límite de tamaño. Decidir la extensión de las cinco copias diarias a las otras apps conservando la política pequeña de retención que ya se pidió; no crear decenas de copias.

### A05. La caducidad de sesión se resuelve de forma distinta entre apps

**Comportamiento comprobado. Prioridad alta.**

Profesor Particular intenta renovar la sesión y repetir la petición tras un 401. ESO e Inglés no hacen lo mismo en los clientes revisados. Una reproducción de sus funciones con una respuesta 401 produce estas rutas, sin llamar a `/auth/refresh`:

- ESO: `/login?next=/eso-adultos`.
- Inglés: `/login?expired=1`, sin destino de regreso.

El acceso tiene una duración configurada por defecto de 30 minutos. Esto puede interrumpir una sesión de estudio aunque el usuario aún disponga de una sesión renovable. El cliente nuevo de notificaciones tampoco implementa renovación.

Evidencia: `apps/profesor/index.html:232`, `apps/e25/index.html:6101`, `apps/cambridge/index.html:2522`, `apps/profesor/app-notifications.js:12` y `backend/app/config.py`.

Corrección prevista: un cliente de peticiones común, renovación única ante peticiones simultáneas, vuelta a la app adecuada y conservación de borradores. Repetir automáticamente solo operaciones que puedan reintentarse con seguridad.

### A06. Las peticiones generales de IA pueden bloquear el hilo que atiende otras peticiones

**Riesgo técnico importante; pendiente de reproducción con PostgreSQL concurrente.**

`ensure_credit_balance` ejecuta SQL síncrono con `SELECT ... FOR UPDATE` sobre el usuario. Las rutas `async` de chat, OCR y transcripción mantienen la transacción durante la espera del proveedor. Otra petición del mismo usuario puede esperar por el bloqueo mediante SQL síncrono dentro del bucle asíncrono del servidor.

Esto merece una prueba específica: el bloqueo puede interferir con la finalización de la primera petición y afectar al servicio con muy poco tráfico simultáneo. No se atribuye aquí una incidencia real del VPS a este patrón.

Evidencia: `backend/app/api/app_routes.py:408`, `:2553`, `:2631` y `:2672`.

Corrección prevista: reserva de créditos y transacciones cortas, admisión por cuenta y ejecución fuera del hilo asíncrono cuando corresponda. Tomar como referencia los trabajos recuperables de Profesor Particular. Comprobar gasto único y liberación de reservas en fallos.

### A07. El tratamiento de fallos de IA y el coste operativo no son uniformes

**Diferencia comprobada; impacto dependiente del proveedor. Prioridad media/alta.**

Profesor Particular tiene reintentos, admisión y medición de llamadas del generador. Las rutas generales de chat, OCR y transcripción no pasan todas por el mismo mecanismo. Hay errores que indican al alumno que revise «Admin > IA». En chat, el cambio de modelo visto en el código no constituye una reserva general Groq → Gemini para las tres apps.

La señal operativa mensual usa registros `ProviderCall`, mientras que las llamadas generales se registran en `UsageRecord` con coste estimado cero. Ese resumen no debe interpretarse como el gasto completo de la suite.

Evidencia: `backend/app/api/app_routes.py:438`, `:2553`, `:2631`, `:2672`, `backend/app/services/provider_metering.py` y `operation_health.py`.

Corrección prevista: errores con mensaje para el usuario, reintento y estado recuperable; reglas explícitas para la reserva de proveedor por capacidad; medición por app y diferenciación entre coste desconocido y coste cero. No almacenar prompts o respuestas privadas en la telemetría operativa.

### A08. El servidor de recompensas acepta actividades inexistentes

**Fallo lógico comprobado. Prioridad media.**

Una cuenta de ESO obtuvo 100 XP al enviar `TOPIC_COMPLETED` con `source_id=tema-inexistente-auditoria`, sin completar ningún tema. Se valida el formato del identificador y se evitan duplicados exactos, pero no se acredita el logro contra el catálogo o el progreso.

El impacto observado es la fiabilidad del escritorio y sus estadísticas; no se ha demostrado acceso a datos de otras cuentas.

Evidencia: `backend/app/services/gamification.py:221`, `:259` y la ruta de recompensas.

Corrección prevista: comprobar identificadores y evidencia de finalización en el servidor. Mantener el inventario y las recompensas legítimas ya conseguidas.

## Calidad educativa y rejugabilidad

### A09. Los tests de estructura no sustituyen la revisión didáctica

**Mejora prioritaria de contenido.**

No se ha encontrado un nuevo error general de montaje de los catálogos. Sí conviene revisar la dificultad y la utilidad de las preguntas. En varias misiones de Historia y Ciencias hay distractores que se pueden descartar por ser ajenos al contexto. Por ejemplo, en una pregunta sobre organización obrera, una opción propone «Volver al Imperio romano». La actividad resulta resoluble por descarte sin comprender el objetivo.

La auditoría de contenidos de ESO identifica 14 unidades etiquetadas como revisadas en profundidad, 11 desarrolladas manualmente y 40 guiadas completas. Estas etiquetas describen la construcción del catálogo; no demuestran por sí mismas la calidad de cada unidad.

Trabajo propuesto: revisión por familias de juego y materia, respuestas alternativas justificadas, unidades y tolerancias numéricas, explicación del error cometido y distractores plausibles. Conservar los enunciados buenos y corregir cada problema localizado; no rehacer todo automáticamente con IA.

### A10. El repaso de ESO repite siempre la misma selección y las parejas mezclan temas

**Comportamiento comprobado; oportunidad de mejora.**

`topicQuiz` toma siempre las cuatro primeras preguntas redactadas de la unidad, aunque existen ocho. `topicPairs` construye parejas con el título/descripción del tema y de tres temas vecinos. Funciona como asociación de índice, pero en ocasiones practica reconocer títulos más que aplicar lo aprendido en ese tema.

Evidencia: `apps/e25/assets/eso-games.js:31` y `:59`.

Trabajo propuesto: alternar de forma controlada preguntas del banco, dar prioridad a errores anteriores y construir parejas de conceptos reales del tema. Guardar la semilla/versión del intento para que la corrección no cambie durante una partida.

### A11. El alcance de Inglés debe seguir mostrándose con precisión

**Mejora de producto.**

El recorrido guiado tiene seis lecciones por nivel y diez misiones en conjunto, repartidas de forma desigual. Listening integrado es B2. La interfaz y la comunicación comercial deben ayudar a entender qué está disponible por destreza y nivel.

Trabajo propuesto: visibilidad clara de cobertura, próximos pasos y límites de una corrección orientativa; ampliar después los huecos de mayor utilidad. No presentar estas prácticas propias como examen oficial ni modificar el progreso guardado al ampliar el banco.

### A12. Los juegos externos necesitan una revisión editorial periódica

**Mejora de coherencia y mantenimiento.**

Son enlaces a la página del autor, no contenido copiado. La asignación de un enlace a cada tema no garantiza una equivalencia exacta de nivel o destreza. Por ejemplo, el enlace externo de Listening de ESO se reutiliza para un diálogo de compras.

Trabajo propuesto: comprobar que el juego sigue disponible, si contiene audio cuando se anuncia Listening y si corresponde al nivel. Mostrar que es externo y ofrecer volver a la app; no atribuir resultados que no se reciben del proveedor. Una comprobación HTTP no reemplaza jugar la actividad.

## UX, interfaz y rendimiento

### A13. Consolidar los patrones que ya han funcionado

**Mejora; las pruebas adaptables actuales pasan.**

Conservar encabezados estables, filtros en tarjeta, contenidos de tema desplegables, fondos elegibles y escenas actuales. Revisar por tarea completa: entrar, encontrar el contenido, jugar, entender el resultado y continuar.

Prioridades de pulido: estados vacíos útiles, cierre de modales sin perder trabajo, retorno al punto anterior de la biblioteca, botones de siguiente paso, foco de teclado, textos largos y feedback entendible sin depender solo de rojo/verde. En móvil, permitir desplazamiento útil cuando sea necesario, en vez de reducir excesivamente letras o zonas táctiles para forzar que todo quepa.

La calidad visual de las escenas debe servir a la acción: zonas de respuesta reconocibles, objetos que reaccionan al acierto y errores que indican cómo corregirse. Reutilizar los fondos existentes y mejorar primero el tablero y sus objetos.

### A14. Hay margen importante para reducir peso sin cambiar la estética

**Medición local.**

| Página fuente | HTML sin comprimir | Estimación local con gzip |
| --- | ---: | ---: |
| Profesor Particular | 368 KiB | 98 KiB |
| ESO Adultos | 602 KiB | 156 KiB |
| Inglés | 410 KiB | 96 KiB |

Estas cifras son del HTML, sin sumar scripts, audios o imágenes; no son una medida de velocidad real del VPS.

Hay PNG de escenas y portada de entre 1,4 y 2,6 MB. Ejemplos: `public-bosque-fieldbook-v2.png`, las tres escenas PNG de Cambridge y el hero de Profesor Particular. La configuración Caddy revisada no activa compresión de respuestas de forma explícita.

Trabajo propuesto: variantes WebP/AVIF donde mantengan la calidad, tamaños adecuados para miniaturas y móvil, dimensiones reservadas y carga diferida. Activar compresión y medir el recorrido de red antes/después. El contenido privado y los guardados deben seguir fuera de la caché compartida.

### A15. La organización del código dificulta comprobar una entrega completa

**Riesgo de mantenimiento comprobado en la estructura.**

ESO e Inglés contienen gran parte de estilos, datos y lógica en una misma página; Profesor Particular combina una página grande y muchos módulos y hojas de estilo. El backend central de rutas también agrupa funciones de productos distintos. El empaquetado enumera scripts manualmente.

La automatización actual comprueba el backend y parte de Profesor Particular, pero no ejecuta las pruebas actuales de navegador ni toda la cobertura de ESO e Inglés. Los tests de navegador dependen de una ruta absoluta del equipo Windows y algunos usan puertos fijos o nombres antiguos de la interfaz.

Trabajo propuesto: separar por responsabilidad de forma gradual, sin reescribir los formatos guardados ni cambiar la navegación. Crear una lista única de recursos publicables y una suite pequeña de regresión de las tres apps que pueda ejecutarse también fuera de este ordenador.

Una prueba de ESO ha quedado desactualizada: espera `public-biblioteca-inference.webp` y el código usa la escena nueva `public-biblioteca-inference-scene.webp`. Clasificar esto como mantenimiento del test; no retirar la imagen nueva para satisfacer una expectativa antigua.

## Plan por bloques de trabajo

| Bloque | Trabajo incluido | Criterio para cerrarlo |
| --- | --- | --- |
| **1. Publicación fiable** | A01–A02. Empaquetado de recursos, migración de notificaciones, prueba de instalación nueva y actualización conservando cuentas. | La imagen Docker sirve cada script necesario. Las migraciones pasan desde cero y desde una copia antigua. Se conservan avisos y estados existentes. |
| **2. Proteger el trabajo y la continuidad** | A03–A05. Guardado vacío de ESO, validación compatible, copia local por cuenta/pestaña, recuperación explícita y renovación común de sesión. Valorar cinco copias diarias por app sin ampliar indiscriminadamente la retención. | Una interrupción de red, cierre de pestaña móvil, 401 o conflicto no pierde el trabajo ensayado. Ninguna recuperación sustituye datos nuevos sin confirmación. Regreso a la app original tras entrar. |
| **3. IA y concurrencia** | A06–A07. Reproducción con PostgreSQL, transacciones cortas, reservas, peticiones recuperables, reintentos con identificador y errores para usuarios. Medición de coste por app. | Dos peticiones simultáneas no congelan el servidor ni duplican el cargo. Fallo, saturación y reintento conservan entradas. El dashboard distingue gasto conocido y desconocido. |
| **4. Calidad educativa y progreso** | A08–A12. Recompensas acreditadas, revisión de distractores, variantes válidas, feedback por respuesta, banco de repaso y enlaces externos. Trabajar por familias y materia. | Cada problema detectado tiene un caso de regresión. Acierto, fallo y equivalente válido se corrigen coherentemente en juego individual y compartido. Inventario y progreso anteriores se conservan. |
| **5. Pulido de UX/UI** | A13. Recorridos completos, modales, estados vacíos, orientación, foco, teclado/tacto, textos largos y tableros integrados con su temática. | Un usuario puede encontrar contenido, terminar la actividad y saber qué hacer después. Pantallas comprobadas en móvil/tableta/escritorio y WebKit/Chromium; sin controles tapados ni letra sacrificada para evitar scroll útil. |
| **6. Velocidad y mantenimiento** | A14–A15. Optimización de imágenes, compresión, carga por sección y separación gradual de lógica/estilos/datos. Suite reproducible para las tres apps y recursos de la imagen final. | Comparativa medida de peso/carga y pruebas verdes. Misma estructura de datos, contenido e interacciones. El despliegue no depende de archivos que solo existen en el equipo local. |
| **7. Cierre para marketing y operación** | Recorrido de alta y primera actividad por app, expectativas de acceso/créditos/cobertura, revisión de pantallas públicas y señales operativas de las tres. Prueba de carga aislada y restauración con una copia de la entrega. | Lista concreta de funciones anunciables y límites reales. Prueba de regreso y guardado con cuentas nuevas/antiguas. Errores operativos visibles, copia restaurable y una versión identificable a la que volver. |

Orden recomendado: 1 → 2 → 3 → 4. El bloque 5 puede abordarse después con los recorridos ya estables. El 6 se aplica de forma gradual y se valida antes del cierre 7. No hace falta esperar a incorporar nuevas funciones para realizar estos bloques.

## Propuestas opcionales para elegir después

1. **Avisar de un ejercicio dudoso desde el propio juego.** Enviar al dashboard el identificador, versión y motivo indicado, sin adjuntar automáticamente datos de alumnos. Facilita mantener calidad educativa con uso real.
2. **Repaso breve de errores pendientes.** Extender los cuadernos y revisiones existentes a un recorrido de cinco minutos, con preguntas revisadas y sin consumo de IA obligatorio.
3. **Demostración jugable compartible por app.** Aprovechar los juegos públicos y demos actuales para enseñar una actividad real desde redes, con contexto claro y entrada posterior con Google. Nunca usar una ficha privada como demostración.
4. **Guía discreta para la primera sesión.** Señalar las primeras dos o tres acciones y permitir cerrarla; reutilizar el onboarding existente de Profesor Particular.

No incluiría estas propuestas automáticamente en el bloque de correcciones: requieren decidir cuáles aportan más a tus usuarios.

## Verificación y límites de esta entrega

- JavaScript de catálogos y flujos: **100 pruebas; 99 aprobadas y 1 expectativa de imagen desactualizada**, descrita en A15.
- Comprobación de temario: **351 temas de Profesor Particular** y estructura de **65 unidades/260 lecciones de ESO**, con **520 preguntas** de unidad.
- Navegadores: **25 pruebas automatizadas aprobadas**: dos suites de compatibilidad, catorce de audio/recuperación/guardado/biblioteca y nueve adicionales de Inglés en WebKit. Además, apertura de los **61 juegos destacados** sin excepciones.
- Backend: **458 pruebas aprobadas**, con un aviso, en 7 minutos y 4 segundos. La ejecución incluye acceso, cuentas, seguridad, límites, guardado, sesiones, generación, documentos y migraciones cubiertas por la suite. Los fallos adicionales descritos muestran huecos de esa cobertura, no fallos detectados por esas 458 pruebas.
- Reproducciones adicionales aisladas: columna duplicada en migración, guardado vacío de ESO, recompensa de tema inexistente y salida por 401 sin renovación en ESO/Inglés.
- No se han hecho llamadas de generación de pago, envíos de avisos a usuarios ni cambios en producción. Las pruebas de foto y micrófono usan medios/respuestas simulados, salvo la reproducción de archivos de audio locales.
- La revisión actual no sustituye una evaluación pedagógica externa ni una observación de usuarios reales. Tampoco permite prometer una capacidad de concurrencia del VPS que no se ha medido.

El siguiente paso de ejecución, si se aprueba el plan, es el bloque 1. Antes de cada bloque debe registrarse la versión de partida, preservar los datos y comprobar los recorridos afectados al terminar.
