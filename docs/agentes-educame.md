# Agentes de Educame

Puedes dar un encargo distinto a cada agente y reunir varios en un lote. Dos agentes pueden trabajar en paralelo. Revisión empieza después de la entrega que tiene asignada. Los agentes de implementación usan Codex local. Copiador investiga fuentes públicas y prepara ideas para ellos.

## LA TERRAZA

Ejecuta el siguiente comando desde la raíz del proyecto y abre [LA TERRAZA en tu navegador](http://127.0.0.1:4317/).

```powershell
node scripts/educame-dashboard.mjs
```

En Windows, crea **LA TERRAZA** en el escritorio con
`powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File scripts/educame-dashboard/install-shortcut.ps1`.
El acceso directo inicia el panel si hace falta y abre Inicio. Los registros de arranque están en `.educame-agents/`.

Desde **Inicio → Crear un encargo** o **Agentes → Nuevo encargo**, elige la app y escribe el objetivo. El borrador y la selección de agentes se conservan al recargar. Codex se selecciona al escribir si todavía no has elegido un agente. Puedes seleccionar otros especialistas antes de enviar.
En **Conexiones** y **Operación** hay guías cortas junto a cada configuración.

En **Chat con Codex**, selecciona un modelo del catálogo de tu sesión. **Hacer
una pregunta** responde en texto y usa los mensajes recientes como contexto.
**Cambiar LA TERRAZA** prepara un commit del panel en una copia aislada. Abre
**Revisar propuesta** para ver las pruebas y el diff. **Aplicar en este equipo**
requiere que el checkout esté en `main`, sin cambios pendientes y en la
revisión sobre la que se preparó la propuesta. Después, **Reiniciar LA TERRAZA**
carga el código. El historial del chat se guarda localmente.

**Uso de Codex** muestra el porcentaje disponible y la fecha de renovación de
cada ventana que devuelve la sesión de Codex CLI. Se actualiza cada minuto
mientras el panel está visible y también bajo demanda. El total informado por
Codex muestra sus ventanas de uso por separado.
Si una consulta falla, el último dato disponible aparece con su fecha.

### Agentes y trabajos

La misma pantalla reúne tres zonas.

1. **En cola** guarda los encargos que has preparado. **Añadir a la cola** permite seguir preparando mientras otros agentes trabajan. **Empezar cola** inicia los cambios con Codex. Los encargos pasan al seguimiento al empezar y dejan espacio para los siguientes.
2. **En curso** muestra el agente, la app, el objetivo y el estado real de cada encargo. Los resultados con comprobaciones pendientes muestran **Resolver comprobaciones**.
3. **Resultados** permite abrir cada entrega, revisarla, pedir seguimiento y preparar su publicación. El historial conserva también análisis y simulaciones.

**Implementar con Codex** y **Analizar enlaces** ejecutan directamente. **Planificar o probar el encargo** permite preparar un borrador o simular con datos ficticios. **Opciones de la cola** permite simular los encargos guardados, cargar un ejemplo o editar instrucciones individuales.

Los enlaces anteriores `#operaciones` y `#entregas` siguen llevando a sus zonas dentro de Agentes. **Historial de ejecuciones** conserva los grupos enviados.

### Operación

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
3. En **Cuentas y apps**, entra con tu cuenta de superadministración de Educame.
   Busca una cuenta para editar sus datos y licencias, o abre la disponibilidad
   de las aplicaciones para pausar o reactivar una. La sesión local caduca a los
   30 minutos como máximo y el panel usa los mismos permisos y registros de
   auditoría que la administración online.

- **Agentes.** Selecciona la app, los agentes y el resultado que buscas. **Implementar con Codex** usa la sesión local de Codex CLI para editar una copia Git aislada. Con Juegos puedes crear, mejorar o combinar ambas acciones en un pack de hasta diez juegos. **Preparar borrador** usa Codex en modo de lectura u OpenAI API. **Simular** prueba el flujo sin hacer llamadas. Para un lote con instrucciones distintas por agente, edita cada encargo en **Cola de trabajo**.
- **Memoria.** Consulta la ficha de cada app con público, estética, funcionalidades, prioridades, reglas, errores a evitar y comprobaciones. Añade criterios sobre didáctica, accesibilidad, marketing, operación u otras categorías de la ficha. Un agente puede sugerir un aprendizaje. Para incorporarlo, pulsa **Usar propuesta del agente**, ajusta el texto y guarda la revisión con la casilla de Memoria marcada. Las notas y propuestas sin confirmar se quedan en su entrega. Edita o archiva criterios desde Memoria.
- **Resultados de Agentes.** Abre una entrega para ver el siguiente paso. Si Codex dejó una copia con pruebas compatibles, **Volver a comprobar** ejecuta esas pruebas en el equipo sobre la copia aislada. Cuando pasan, revisa la vista local o el código y aprueba el commit. **Preparar publicación** sube la rama y prepara una solicitud de cambios si GitHub está conectado. Un borrador de Marketing aprobado se puede llevar al editor de publicaciones.
- **Conexiones.** En **Agentes e IA** puedes comprobar Codex y configurar una clave de OpenAI como alternativa. Si el panel no detecta una sesión de Codex, inicia sesión con `codex login` y pulsa **Comprobar sesión**. En **Redes sociales**, vincula los perfiles en [Buffer](https://publish.buffer.com/) y guarda su clave API. En **Estadísticas**, habilita Search Console API en Google Cloud, crea un cliente OAuth web, registra la URL de retorno del panel y autoriza la lectura de la propiedad.
- **Vídeo.** Conecta una clave de [Runway](https://dev.runwayml.com/) y describe un clip de cinco segundos en formato vertical u horizontal. La generación usa créditos de Runway. Descarga el MP4 cuando esté listo. Para programarlo después en Buffer, aloja primero el archivo en una URL pública estable.
- **Apps.** Abre los siete productos de Educame, inicia un encargo con la app seleccionada o entra al dashboard online. La etiqueta **En pausa** refleja el estado público de la app.
- **Cambios.** Filtra el historial Git por app y comprueba qué archivos tienes pendientes. **Sincronizar GitHub** actualiza la referencia de `origin/main`. **Vista local** abre la app o su landing con los archivos de tu equipo, incluso los cambios sin commit. Usa datos de ensayo. Para llevar una revisión a Hostinger, comprueba que los cambios aprobados estén en `main` de GitHub y pulsa **Generar comando**. El bloque fija esa revisión y usa el [procedimiento de actualización](../infra/HOSTINGER_UPDATE.md).
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

La copia aislada parte del `HEAD` confirmado en Git al iniciar el lote. Los cambios sin commit del escritorio quedan fuera. Revisión puede continuar desde el commit del agente que le precede. El panel marca **Completado** cuando la entrega tiene cambios permitidos, pasa las comprobaciones registradas y tiene un commit local. Si falta una comprobación o hay errores, la copia queda disponible para continuar el trabajo.

Desde **Revisar solicitud**, comprueba el estado de GitHub y confirma la fusión cuando sus pruebas estén listas. **Continuar a Hostinger** selecciona una revisión de `main` que contiene la entrega. Puedes desplegar por SSH con confirmación o usar **Generar comando** para la consola. Si usas GitHub en el navegador, abre la comparación y usa **Comprobar fusión** en la entrega una vez integrada.

En una entrega de LA TERRAZA puedes **Aplicar en este equipo** tras aprobar el cambio y reiniciar desde el mismo diálogo. Si ya está integrada, **Actualizar LA TERRAZA desde GitHub** trae la versión verificada de `main` cuando Git permite avanzar sin sobrescribir el trabajo local. Los cambios de LA TERRAZA se cargan al reiniciar el programa local.

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
