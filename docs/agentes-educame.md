# Agentes de Educame

Puedes dar un encargo distinto a cada agente y reunir varios en un lote. Dos agentes pueden trabajar en paralelo. Revisión empieza después de la entrega que tiene asignada. Los agentes de implementación admiten Codex local, OpenAI API o Claude API. Copiador investiga fuentes públicas con Codex o con la búsqueda de OpenAI y prepara ideas para ellos.

## LA TERRAZA

Ejecuta el siguiente comando desde la raíz del proyecto y abre [LA TERRAZA en tu navegador](http://127.0.0.1:4317/).

```powershell
node scripts/educame-dashboard.mjs
```

En Windows, crea **LA TERRAZA** en el escritorio con
`powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File scripts/educame-dashboard/install-shortcut.ps1`.
El acceso directo inicia el panel si hace falta y abre Inicio. Los registros de arranque están en `.educame-agents/`.

Desde **Encargos**, escribe lo que necesitas en cualquier app o en LA TERRAZA y pulsa **Añadir a la cola**. También puedes preguntar. El coordinador elige los especialistas y pregunta en la misma pantalla cuando falta una decisión necesaria. Puedes seguir añadiendo encargos mientras trabaja; el borrador se conserva al recargar.

Cada tarea tiene una tarjeta con su estado: **En cola**, **En curso**, **Subiendo a GitHub**, **Completado**, **Necesita atención** o **Deshecho**. Completado en una implementación significa que GitHub ha confirmado la subida. Los resúmenes y resultados se pueden desplegar en la tarjeta. No hay que aprobar, previsualizar ni pulsar Subir.

La implementación, la revisión y las pruebas se hacen en copias aisladas. Una entrega con errores se conserva; los encargos independientes pueden continuar. **Pedir ajuste** continúa desde esa copia y utiliza el mismo formulario. **Reintentar** tras un fallo de subida retoma la publicación sin ejecutar de nuevo al implementador. Los identificadores y recibos se guardan en SQLite antes de iniciar cada operación para recuperar una interrupción sin duplicarla.

**Deshacer última subida** publica un commit nuevo con el contenido anterior. Conserva el historial y comprueba que no haya cambios posteriores. La cola nunca vuelve a subir una entrega deshecha. Los enlaces antiguos a chat, agentes, cola o entregas abren ahora la misma pantalla Encargos.

En **Motor y modelo** puedes elegir Codex local, OpenAI API o Claude API. La API tiene su propia facturación. Las claves permanecen en Conexiones y el proveedor no cambia sin indicarlo. **Gestionar agentes** conserva el editor de perfiles. El contexto, criterios, modelo y revisión se fijan al empezar el encargo y se conservan al retomarlo.

El programa local sigue funcionando con la ventana cerrada mientras permanezca encendido el proceso de LA TERRAZA. Al publicar cambios del propio panel, se carga la versión nueva al quedar libre la cola. Subir a GitHub y desplegar en Hostinger siguen siendo operaciones distintas: el despliegue está en Operación.

### Imágenes de referencia

Pulsa **Adjuntar imágenes**, pega una captura con Ctrl+V o arrastra archivos al formulario. Admite hasta cuatro PNG, JPG o WebP de 5 MB cada uno. Las miniaturas permiten ampliar y quitar referencias antes de enviar. Escribe junto a ellas lo que quieres hacer.

Las referencias se conservan con el borrador de cada subchat, el mensaje en cola y sus aclaraciones. Llegan también al implementador y al revisor; **Pedir ajuste** recupera las del trabajo anterior y permite cambiarlas. Un reintento conserva los mismos identificadores y no duplica la subida ni el encargo.

Los archivos permanecen en `.educame-agents/chat-images/`, con su índice en SQLite. No se añaden a GitHub ni a las exportaciones de memoria. Codex los recibe como imágenes locales; OpenAI y Claude reciben el contenido visual por su API. Las subidas y las miniaturas son locales y no requieren actualizar Hostinger. Conserva todo el directorio `.educame-agents/` en tus copias locales para recuperar conversaciones y referencias.

### Operación avanzada (opcional)

1. En **GitHub**, conecta un token de acceso limitado al repositorio de Educame
   con **Checks** de lectura, **Contents** de lectura y escritura y **Pull
   requests** de lectura y escritura. Abre una solicitud desde una entrega ya
   subida o selecciona una existente. Revisa los archivos, espera a que se
   completen las pruebas y confirma el código corto para fusionar ese commit.
2. En **Hostinger**, introduce un alias de OpenSSH de Windows o
   `usuario@servidor`. El VPS debe reconocer la clave del equipo y OpenSSH debe
   tener verificada la identidad del servidor. **Probar conexión** consulta la
   instalación. **Preparar despliegue** muestra la revisión actual y la revisión
   elegida de `main`. Tras confirmar, el VPS ejecuta
   [el procedimiento de actualización](../infra/HOSTINGER_UPDATE.md) y conserva
   el estado del intento aunque cierres el panel. **Generar comando** está
   disponible en Hostinger y en Cambios para usar la consola del VPS.
3. **Dashboard online** abre la administración de Educame. Allí se crean usuarios,
   se cambian contraseñas y licencias, se configura la IA y se administra el acceso
   a cada producto. GADEOS y las nuevas apps aparecen con sus propias cuentas.
   LA TERRAZA conserva la edición de las apps y sus contenidos, con sesión
   administrativa cifrada de hasta treinta minutos cuando requiere guardar en el servidor.

- **Encargos.** Pide crear o mejorar varios juegos en un mismo mensaje, indicando app, tema y nivel. La cola elige los especialistas, aplica sus criterios y conserva el contexto de cada parte. Gestionar agentes permite personalizar los perfiles; Copiador mantiene el análisis de fuentes públicas.
- **Memoria.** Consulta la ficha de cada app con público, estética, funcionalidades, prioridades, reglas, errores a evitar y comprobaciones. Añade criterios sobre didáctica, accesibilidad, marketing, operación u otras categorías de la ficha. Un agente puede sugerir un aprendizaje. Para incorporarlo, pulsa **Usar propuesta del agente**, ajusta el texto y guarda la revisión con la casilla de Memoria marcada. Las notas y propuestas sin confirmar se quedan en su entrega. Edita o archiva criterios desde Memoria.

  **Contexto actualizado** muestra la revisión local, un inventario de archivos y los cambios de esa app integrados desde LA TERRAZA. Los nuevos lotes reciben ese contexto automáticamente y conservan la misma copia al retomarlos. Incluye referencias a ilustraciones del repositorio para reutilizar su estética. La referencia `origin/main` puede estar desactualizada; no describe el despliegue del VPS.

  Después de subir una entrega, sus propuestas útiles aparecen en **Aprendizajes por confirmar**. **Guardar como criterio** las incorpora a futuros encargos; **Descartar propuesta** evita volver a ofrecerlas. Ningún borrador se convierte por sí solo en una regla permanente.

  En **Copiar o mover la memoria**, descarga un JSON con criterios y perfiles, o un Markdown de la app seleccionada para facilitarlo a otro proveedor de IA. No se exportan claves, conexiones, cuentas, conversaciones ni encargos. Al importar el JSON primero ves lo que se incorporará y los conflictos que se conservarán. **Importar sin sustituir lo actual** confirma las nuevas reglas y perfiles; la repetición del mismo archivo no duplica entradas. Las fichas y las guías base siguen versionadas en GitHub y el contexto Git se reconstruye en el equipo de destino. Importar memoria no añade soporte de ejecución para otro proveedor.
- **Resultados.** Lee el resumen en la tarjeta del encargo. La subida de implementaciones a GitHub es automática. Un borrador de Marketing aprobado se puede llevar al editor de publicaciones.
- **Conexiones.** En **Agentes e IA** puedes comprobar Codex y configurar claves de OpenAI y Claude como alternativas para preguntar e implementar. Si el panel no detecta una sesión de Codex, inicia sesión con `codex login` y pulsa **Comprobar sesión**. En **Redes sociales**, vincula los perfiles en [Buffer](https://publish.buffer.com/) y guarda su clave API. En **Estadísticas**, habilita Search Console API en Google Cloud, crea un cliente OAuth web, registra la URL de retorno del panel y autoriza la lectura de la propiedad.
- **Vídeo.** Conecta una clave de [Runway](https://dev.runwayml.com/) y describe un clip de cinco segundos en formato vertical u horizontal. La generación usa créditos de Runway. Descarga el MP4 cuando esté listo. Para programarlo después en Buffer, aloja primero el archivo en una URL pública estable.
- **Apps.** Conecta Administración para crear apps o editar contenido en el servidor. Cada tarjeta abre subchats de App, Landing y Redes sociales con borradores e historial separados. Las nuevas apps arrancan como espacios con cuentas y guardado; pide su adaptación desde App. GADEOS es personal: **Editar contenido** modifica planning, preguntas, respuestas, cartas e imágenes; **Gestionar usuarios** abre su ficha en el dashboard online. Allí están las cuentas, contraseñas y los estados Pública, Privada y Pausada. [Guía de apps privadas](apps-privadas-gadeos.md).
- **Cambios.** Filtra el historial Git por app y comprueba qué archivos tienes pendientes. **Consultar GitHub** actualiza la referencia de `origin/main`; no despliega nada. El indicador de Hostinger consulta la imagen en ejecución y el recibo de comprobaciones de `/api/public/release` y los compara con `main` remoto y el commit local. Solo muestra Sincronizado si todo coincide; en caso contrario distingue Pendiente y Sin verificar. Una subida nueva invalida la lectura anterior. **Comprobar Hostinger** fuerza una consulta; el panel también la renueva periódicamente. **Vista local** abre la app o su landing con los archivos de tu equipo, incluso los cambios sin commit. Usa datos de ensayo. Para llevar una revisión a Hostinger, comprueba que los cambios aprobados estén en `main` de GitHub y pulsa **Generar comando**. El bloque fija esa revisión y usa el [procedimiento de actualización](../infra/HOSTINGER_UPDATE.md).
- **Teoría.** La [guía de Educame](../scripts/educame-dashboard/theory-library.js) explica las apps y el panel. La [ruta de desarrollo](../scripts/educame-dashboard/theory-development.js) recorre herramientas, frontend, backend, arquitectura, infraestructura y un proyecto guiado. Cada ruta conserva su progreso en el navegador. Cuando un flujo nuevo aporte algo que aprender, añade un ejemplo verificable al catálogo correspondiente y conserva los identificadores existentes.
- **Publicar.** Elige perfiles, revisa el texto y confirma si quieres que Buffer lo envíe ahora o lo añada a su cola. Para imágenes y vídeos, pega la URL HTTPS pública del archivo. El historial indica la respuesta de Buffer por perfil. Si un envío queda sin confirmar, comprueba primero el resultado en Buffer. [Formatos de medios](https://developers.buffer.com/guides/hosting-media)
- **Estadísticas.** Google muestra clics, impresiones, CTR, posición, consultas y páginas por periodo. Redes muestra los datos que Buffer ofrece para cada perfil autorizado. Actividad local reúne entregas, simulaciones y envíos recientes.

Las credenciales guardadas desde Conexiones se cifran en el equipo. El almacén y la clave local quedan en `.educame-agents/`, fuera de Git. El servidor escucha en la dirección de bucle local.

En **Agentes → Gestionar agentes**, puedes crear un agente o editar el nombre, la
descripción y las instrucciones de uno existente. Las instrucciones de
borrador, implementación y trabajo en equipo se editan por separado. Usa
**Preparar encargo** para seleccionar el agente desde su ficha, o selecciónalo en
la cola junto con el resto. **Restaurar valores originales** recupera el perfil
de un agente de Educame. El editor de Copiador admite instrucciones adicionales y
muestra sus reglas base de investigación.

Los perfiles se guardan en la base local del panel. Cada lote fija los perfiles
al empezar y usa esa versión al retomarlo. Para comprobar un cambio, guarda la
ficha, selecciona el agente y simula un encargo nuevo desde Agentes.

| Agente | Qué puedes pedirle | Qué entrega |
| --- | --- | --- |
| Mantenimiento (`mantenimiento`) | «Estos son los pasos y el error al recuperar una partida» | Corrección en la app y comprobación reproducible |
| Juegos (`juegos`) | «Crea dos misiones de inglés y mejora una que ya existe» | Juegos integrados con mecánicas, soluciones y pruebas |
| Marketing (`marketing`) | «Simplifica la entrada de la landing y enseña un juego real» | Cambios en la landing, demostración o piezas del repositorio |
| Adaptación (`adaptacion`) | «Implementa una demo de inglés para hostelería usando el motor actual» | Demo con recorrido y código reutilizado |
| Revisión (`revision`) | «Comprueba las soluciones y corrige los errores reproducibles» | Comprobaciones y correcciones sobre el commit que recibe |
| Copiador (`copiador`) | «Fíjate en el recorrido y las primeras acciones de estas tres webs» | Observaciones con fuente e ideas propias con beneficio, esfuerzo y una prueba |

## Analizar webs y redes

En **Agentes → Copiador**, elige la app y pega hasta seis enlaces públicos, uno por línea. Puedes añadir qué quieres investigar. **Analizar enlaces** abre un análisis con el buscador de Codex o, si la eliges como motor, la API de OpenAI. Si una publicación requiere iniciar sesión, puedes aportar su descripción o un extracto en Contexto. El informe distingue la consulta de una página, los datos parciales y el acceso sin confirmar.

En **Entregas → Análisis de enlaces** están los resultados. Cada idea indica qué patrón se puede adaptar, cómo probarlo y qué agente encaja. **Preparar encargo** abre el formulario de ese rol con la app y la propuesta. Puedes editarlo antes de guardarlo o implementarlo. El análisis se guarda en el historial. Para reutilizar un aprendizaje de forma habitual, confírmalo desde la revisión de la entrega.

## Retomar un lote

El panel guarda cola, criterios, revisiones y progreso de los lotes en `.educame-agents/panel.sqlite`. En el primer arranque importa `panel.json` si existe y conserva el archivo original. Si el proceso se cierra durante un lote, **Agentes → Retomar trabajo** recupera las entregas guardadas y ejecuta los encargos pendientes con los criterios que se aplicaban al empezar. Los encargos enviados cuyo resultado no se pudo confirmar se marcan como **Interrumpido**. Para una implementación, la copia aislada queda disponible en `.educame-agents/worktrees/`.

## Revisar y subir código

Para responder a una implementación, escribe qué quieres ajustar y pulsa **Pedir cambios**. El agente recibe la nota y continúa desde el código anterior. Los análisis sin implementación siguen preparando un encargo editable con el contexto original.

El formulario de ajustes conserva el texto y el identificador del envío al recargar o fallar la conexión. La entrega ya fija el motor y el modelo: enviar un ajuste no depende de que el catálogo de modelos esté disponible en ese momento. **Resultado y comprobaciones** permite consultar el resultado sin abandonar la cola y mantiene abierto el detalle durante el sondeo.

En el chat directo de consulta, Codex pregunta cuando falta una decisión necesaria. **Responder** conserva la petición original y sus restricciones, incluso tras recargar. Responder a esa aclaración sigue siendo una consulta; no convierte la conversación en una implementación por cambiar la opción del formulario.

La copia aislada parte del `HEAD` confirmado en Git al iniciar el lote. Los cambios sin commit del escritorio quedan fuera. Revisión puede continuar desde el commit del agente que le precede. El panel marca **Completado** cuando la entrega tiene cambios permitidos, pasa las comprobaciones registradas y tiene un commit local. Si falta una comprobación o hay errores, la copia queda disponible para continuar el trabajo.

El recorrido habitual termina con la subida automática confirmada por GitHub. La operación avanzada permite además revisar solicitudes de GitHub y desplegar en Hostinger por SSH con confirmación, o generar el comando para su consola.

Cada subida guarda su resultado antes de empezar la siguiente. Una revisión fallida conserva su copia y no bloquea los encargos independientes. La batería completa `npm.cmd test` tiene un límite de diez minutos; las comprobaciones individuales mantienen tres minutos. Agotar el tiempo sigue siendo un fallo y no permite publicar.

Si una entrega antigua se integra directamente en el repositorio, su cierre local debe señalar el commit comprobado en `main` remoto mediante `externalCompletion`. La reconciliación admite encargos antiguos con un solo `taskId` y los actuales con varios. Conserva el fallo original y las copias aisladas para diagnóstico; no vuelve a ejecutar ni presenta como verificada la copia antigua. Los recibos de publicación fallidos pueden quedar resueltos con esa referencia sin atribuirles una subida que no realizaron.

Las entregas de LA TERRAZA se aplican y recargan automáticamente al subirlas. Los archivos técnicos de la entrega siguen guardados para diagnóstico, aunque la pantalla no muestre sus pruebas.

Desde la raíz del proyecto, abre la vista previa del lote. Usa Node.js 24, igual que las pruebas del repositorio.

```powershell
node scripts/educame-agents.mjs scripts/educame-agents.example.json
```

El ejemplo arranca Juegos y Marketing en paralelo. Revisión empieza al terminar Juegos, aunque Marketing siga trabajando. Para dar tus propios encargos, prepara un lote privado con estos comandos y modifica el agente, el encargo y el contexto.

```powershell
New-Item -ItemType Directory -Path .educame-agents -Force | Out-Null
Copy-Item -LiteralPath scripts/educame-agents.example.json -Destination .educame-agents/mi-lote.json
```

Usa un identificador nuevo para cada versión. Puedes poner un solo encargo en un lote. Si `revisar` señala otro encargo, pon ese encargo antes en el mismo archivo.

Para una ejecución real, configura una clave de proyecto de la API de OpenAI en la variable de entorno `EDUCAME_AGENTS_API_KEY` de la sesión donde vas a trabajar. El piloto usa `gpt-5.4-mini` por defecto. Puedes elegir otro modelo compatible con Responses y salidas estructuradas mediante `EDUCAME_AGENTS_MODEL`. [OpenAI Docs sobre GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini) · [OpenAI Docs sobre salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs)

```powershell
node scripts/educame-agents.mjs scripts/educame-agents.example.json --ejecutar
```

Cada lote real carga el bloque breve de la [guía de desarrollo](guia-desarrollo-educame.md) y la [ficha del proyecto](../scripts/educame-dashboard/project-context.mjs). En los lotes de consola puedes indicar `app` como en el ejemplo. El modelo también recibe el encargo, el contexto manual y hasta diez criterios confirmados de la app y cinco generales. Prioriza coincidencias con el encargo y da espacio a distintas categorías cuando hay pocos criterios relevantes. Los encargos de todo Educame reciben hasta quince criterios generales. Revisión hereda la app de la entrega. El contexto que recibió cada encargo se puede consultar en su entrega. Usa ejemplos ficticios o material que puedas compartir con la API. Las respuestas y los criterios quedan en `.educame-agents/`. Cada lote admite hasta seis encargos. En la API de OpenAI se reservan hasta 2.000 tokens de salida por borrador y hasta 4.500 por análisis de enlaces.

Repetir un lote con los mismos identificadores, criterios y configuración reutiliza los resultados guardados. Usa un identificador nuevo para volver a encargar un trabajo con una guía distinta. Si un encargo falla, las tareas independientes continúan y su revisor espera. Para volver a intentarlo, comprueba primero el estado de la llamada y usa un identificador nuevo. Si la ejecución se interrumpe y queda un directorio `.lock`, confirma que el proceso terminó y comprueba si OpenAI recibió el encargo antes de retirar ese bloqueo.

La [propuesta de evolución](plan-centro-de-mando.md) recoge ideas para los siguientes bloques.


Las entregas de implementación se muestran en la lista, sin abrir un detalle. La cola comprueba e integra automáticamente en main. Deshacer última subida crea otra revisión con el contenido anterior a esa subida; exige que main local y remoto sigan en esa revisión. Conserva el historial y no actualiza Hostinger automáticamente. Una subida conjunta se deshace completa.
