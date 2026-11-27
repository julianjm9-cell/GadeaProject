# Trabajar con Codex y Claude en Educame

## Primera sesión

En Windows abre **LA TERRAZA → Conexiones → Agentes e IA → Abrir Claude Code**. Se abre el programa oficial en una terminal con su propia copia de trabajo Git. Inicia sesión en esa ventana con la cuenta a la que pertenece tu plan. Comprueba en `/status` qué cuenta y modalidad estás usando. Si trabajas directamente desde una terminal nueva, abre la raíz del repositorio y ejecuta `claude --worktree`. El primer acceso puede pedirte que confirmes que conoces el proyecto.

Puedes empezar con este encargo de lectura:

> Lee AGENTS.md y la auditoría. Localiza la implementación del guardado de Inglés. Indícame qué ocurre al recargar después de una respuesta correcta, qué prueba lo demuestra y en qué archivo harías el siguiente cambio.

| Qué quieres hacer | Dónde | Cómo llega el cambio a GitHub |
| --- | --- | --- |
| Usar tu suscripción y trabajar con Claude directamente mientras Codex hace otro encargo | Claude Code, abierto desde Conexiones | La sesión tiene su rama. Cuando quieras integrarla, pide que pruebe el cambio, suba esa rama y prepare una solicitud de cambios con destino a `main`. |
| Encargar un trabajo automático a Claude, con revisión, recuperación y subida de LA TERRAZA | Conexiones → Claude API. Guarda una clave de Claude Console vinculada a un espacio de trabajo. En Encargos → Motor y modelo elige Claude API. | La cola conserva encargo, modelo y recibos. La publicación automática confirma el commit en el remoto. |
| Mantener tu flujo actual con Codex | Encargos → Codex local | La misma cola gestiona pruebas, publicación y última subida reversible. |

La suscripción da acceso a Claude Code según el plan. El consumo de la API se gestiona en Claude Console. Algunos planes también ofrecen créditos API con condiciones propias. Comprueba los créditos de tu cuenta antes de activar la automatización. Puedes empezar con la primera opción sin configurar una clave en LA TERRAZA. [Uso de Claude Code con un plan](https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan) · [Créditos API por plan](https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-ultra-and-team-plans)

## Qué comparten

1. **Reglas del propietario.** Claude Code carga `CLAUDE.md`, que importa `AGENTS.md`. Codex parte de ese mismo `AGENTS.md`. Ambos consultan la [guía de desarrollo](guia-desarrollo-educame.md), las [fichas de producto](../scripts/educame-dashboard/project-context.mjs) y la [auditoría](auditoria-ecosistema.md).
2. **Versión del código.** Antes de editar, comprueba `git status -sb`, `git rev-parse HEAD` y los archivos que vas a tocar. Al abrir una copia aislada, solo están disponibles los cambios ya versionados. Una edición que sigue abierta en la otra sesión aún no forma parte de esa base.
3. **Criterios locales recientes.** La cola congela la memoria del encargo al empezar. En una sesión nativa, abre **Memoria**, elige la app y exporta su Markdown. También puedes pedir que lea la exportación local de esa app mientras LA TERRAZA está abierta. Por ejemplo, en PowerShell:

   ```powershell
   (Invoke-RestMethod 'http://127.0.0.1:4317/api/memoria/exportar?format=md&app=ingles').text
   ```

   Usa el identificador de la ficha, como `profesor`, `eso`, `ingles`, `control` o `gadeos`. Esta es la interfaz de exportación prevista para los agentes. Las bases de datos privadas, conversaciones y credenciales se quedan fuera del informe. En la nube, proporciona únicamente la ficha que quieras compartir.
4. **Conclusiones reutilizables.** Una nueva preferencia se propone con un ejemplo verificable. El propietario la confirma en Memoria o en la guía. Un fallo puntual se documenta en el encargo o en una prueba de regresión.

## Cómo repartir dos cambios hoy

