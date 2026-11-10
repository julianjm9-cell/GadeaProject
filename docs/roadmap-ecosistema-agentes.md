# Educame · Hoja de ruta de seis meses

**Resultado esperado.** Profesor Particular, ESO Adultos e Inglés se revisan con regularidad, reciben juegos nuevos y generan material de promoción. Una cuarta línea prepara prototipos de otras apps reutilizando la base educativa. Cada ejecución deja un resultado que se puede abrir, comprobar y retirar si hace falta.

Los meses se cuentan desde el arranque. Cada fase tiene una prueba de salida para decidir si avanzamos o dedicamos otro ciclo a corregir lo aprendido.

## 1. La base que ya tienes

- **Servicios comunes.** FastAPI, PostgreSQL, cuentas, licencias, estado por usuario, consumo de IA y dashboard. Esta base permite añadir productos sin empezar por el login o la facturación.
- **Pruebas y entrega.** GitHub Actions ejecuta pruebas de backend y navegador, incluidas Chromium y WebKit. El despliegue de Hostinger crea una copia y verifica la conservación de datos durante la migración. [Pruebas actuales](../.github/workflows/quality.yml) · [Despliegue actual](../infra/deploy-hostinger.sh)
- **Un ejemplo real de reutilización.** Operación Faro comparte el mismo juego entre Profesor Particular y ESO Adultos. Es una referencia para separar el motor de las reglas y contenidos de cada variante. Los demás juegos tienen integraciones distintas según la app. [Motor de Faro](../backend/app/static/assets/lighthouse/game.js) · [Pruebas en las dos apps](../tests/lighthouse-browser.test.cjs)
- **Material de partida.** Catálogos, ilustraciones, landings, demos y piezas para redes que pueden alimentar el generador y el trabajo de marketing.

## 2. Quién hace qué

| Rol | Entrada | Entrega y límite |
| --- | --- | --- |
| **Coordinador** | Prioridades, calendario, presupuesto y trabajo pendiente | Asigna una tarea, guarda su estado y decide si reintentar, esperar o escalar. Puede empezar como código con reglas. |
| **Mantenimiento** | Fallo reproducible, alerta o tarea autorizada | PR acotado con una prueba de regresión. Trabaja en una rama aislada y con datos ficticios. |
| **Creador de juegos** | Objetivo didáctico, nivel, tema y formato | Actividad versionada, soluciones, explicación, miniatura y partida de prueba. |
| **Marketing** | Juego o función disponibles en la versión publicada | Demo grabada, guion, reel o Short, texto y enlace etiquetado. Deja la pieza en la bandeja editorial. |
| **Creador y adaptador de apps** | Público, problema, temario y configuración de producto | Demo privada, catálogo inicial y resultado de las pruebas del núcleo compartido. |
| **Revisor** | Tarea original, resultado y evidencias | Dictamen independiente con fallos reproducibles y casos que siguen pendientes. |

