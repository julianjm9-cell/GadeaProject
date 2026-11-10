# Agentes de Educame

Puedes dar un encargo distinto a cada agente y reunir varios en un lote. Dos agentes pueden trabajar en paralelo. Revisión empieza después de la entrega que tiene asignada. Los cinco roles pueden implementar con Codex local.

## Centro de mando local

Ejecuta el siguiente comando desde la raíz del proyecto y abre [Educame en tu navegador](http://127.0.0.1:4317/).

```powershell
node scripts/educame-dashboard.mjs
```

- **Agentes.** Selecciona la app, los agentes y el resultado que buscas. **Implementar con Codex** usa la sesión local de Codex CLI para editar una copia Git aislada. Con Juegos puedes crear, mejorar o combinar ambas acciones en un pack de hasta diez juegos. **Preparar borrador** usa Codex en modo de lectura u OpenAI API. **Simular** prueba el flujo sin hacer llamadas. Para un lote con instrucciones distintas por agente, edita cada encargo en **Cola de trabajo**.
- **Memoria.** Consulta la ficha de cada app con su estética, funcionalidades, reglas y comprobaciones. Añade un criterio verificable aquí o desde la revisión de una entrega. Un agente puede sugerir un aprendizaje. Para incorporarlo, pulsa **Usar propuesta del agente**, ajusta el texto si hace falta y guarda la revisión con la casilla de Memoria marcada. Las notas y propuestas sin confirmar se quedan en su entrega. Edita o archiva criterios desde Memoria.
- **Entregas.** Abre el resultado, consulta sus archivos y pruebas, y guarda tu decisión. Una implementación completada tiene un commit y una vista local de la app cuando está disponible. Tras aprobarla, **Subir a GitHub** publica esa revisión en su rama `codex/educame-…` y ofrece abrir la comparación para crear una solicitud de cambios. Un borrador de Marketing aprobado se puede llevar al editor de publicaciones.
- **Conexiones.** En **Agentes e IA** puedes comprobar Codex y configurar una clave de OpenAI como alternativa. Si el panel no detecta una sesión de Codex, inicia sesión con `codex login` y pulsa **Comprobar sesión**. En **Redes sociales**, vincula los perfiles en [Buffer](https://publish.buffer.com/) y guarda su clave API. En **Estadísticas**, habilita Search Console API en Google Cloud, crea un cliente OAuth web, registra la URL de retorno del panel y autoriza la lectura de la propiedad.
- **Vídeo.** Conecta una clave de [Runway](https://dev.runwayml.com/) y describe un clip de cinco segundos en formato vertical u horizontal. La generación usa créditos de Runway. Descarga el MP4 cuando esté listo. Para programarlo después en Buffer, aloja primero el archivo en una URL pública estable.
- **Apps.** Abre los siete productos de Educame, inicia un encargo con la app seleccionada o entra al dashboard online. La etiqueta **En pausa** refleja el estado público de la app.
- **Cambios.** Filtra el historial Git por app y comprueba qué archivos tienes pendientes. **Sincronizar GitHub** actualiza la referencia de `origin/main`. **Vista local** abre la app o su landing con los archivos de tu equipo, incluso los cambios sin commit. Usa datos de ensayo. Para llevar una revisión a Hostinger, comprueba que los cambios aprobados estén en `main` de GitHub y pulsa **Generar comando**. El bloque fija esa revisión y usa el [procedimiento de actualización](../infra/HOSTINGER_UPDATE.md).
- **Teoría.** La [guía de Educame](../scripts/educame-dashboard/theory-library.js) explica las apps y el panel. La [ruta de desarrollo](../scripts/educame-dashboard/theory-development.js) recorre herramientas, frontend, backend, arquitectura, infraestructura y un proyecto guiado. Cada ruta conserva su progreso en el navegador. Cuando un flujo nuevo aporte algo que aprender, añade un ejemplo verificable al catálogo correspondiente y conserva los identificadores existentes.
- **Publicar.** Elige perfiles, revisa el texto y confirma si quieres que Buffer lo envíe ahora o lo añada a su cola. Para imágenes y vídeos, pega la URL HTTPS pública del archivo. El historial indica la respuesta de Buffer por perfil. Si un envío queda sin confirmar, comprueba primero el resultado en Buffer. [Formatos de medios](https://developers.buffer.com/guides/hosting-media)
- **Estadísticas.** Google muestra clics, impresiones, CTR, posición, consultas y páginas por periodo. Redes muestra los datos que Buffer ofrece para cada perfil autorizado. Actividad local reúne entregas, simulaciones, tokens y envíos recientes.

Las credenciales guardadas desde Conexiones se cifran en el equipo. El almacén y la clave local quedan en `.educame-agents/`, fuera de Git. El servidor escucha en la dirección de bucle local.

| Agente | Qué puedes pedirle | Qué entrega |
| --- | --- | --- |
| Mantenimiento (`mantenimiento`) | «Estos son los pasos y el error al recuperar una partida» | Corrección en la app y comprobación reproducible |
| Juegos (`juegos`) | «Crea dos misiones de inglés y mejora una que ya existe» | Juegos integrados con mecánicas, soluciones y pruebas |
| Marketing (`marketing`) | «Simplifica la entrada de la landing y enseña un juego real» | Cambios en la landing, demostración o piezas del repositorio |
| Adaptación (`adaptacion`) | «Implementa una demo de inglés para hostelería usando el motor actual» | Demo con recorrido y código reutilizado |
| Revisión (`revision`) | «Comprueba las soluciones y corrige los errores reproducibles» | Comprobaciones y correcciones sobre el commit que recibe |

## Retomar un lote

El panel guarda cola, criterios, revisiones y progreso de los lotes en `.educame-agents/panel.sqlite`. En el primer arranque importa `panel.json` si existe y conserva el archivo original. Si el proceso se cierra durante un lote, **Cola de trabajo → Retomar lote** recupera las entregas guardadas y ejecuta los encargos pendientes con los criterios que se aplicaban al empezar. Los encargos enviados cuyo resultado no se pudo confirmar se marcan como **Interrumpido**. Para una implementación, la copia aislada queda disponible en `.educame-agents/worktrees/`.

## Revisar y subir código

La copia aislada parte del `HEAD` confirmado en Git al iniciar el lote. Los cambios sin commit del escritorio quedan fuera. Revisión puede continuar desde el commit del agente que le precede. El panel marca **Completado** cuando la entrega tiene cambios permitidos, pasa las comprobaciones registradas y tiene un commit local. Si falta una comprobación o hay errores, la copia queda disponible para continuar el trabajo.

Después de revisar la vista local, aprueba la entrega y sube la rama desde **Entregas**. Si varios agentes implementaron cambios independientes, integra sus ramas mediante solicitudes de cambios en GitHub. Cuando la revisión esté en `main`, sincroniza GitHub en **Cambios** y genera el comando de Hostinger para esa revisión.

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

Cada lote real carga el bloque breve de la [guía de desarrollo](guia-desarrollo-educame.md) y la [ficha del proyecto](../scripts/educame-dashboard/project-context.mjs). En los lotes de consola puedes indicar `app` como en el ejemplo. El modelo también recibe el encargo, el contexto manual y hasta cinco criterios confirmados de la app y tres generales, priorizados por palabras del encargo. Los encargos de todo Educame reciben hasta ocho criterios generales. Revisión hereda la app del borrador. El contexto que recibió cada encargo se puede consultar en su entrega. Usa ejemplos ficticios o material que puedas compartir con la API. Las respuestas y los criterios quedan en `.educame-agents/`. Cada lote admite hasta seis encargos, con un máximo de 2.000 tokens de salida por llamada de OpenAI API.

Repetir un lote con los mismos identificadores, criterios y configuración reutiliza los resultados guardados. Usa un identificador nuevo para volver a encargar un trabajo con una guía distinta. Si un encargo falla, las tareas independientes continúan y su revisor espera. Para volver a intentarlo, comprueba primero el estado de la llamada y usa un identificador nuevo. Si la ejecución se interrumpe y queda un directorio `.lock`, confirma que el proceso terminó y comprueba si OpenAI recibió el encargo antes de retirar ese bloqueo.

La [propuesta de evolución](plan-centro-de-mando.md) recoge ideas para los siguientes bloques.