| Codex | Claude | Coordinación |
| --- | --- | --- |
| Mejorar la claridad del resultado de un juego de Profesor Particular | Hacer más fácil retomar una misión de Inglés | A la vez si cada uno modifica su app y sus pruebas propias. |
| Cambiar un contrato de guardado en FastAPI | Adaptar la pantalla que usa ese contrato | Acordar antes entrada, respuesta y tratamiento de datos antiguos. Integrar el contrato compatible y actualizar la rama de la pantalla antes de su revisión final. |
| Modificar una sección del HTML principal de ESO | Investigar el progreso guardado en esa misma pantalla | Claude puede investigar desde ya. Un solo agente edita ese archivo a la vez. |
| Trabajar en un encargo cualquiera de LA TERRAZA | Crear una mejora en la copia nativa de Claude | La cola puede seguir activa. Una sesión del programa oficial tiene su propia conversación e historial Git. |

**Un encargo bien repartido** contiene producto, resultado observable, archivos o sección que toca cada persona, dependencias y evidencia de aceptación. Por ejemplo: «Claude, en Inglés, permite volver a la misión actual desde Juegos tras una recarga. Codex trabaja en Profesor Particular. Conserva los identificadores de progreso. Comprueba con una cuenta ficticia una respuesta correcta, un error y la recarga».

El ejecutor local admite dos tareas independientes del mismo lote en paralelo y un motor por lote. Los lotes administrados se procesan por orden. La combinación simultánea con una sola suscripción es **sesión nativa de Claude + encargo de Codex**. Si un trabajo depende del otro, anota el commit que necesita antes de empezar a implementarlo.

## Integrar y retomar

| Paso | Qué comprueba el segundo agente |
| --- | --- |
| Recibir | Producto, base Git, alcance, resultado esperado y trabajo paralelo anunciado. |
| Entregar | Rama y SHA, archivos modificados, efecto visible, pruebas ejecutadas y datos utilizados. Indicar los servicios reales que aún requieren autorización. |
| Integrar una rama nativa | Mantener la rama al cerrar Claude. Revisar la diferencia frente al último `origin/main`, resolver solapamientos en la rama y ejecutar las pruebas del resultado combinado. Abrir una PR en GitHub. Las PR ya abiertas se pueden consultar en Operación si el panel tiene conectada la API de GitHub. |
| Retomar | En Claude, continuar en la copia conservada. En la cola, retomar el encargo con su identificador. Tras una respuesta incierta, consultar primero el recibo para evitar repetir trabajo o consumo. |
| Publicar | La cola publica sus propias entregas. Una PR externa conserva su historial Git. Si hay cambios online, **Operación → Hostinger** despliega el commit confirmado y consulta su recibo. El dashboard online sigue disponible como respaldo. |

El botón **Deshacer última subida** corresponde a entregas de la cola. Para una PR externa ya integrada, usa **Revertir** en GitHub y revisa el commit inverso. Una corrección administrativa de una cuenta se realiza en Gestión y se comprueba allí. [Procedimiento de despliegue](../infra/HOSTINGER_UPDATE.md) · [Gestión integrada](terraza-gestion.md)

## Si algo falla al empezar

| Síntoma | Acción |
| --- | --- |
| Se abre el inicio de sesión | Selecciona la cuenta personal que tiene el plan y completa el acceso dentro de Claude. |
| La tarjeta Claude API solicita una clave después de pagar | Para usar la suscripción abre la tarjeta **Claude Code**. Configura Claude API únicamente si quieres automatizar la cola con ese proveedor. |
| En otro PC falta el programa | En Windows instala el cliente oficial con `winget install --id Anthropic.ClaudeCode --exact`. Necesitas Git para crear la copia. [Instalación oficial](https://code.claude.com/docs/en/setup) |
| La sesión nativa necesita probar el proyecto | En la raíz de su copia ejecuta `npm.cmd ci`. Para probar la interfaz ejecuta `npx.cmd playwright install chromium webkit`. Para Python prepara un entorno separado con `backend/requirements.txt`. Usa la matriz de pruebas del informe. |
| Ha cambiado el mismo archivo en las dos ramas | Conserva ambas y reúne los cambios en una sola rama de integración. Verifica también la funcionalidad de la primera entrega antes de fusionar. |