**Codex y Claude.** Codex admite subagentes incorporados y agentes propios definidos en `.codex/agents/`. Claude Code admite agentes de proyecto en `.claude/agents/`. Arrancaría con un ejecutor y un revisor. Usa otro proveedor si aporta una segunda perspectiva en tareas difíciles o si el primero está indisponible y la tarea admite reserva. Las pruebas de código y las soluciones verificadas tienen prioridad sobre el veredicto de cualquier modelo. [Subagentes de Codex](https://developers.openai.com/codex/subagents) · [Subagentes de Claude Code](https://code.claude.com/docs/en/sub-agents)

**Skills que sí merece la pena escribir.** `revisar-partida`, `crear-juego-verificable`, `producir-demo`, `adaptar-app` y `revisar-datos`. Cada una define cuándo se usa, qué herramientas toca, qué evidencia entrega y cuándo debe detenerse. Mantén el procedimiento común en Git y conecta la configuración de cada ejecutor con ese mismo procedimiento. [Skills de Codex](https://developers.openai.com/codex/skills) · [Skills de Claude Code](https://code.claude.com/docs/en/skills)

## 3. Cómo trabaja el sistema con el chat cerrado

1. **Arranque.** GitHub Actions lanza revisiones programadas y acepta ejecuciones manuales. Un trabajo nocturno para fallos y un lote semanal de contenido son un punto de partida. El repositorio conserva las reglas de qué se puede tocar. [Programación en GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
2. **Estado.** Cada tarea tiene una clave única por tipo, app y objetivo. Registra `pendiente`, `en curso`, `en revisión`, `aprobada`, `publicada` o `fallida`. Una ejecución repetida retoma o actualiza el mismo trabajo. Evita que genere dos juegos, dos PR o dos publicaciones para la misma tarea.
3. **Coste y reserva.** Registra modelo, duración, coste y motivo del fallo. Pon un tope por ejecución y por mes. Define cuándo reintentar con espera, cuándo usar un proveedor de reserva y cuándo parar. Mide el coste de agentes por separado del consumo de IA de tus usuarios.
4. **Evidencia.** Cada trabajo deja un enlace a la demo, PR o pieza, el resultado de las pruebas y un motivo si queda bloqueado. Empieza con un solo trabajo concurrente por tipo y amplía cuando el retraso lo justifique.
5. **Publicación.** El código llega a producción tras aprobación y pruebas. Los juegos pueden pasar a publicación automática por formato cuando la revisión del piloto sea consistente y se puedan retirar individualmente. Marketing programa piezas aprobadas con las credenciales de cada canal. Las apps nuevas se presentan primero como demos privadas.
6. **Feedback.** Un resumen semanal recoge fallos repetidos, partidas iniciadas y terminadas, piezas publicadas y altas atribuibles. Sirve para decidir qué genera la siguiente tanda. Usa métricas agregadas y cuentas de ensayo para las demos.

En el piloto basta un registro de ejecuciones y una agenda. Una cola persistente pasa a ser prioritaria cuando haya varios trabajos simultáneos, aprobaciones que sobreviven a una ejecución o reintentos que deban continuar otro día.

### Cuándo subir el nivel de autonomía

- **Código.** Exige un fallo reproducible, una prueba que cubra el cambio y una revisión antes de integrar. Prueba en preproducción los cambios que afecten cuentas, licencias o progreso. El sistema agrupa fallos repetidos en una misma tarea.
- **Juegos.** Mide coste por juego aceptado, proporción rechazada y errores encontrados después de la publicación. Habilita la publicación automática por tipo de juego cuando los lotes de prueba tengan soluciones verificadas y se haya ensayado la retirada.
- **Marketing.** Mide tiempo desde demo hasta pieza aprobada, visitas etiquetadas y altas por campaña. Amplía frecuencia según resultado y capacidad de revisión. Confirma en la versión pública cada afirmación de la pieza antes de programarla.
- **Apps nuevas.** Mide tiempo de ficha a demo, código específico necesario y errores introducidos en apps existentes. Decide con esos datos si merece una beta o basta una adaptación dentro de un producto actual.

## 4. La línea nueva · crear y adaptar apps

### Núcleo y variantes

| Capa | Qué contiene |
| --- | --- |
| **Plataforma** | Autenticación, permisos, progreso, licencias, avisos, métricas y despliegue. La identidad de producto delimita el acceso y el estado. |
| **Motor educativo** | Renderizado, reglas, corrección, accesibilidad, guardado y final de partida. Contratos versionados para que los juegos antiguos sigan siendo jugables. |
| **Paquetes de contenido** | Temas, actividades, soluciones, explicaciones, recursos y pruebas. Cada actividad tiene identificador estable, nivel, idioma y versión. |
| **Configuración de cada app** | Público, propuesta de valor, marca, temario, rutas, juegos activos, política de acceso y landing. |

### Cómo trabaja el adaptador

1. Recibe una ficha de oportunidad con público, problema, competencia que se practica y señal de demanda. Decide si se resuelve con un paquete en una app existente, una landing propia o una app diferenciada.
2. Produce una configuración de producto y un paquete inicial. El contenido generado es declarativo y el motor existente decide cómo interpretarlo.
3. Crea una vista previa con marca y navegación adaptadas. Reutiliza los servicios comunes con un identificador de producto separado.
4. Prueba alta o entrada, una partida completa, recarga y separación del progreso entre productos. Ejecuta además el juego compartido en las apps que ya lo usan para detectar regresiones.
5. Presenta un informe de qué reutilizó, qué código nuevo requirió y qué mantenimiento añade. Tú decides si la demo pasa a beta.

**Primer experimento sugerido.** Una demo de «Inglés para hostelería» con un recorrido corto de situaciones reales. Usa el motor de una misión existente y cambia contenidos, ambientación y propuesta de valor. Comprueba primero si la misma variante funciona como itinerario dentro de Inglés. Si la audiencia necesita una entrada, navegación o propuesta claramente distinta, esa evidencia justifica una app separada.

**Primer contrato compartido.** Toma Operación Faro como ejemplo de motor servido a dos apps y prueba una segunda variante de un formato sencillo. Documenta el contrato que de verdad comparten y conserva sus pruebas. Cada app puede integrar ese contrato a su ritmo.

## 5. Seis meses de trabajo y aprendizaje

| Mes | Entrega | Lo que practicas tú | Señal para pasar de fase |
| --- | --- | --- | --- |
| **1 · Base y piloto** | Agenda, registro de ejecuciones, entorno ficticio y dos roles. Un fallo real, un juego y una demo en Profesor Particular. | Git, lectura de diffs y diseño de pruebas. | Repetir la tarea conserva su identidad y deja una evidencia que puedes verificar. |
| **2 · Juegos fiables** | Lote semanal, cobertura del catálogo, validación de soluciones y pantalla de resultados de referencia. Comparación de modelos de texto e imagen sobre casos reales. | Calidad didáctica, métricas de IA y coste por juego aceptado. | Varios lotes revisados y una forma probada de retirar una actividad concreta. |
| **3 · Marketing y descubrimiento** | Plantillas de vídeo y texto desde demos, calendario, aprobación editorial y enlaces etiquetados. Revisión de indexación de ESO Adultos en Search Console. | SEO, grabación de producto y atribución de altas. | Una campaña completa tiene pieza, publicación y resultado consultables. |
| **4 · Núcleo reutilizable** | Contrato versionado de juegos, paquetes de contenido y pruebas comunes para dos apps. | Diseño modular, compatibilidad y separación del estado. | Una actividad se adapta por datos y los catálogos existentes siguen pasando sus pruebas. |
| **5 · Adaptador de apps** | Generación de una demo privada desde una ficha de producto, con una primera prueba con usuarios. | Validación de producto, personalización y coste de mantenimiento. | La demo completa su recorrido y hay evidencia para decidir entre itinerario, micrositio o app. |
| **6 · Escala controlada** | Extensión gradual a las tres apps, métricas semanales, control de cuotas y botón de pausa. Prueba de fallo de proveedor y de recuperación. | Observabilidad, priorización y operación de varias apps. | Puedes saber qué está corriendo, cuánto cuesta y cómo detener o revertir cada salida. |

**Después de la base.** Los juegos 1 contra 1 son un proyecto de tiempo real con su propio piloto de reconexión y puntuación en servidor. Los avisos por Gmail o WhatsApp y las exportaciones de libros didácticos pueden consumir tareas ya verificadas. Cada canal añade sus propios permisos, revisión y métricas. La revisión de Google Meet y sus permisos queda como tarea de integración separada de la indexación en Search Console.

## 6. Cómo quedaría en Notion

**Página principal «Centro de mando de Educame».** Arriba, una vista del mes con el objetivo y el trabajo en revisión. Debajo, enlaces a las tres apps, a sus demos y a los últimos resultados de cada agente.

| Base | Campos útiles | Vista inicial |
| --- | --- | --- |
| **Roadmap** | App, mes, responsable, estado, resultado esperado y prueba de salida | Ahora, después y aparcado |
| **Bandeja de revisión** | Tipo, app, resultado, evidencia, coste, estado y decisión | Revisiones pendientes y últimas publicaciones |
| **Ideas de apps** | Público, problema, núcleo reutilizado, diferencia, demo y evidencia | Ideas, piloto y decisión |
| **Aprendizajes** | Concepto, ejercicio, qué comprobaste y enlace al resultado | Una práctica por ciclo |

**Reparto de fuentes.** GitHub conserva el código, las pruebas y las decisiones de cada PR. Notion recoge prioridades, revisión editorial y aprendizaje. Cuando conectes Notion, empezaría por una página dedicada y enlazaría los resultados en vez de copiar el registro completo de ejecuciones. Para una sincronización posterior desde GitHub Actions, usa una integración de servicio con acceso acotado y actualiza cada ficha por el identificador de su tarea.

## Primer ciclo recomendado

**Profesor Particular · un juego, una corrección y una demo.** Elige un juego existente como referencia. El creador prepara una actividad distinta con el mismo motor. El mantenedor corrige un fallo reproducible en su recorrido. Marketing graba la versión que pasó la revisión. Tu práctica consiste en verificar una solución, leer el cambio y decidir qué dato usarías para saber si la demo interesa. Ese ciclo deja tres entregables concretos y una base para construir el adaptador de apps.

1. **Primera semana.** Identifica el juego y el fallo. Escribe los criterios de aceptación, corre las pruebas existentes y guarda una captura del problema. Configura la ejecución manual para ensayar el proceso completo.
2. **Segunda semana.** Activa la ejecución programada en el entorno de pruebas y repite la misma entrada. Comprueba que obtienes un único resultado por tarea. Revisa el juego, el PR y la pieza antes de elegir la siguiente tanda.
