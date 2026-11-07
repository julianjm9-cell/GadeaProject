# Plan de reactivación · Título de inglés

**Estado del plan (7 de noviembre de 2026):** ING-01 a ING-05B están implementados localmente. También hay cuatro partes de Listening B2, un recorrido integrado, progreso por nivel y destreza y lecciones y misiones propias de C1/C2. El alcance, las pruebas y las limitaciones actuales están en el [plan de cierre](plan-cierre-ingles.md). Faltan las pruebas con cuenta, foto y micrófono reales, la validación de IA en producción y el despliegue de la versión nueva.

## Qué producto queremos recuperar

Un entrenador de preparación para **B2 First, C1 Advanced y C2 Proficiency**. El recorrido principal será: **elegir nivel → hacer una práctica de hoy → entender los errores → volver a practicarlos → medir el avance por destreza**. La interfaz explica en español y las tareas se hacen en inglés. Se puede empezar con una práctica corta y retomar una sesión o un borrador después.

La propuesta es que los tres niveles sigan accesibles desde el primer día y que el catálogo nuevo se publique **primero en B2**, luego en C1 y después en C2. Así se puede revisar un nivel completo antes de multiplicar contenido y mecánicas. El diseño de nivel y parte se contrastará con el formato oficial de [B2 First](https://www.cambridgeenglish.org/es/exams-and-tests/qualifications/first/format/), [C1 Advanced](https://www.cambridgeenglish.org/exams-and-tests/qualifications/advanced/format/) y [C2 Proficiency](https://www.cambridgeenglish.org/exams-and-tests/qualifications/proficiency/format/). Los materiales nuevos serán propios o tendrán permiso de uso. Las muestras oficiales se ofrecerán mediante enlaces, identificando su procedencia.

## Punto de partida comprobado en el código

| Área | Estado actual | Decisión |
| --- | --- | --- |
| App y acceso | La app se sirve en `/cambridge` y su landing en `/cambridge-info`. Usa el producto CAMBRIDGE y el estado por cuenta de la suite. | Mantener rutas, licencias, cuentas y el identificador del producto durante la transición. |
| Estudio | Ya hay nivel B2/C1/C2, sesión diaria, biblioteca temática, Profesor IA, historial y exportaciones. | Mantener estos recorridos accesibles mientras se incorpora una biblioteca con lecciones y práctica verificables. |
| Guardado | Si falla el servidor, el cliente puede pasar a `localStorage` sin aviso. La revisión mediante ETag que protege ESO Adultos y Profesor Particular todavía no se aplica al estado de Cambridge. | Resolver primero carga, conflictos y recuperación. Preservar borradores, sesiones, notas, historial y preferencias existentes. |
| Speaking y Writing | Hay grabación, transcripción, corrección, escritura, modelos y OCR de imagen. | Conservar y simplificar. Verificar voz y foto reales en la fase correspondiente, con una cuenta de prueba. |
| Listening y exámenes | Listening aparece en el catálogo de temas. No hay una entrada principal dedicada a práctica con audio ni un centro de simulacros integrado en la navegación. | Incorporar audio, corrección propia y simulacros por parte. |
| Juegos y progreso | No hay pestaña de juegos propia. El progreso parte de temas y sesiones guardadas. | Añadir juegos vinculados al temario y separar constancia, dominio, resultados de simulacro y recompensas. |
| Landing | La página anuncia B2–C2 y dirige a la entrada común. | Actualizarla con recorridos y capturas que correspondan a funciones ya disponibles. |

## Qué trasladar de las otras apps

| Origen | Qué se aprovecha | Adaptación a inglés |
| --- | --- | --- |
| ESO Adultos | Sesión breve guiada, lecciones por bloques, autocorrección y navegación de exámenes. | Nivel y destreza siempre visibles. Elegir tema, practicar por parte o continuar un intento. |
| ESO Adultos | Estado de guardado visible, reintento, protección entre pestañas y escritorio con objetos combinables. | Preservar los datos de Cambridge y dar al estudio un espacio propio. Recompensas separadas del dominio lingüístico. |
| Profesor Particular | Catálogo con filtros y tarjetas, mecánicas de frase, error, clasificación y escenas con respuestas integradas. | Reutilizar patrones de interacción y controles. Redactar consignas, distractores y explicaciones adecuados a B2, C1 y C2. |
| Ambas | Validación en escritorio y móvil, flujos de errores de IA, pruebas WebKit y comprobación posterior al despliegue. | Añadir casos de micrófono, audio y fotos en iPhone real, además de las pruebas de navegación y juegos. |

## Entregas y condiciones de cierre

| ID | Entrega | Se puede cerrar cuando… |
| --- | --- | --- |
| **ING-01** | **Guardado y recuperación.** Inventariar datos actuales. Incorporar revisiones, guardado visible, reintento y recuperación o exportación de cambios pendientes. Versionar el estado si hace falta. Tratar el almacenamiento de demostración y los cambios pendientes de cuentas reales por separado. | Una cuenta antigua conserva todos sus datos. Dos pestañas no se sobrescriben. Una caída al cargar no permite enviar un estado vacío. Una caída al guardar conserva el borrador y ofrece una acción clara. Se prueba aislamiento por cuenta y producto. |
| **ING-02** | **Inicio y navegación.** Proponer **Inicio · Biblioteca · Entrenar · Juegos · Progreso**, con el nivel en la cabecera y el perfil aparte. Inicio ofrece «Continuar» y una sesión de 15, 30 o 45 min. Entrenar agrupa las destrezas. | Cambiar de nivel filtra contenidos nuevos sin esconder el acceso al historial anterior. Se puede volver a un borrador y a una sesión desde la portada. Las secciones nuevas se muestran a medida que tienen contenido funcional. |
| **ING-03** | **Primera ruta B2.** Biblioteca filtrable por destreza, tema, parte de examen y estado. Crear fichas con objetivo, explicación, ejemplo comentado, práctica, corrección y repaso. Primer lote propuesto: collocations, open cloze, word formation, key word transformations, Reading y Writing. | Las seis fichas se pueden completar, retomar y revisar. Cada ejercicio tiene solución contrastada y explicación. El contenido ya disponible en B2/C1/C2 sigue accesible. |
| **ING-04** | **Juegos B2, primera tanda.** Lanzar las tres misiones descritas más abajo. Compartir catálogo, estado de partida y componente de resultados. Acceso desde Juegos y desde la lección relacionada. | Se puede terminar, repetir, salir y retomar cada misión. Acertar produce un cambio visible en la escena. Los errores pueden guardarse para repaso. La partida funciona con ratón, tacto y teclado. |
| **ING-05A** | **Writing.** Ejercicios por género y nivel, borrador, contador de palabras, foto opcional, OCR revisable y comparación entre versiones. Feedback con contenido, adecuación comunicativa, organización y lengua, con ejemplos de mejora. | Un error de OCR o IA no borra el original. El alumno puede corregir el texto reconocido y guardar ambas versiones. Se prueba una foto real y queda clara la diferencia entre práctica y calificación oficial. [Guía de evaluación de Writing](https://www.cambridgeenglish.org/Images/167804-c1-advanced-handbook.pdf). |
| **ING-05B** | **Speaking.** Consigna y preparación, grabar, escuchar, transcribir, editar, recibir feedback y repetir. Añadir práctica con fotos y turnos guiados cuando corresponda al nivel. | Funciona con permiso concedido o denegado, grabación repetida y formatos de navegador verificados. El feedback basado en texto cubre el texto transcrito. Cualquier análisis de pronunciación o interacción requiere una señal y una validación propias. |
| **ING-06** | **Listening y simulacros.** Publicar clips propios con reproductor, soluciones y transcripción en la revisión. Empezar por bloques cronometrados con navegación entre preguntas, guardado y resumen por parte. | Se verifica reproducción, pausa, reanudación y corrección. Las reglas de repetición, tiempo y puntuación se configuran por nivel y parte. Un «simulacro completo» solo se ofrece cuando reúne las partes anunciadas. |
| **ING-07** | **Progreso y repaso.** Panel por destreza y nivel, historial de intentos, errores que reaparecen, repaso espaciado sencillo y recomendaciones que explican por qué toca una actividad. Después, escritorio ilustrado con objetos por capas. | El alumno distingue intento, acierto con ayuda, dominio y recompensa. Repetir una petición no duplica premios. Los datos nuevos están aislados por producto y se pueden recalcular desde intentos identificados. |
| **ING-08A** | **Pack C1.** Adaptar las mecánicas útiles con contenido original de inferencia, postura, registro y precisión léxica. Ampliar lecciones y práctica por partes. | C1 tiene ejercicios propios y criterios por destreza. Cada caso acepta variantes lingüísticas válidas donde proceda. Se revisan distractores y dificultad. |
| **ING-08B** | **Pack C2.** Incorporar matiz, reformulación, síntesis y contraste de fuentes. Construir tareas específicas para sus diferencias de formato. | C2 tiene corpus, consignas y correcciones propios. El catálogo y el historial separan resultados B2, C1 y C2. |
| **ING-09** | **Relanzamiento.** Landing con demo jugable, capturas reales, guías por nivel, SEO y comprobación de Hostinger. Valorar entrada con Google reutilizando el flujo de la suite y probar vinculación con cuentas existentes antes de ofrecerla. | Se entra desde las rutas públicas y se retoma la cuenta anterior. La demo funciona sin permisos sensibles ni llamadas de IA. El despliegue prueba carga, guardado, acceso y partida completa. Acceso para altas nuevas, límites de IA y precios se deciden antes de anunciarlos. |

**Orden de trabajo:** ING-01 → ING-02 → ING-03 → ING-04. Ese es el primer corte que se puede enseñar: una ruta B2 con tres juegos completos sobre una app que guarda de forma fiable. ING-05A y 05B se pueden abordar por separado. ING-06 precede a los juegos que requieren audio. ING-07 aprovecha intentos e historiales ya estables. C1 y C2 entran como packs independientes. ING-09 publica lo que haya superado la revisión de cada bloque.

## Juegos que sí sirven para preparar inglés

| Juego | Destreza | Qué hace el alumno | Resultado visible |
| --- | --- | --- | --- |
| **La sala de edición** · B2 inicial | Use of English | Completa huecos en un artículo, cambia formas de palabras y revisa el contexto. | Las correcciones aparecen en el propio texto y el artículo pasa a edición final. |
| **El archivo de pistas** · B2 inicial | Reading | Selecciona el fragmento que apoya una respuesta o descarta una interpretación. | La prueba se adjunta a la ficha del caso y se muestra por qué es relevante. |
| **La máquina de reformular** · B2 inicial | Key word transformations | Escribe una equivalencia con la palabra dada. Recibe feedback sobre significado, forma y longitud. | La frase se valida dentro de la máquina y queda emparejada con la original. |
| **El correo que decide** · B2 ampliación | Writing y registro | Construye un mensaje adecuado al destinatario y luego escribe su versión completa. | El correo se compone en la escena y se puede pasar al borrador de Writing. |
| **Radio de última hora** · tras ING-06 | Listening | Escucha varios mensajes y asocia cada uno con el detalle o la intención correcta. | Cada pista completa el panel de la redacción. La revisión permite escuchar y consultar la transcripción. |
| **Mesa de negociación** · C1 | Speaking | Elige cómo proponer, discrepar o llegar a un acuerdo y justifica su decisión en voz alta. | El mapa de propuestas se actualiza turno a turno. |
| **Juicio de las fuentes** · C2 | Reading y síntesis | Contrasta dos textos, localiza sus matices y prepara una síntesis breve. | Se construye un informe con evidencias de ambas fuentes. |

Los tres juegos iniciales usarán ilustraciones pensadas para sus objetos jugables, con preguntas y controles en HTML. Las respuestas cerradas se corrigen con un banco revisado y las variantes válidas se registran por ejercicio. Las producciones abiertas se llevan a práctica guiada o feedback orientativo. En el modo de práctica se permiten pistas. En el modo examen se aplican las reglas de la parte y la revisión llega al terminar.

## Cómo retomar el trabajo entre las tres apps

- Pedir un bloque por ID basta, por ejemplo **«Haz ING-01»**. Si se interrumpe, el siguiente mensaje puede ser **«Sigue con inglés»** y se retoma el primer punto pendiente de ese bloque.
- Al cerrar cada bloque, actualizar aquí su estado, qué quedó validado, los pendientes y el commit o enlace de revisión. Cada entrega debe poder probarse y publicarse por sí sola.
- Mantener las entregas de inglés en cambios separados de ESO Adultos y Profesor Particular. Si se toca autenticación, estado, IA, CSS o despliegue compartidos, comprobar las tres apps antes de cerrar.
- Separar cada prueba en **navegador local**, **dispositivo real** y **producción**. Registrar en cuál se verificó el resultado, especialmente para micrófono, OCR y guardado. Antes de una migración, probar con datos representativos anonimizados y definir cómo volver atrás.

### Registro

| Bloque | Estado | Próxima acción |
| --- | --- | --- |
| ING-01 | Implementado en local | ETag por estado Cambridge, rechazo de conflicto y vaciado no confirmado, aviso de guardado, copia local pendiente separada por cuenta y descarga/recuperación si la revisión coincide. Validar una cuenta antigua real en Hostinger. |
| ING-02 | Implementado en local | Navegación Inicio, Biblioteca, Ruta B2, Entrenar, Juegos y Progreso; nivel en cabecera; sesión y borrador accesibles desde Inicio. C1/C2 conservan biblioteca y funciones anteriores. |
| ING-03 | Implementado en local | Seis lecciones B2 con explicación, ejemplo, pregunta autocorregida, reintento, registro de intentos y filtros por texto, destreza, parte y estado. |
| ING-04 | Implementado en local | Tres misiones B2 con respuestas integradas en escenas, etapas persistentes, reinicio, reintento y repaso de errores al terminar. Validado en navegador local. |
| ING-05A | Implementado en local; falta prueba OCR real | Formatos y objetivos de palabras por nivel y parte, consignas propias, borrador y versiones comparables, revisión del texto OCR antes de insertarlo e informe orientativo por cuatro criterios. El modelo se muestra aparte y una respuesta tardía no reemplaza un borrador nuevo. Probar una foto real con una cuenta de prueba y confirmar guardado en servidor. |
| ING-05B | Implementado en local; faltan pruebas reales de audio e IA | Consignas propias por nivel, grabación, reproducción/descarga, transcripción revisable, borrador persistente y revisión orientativa limitada al texto. Validar permisos de micrófono, transcripción y revisión con cuenta habilitada en producción. |
| ING-06 | Primer tramo implementado en local | Las cuatro partes B2 y el recorrido de 30 preguntas funcionan. Los audios enlazados existen y se reproducen en Chromium y WebKit. No se anuncia como simulacro oficial; falta comprobar audio en dispositivos reales y ampliar otros niveles si se decide ofrecerlos. |
| ING-07 | Primer tramo implementado en local | Progreso por nivel y destreza, partidas únicas y revisión de errores. Un sistema de repaso espaciado y recompensas más complejo sigue como posible ampliación, no como función ya publicada. |
| ING-08A e ING-08B | Primer tramo implementado en local | C1 y C2 tienen seis lecciones y dos misiones propias de cinco etapas cada uno. Falta revisión pedagógica externa y ampliar práctica por partes antes de prometer preparación exhaustiva. |
| ING-09 (primera parte) | Implementado en local | Landing nueva con ilustración y demo B2 jugable, acceso directo con Google y contenido coherente con las funciones existentes. Falta validar Google con cuentas reales y el despliegue. Detalle en el [plan de cierre](plan-cierre-ingles.md). |

**Verificación actual:** consulta la matriz y los límites del [plan de cierre](plan-cierre-ingles.md). Los recorridos de navegador incluyen Chromium y WebKit; eso no sustituye una prueba en Safari y dispositivos reales. No se ha probado todavía con una cuenta existente de producción, micrófono ni una foto real en OCR. Los objetivos de palabras se contrastaron con el [formato B2 First](https://www.cambridgeenglish.org/exams-and-tests/qualifications/first/format/?skill=writing), [C1 Advanced](https://www.cambridgeenglish.org/exams-and-tests/qualifications/advanced/format/) y [C2 Proficiency](https://www.cambridgeenglish.org/exams-and-tests/qualifications/proficiency/format/) oficiales.

**Referencias internas:** [App Cambridge](../apps/cambridge/index.html), [landing actual](../marketing/app_landings_demo/cambridge.html), [estado y acceso de la suite](../backend/app/api/app_routes.py), [auditoría de las dos apps](auditoria-profesor-eso-2026-10-27.md), [plan de juegos ilustrados](plan-juegos-avanzados-profesor-eso.md), [progreso de ESO Adultos](eso-progreso-integracion.md).
