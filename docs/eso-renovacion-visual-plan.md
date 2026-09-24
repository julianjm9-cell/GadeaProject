# ESO Adultos — Renovación visual y escritorio virtual

Fecha: 24/09/2026. Estado: propuesta de trabajo, sin implementación.

## Alcance y fuentes

Plan basado en las seis láminas aportadas, el documento de progresión adjunto y la inspección del código actual. La petición vigente es analizar y planificar; la instrucción del documento de empezar a implementar se considera parte de la propuesta adjunta, no una autorización para ejecutar ahora sus 40 apartados.

Las imágenes definen una dirección visual, no especificaciones cerradas. Sus cifras, asignaturas, bloqueos y ejemplos deben adaptarse a la app real. Esta revisión es estática: no se ha validado visualmente la aplicación en ejecución ni se han ejecutado pruebas nuevas.

## Base existente y hallazgos

- `apps/e25/index.html` concentra aproximadamente 497 KB de HTML, CSS, contenido y JavaScript sin framework. Usa un objeto `state`, funciones de renderizado y navegación mediante vistas.
- Backend compartido FastAPI, SQLAlchemy, PostgreSQL y migraciones Alembic. `/api/state` guarda estado por usuario, organización y aplicación. No partir de almacenamiento local como fuente principal.
- Navegación actual: Inicio, Biblioteca, Exámenes y Progreso; Perfil se abre aparte. La navegación de las láminas es un cambio, no una copia de la actual.
- Se pueden reutilizar catálogo de materias y ámbitos, lecciones, evidencias, apuntes, tests con explicaciones, errores, sesión de 15/30/45 minutos, profesor IA, simulacros, recursos, historial y perfil.
- El cierre de contenidos del 23/09 documenta 65 temas, 260 lecciones y 520 preguntas por tema en conjunto. No confundir la auditoría anterior del 20/09 con el estado posterior del proyecto.
- `progressPct()` calcula acciones mensuales respecto a 30 acciones; no mide porcentaje curricular. `progressLevels()` define cinco hitos mensuales. No convertir esos números directamente en XP o porcentaje académico.
- `activityDates` conserva hasta 90 fechas; el panel cuenta días activos como sesiones. Días, sesiones y minutos requieren métricas diferentes.
- `completeLesson()` ya evita repetir el registro por una lección terminada; esa protección local no equivale a un registro persistente de recompensas únicas.
- `saveState()` silencia errores, y `/api/state` acepta un estado completo. Para compras y recompensas hacen falta operaciones atómicas y control de concurrencia; dos pestañas no deben sobrescribir saldos o duplicar premios.
- Hay pruebas existentes con Node/Playwright y backend con pytest que conviene extender, adaptando selectores cuando cambie la interfaz.

## Decisiones propuestas

1. Identidad azul y blanca, tipografía legible, superficies claras, madera y plantas en el escritorio. Dorado reservado para recompensas. Espaciado y jerarquía antes que decoraciones.
2. Inicio responde a «¿qué puedo hacer con el tiempo que tengo?»: continuar y duración visibles sin que una imagen grande obligue a buscarlos. Escritorio con presencia, pero subordinado a estudiar.
3. Navegación propuesta: Inicio, Asignaturas, Progreso y Perfil. Recursos dentro de Asignaturas; simulacros con acceso explícito desde esa sección y la sesión. No ocultar funciones existentes durante el cambio.
4. Separar avance del temario, resultados de evaluación y nivel del escritorio. Etiquetar el porcentaje como «Temario completado»; completar la app no acredita por sí mismo el título oficial.
5. Ocho niveles de escritorio, sin llamar «Graduado ESO» al nivel 8. Propuesta: «Mi espacio completo». Hito académico separado «Recorrido completado» al terminar el contenido exigido.
6. «Tu ritmo»: últimos siete días, con fechas y días correctos. Recompensa semanal, si se conserva, una vez por semana de calendario y con zona horaria definida. No confundir ambas ventanas. Sin pérdida de bienes ni XP por ausencias.
7. Monedas virtuales independientes de XP y de los créditos de IA existentes en la suite. Nombres y saldos visualmente inequívocos; sin pagos.
8. Definir recompensas por eventos reales: abrir una lección no es completarla; abrir una sesión no es terminarla. Fijar límites de repetición por tipo de actividad, umbral del test y acumulación entre lección, tema, asignatura y logro.
9. Preservar IDs y datos actuales. Inicializar escritorio básico para usuarios existentes y marcar lo ya completado para evitar premios repetidos. No inventar fechas, minutos ni recompensas históricas; cualquier reconocimiento retroactivo será único y explícito.
10. Composición de escritorio por capas con perspectiva, anclajes, tamaños relativos, orden y miniaturas coherentes. Las láminas completas no sirven directamente como objetos intercambiables.

## Paquete 1 — Dirección visual, navegación y reglas cerradas

Estado: completado como prototipo y especificación el 24/09/2026. Ver `docs/prototypes/eso-adultos-ux-v1.html` y `docs/eso-paquete-01-diseno-y-reglas.md`.

Objetivo: disponer de un diseño implementable y de un contrato de progreso sin ambigüedades.

- Inventario definitivo de pantallas, datos, estilos y dependencias compartidas.
- Sistema visual: colores, tipografía, espaciado, tarjetas, botones, iconos, formularios y estados de foco/error/carga.
- Diseño de Inicio, lección y Progreso en móvil y escritorio; definir adaptación a tablet.
- Mapa de navegación y localización de todas las funciones actuales.
- Definir denominador curricular, criterios de finalización, niveles, XP, monedas, recompensas repetibles, ritmo y migración.
- Contrato de assets y una escena de referencia para comprobar composición.

Entrega: diseño de las tres pantallas clave, reglas centralizadas propuestas y mapa de migración. Cierre: se entiende cómo empezar, continuar y distinguir aprendizaje de recompensas; ningún acceso actual queda sin destino.

## Paquete 2 — Motor de progreso y persistencia fiable

Estado: implementado en código el 24/09/2026; la migración debe aplicarse al desplegar. Ver `docs/eso-paquete-02-motor-progreso.md`.

Objetivo: completar una actividad y registrar correctamente sus consecuencias.

- Servicio central de recompensas, configuración versionada y cálculo de niveles.
- Registro de eventos únicos, saldo, inventario, selección equipada y logros por usuario/app.
- Endpoints de recompensa, compra y equipamiento con validaciones y transacciones; impedir que un guardado genérico sobrescriba datos económicos.
- Integrar lecciones, tests, temas, asignaturas, simulacros y sesiones donde existan eventos verificables; instrumentar los que falten.
- Registro de sesión identificable y finalización comprobable. Los minutos elegidos son estimados, no tiempo realmente estudiado.
- Migración compatible, guardado con error visible y reintentos seguros. Separar progreso acumulado de actividad mensual.
- Pruebas de duplicados, límites de nivel, concurrencia, aislamiento de usuarios/apps y conservación de datos antiguos.

Entrega: una actividad real actualiza XP, monedas y nivel y los conserva tras reconectar; repetir la petición no vuelve a premiarla. Catálogo mínimo técnico, sin esperar imágenes finales.

## Paquete 3 — Inicio y escritorio: flujo completo utilizable

Estado: implementado en modo de integración el 24/09/2026. Ver `docs/eso-paquete-03-escritorio-tienda.md`.

Objetivo: primera versión funcional de estudiar → ganar → comprar → equipar → volver.

- Inicio nuevo con continuar, duración, avance del temario, escritorio y ritmo.
- Progreso con Mi escritorio, Logros y Estadísticas básicas sustentadas por datos.
- Tienda, inventario y personalizador con vista previa y aplicación explícita.
- Diferenciar bloqueado, disponible, adquirido y equipado; explicar requisito o saldo insuficiente.
- Catálogo de 10–15 objetos; empezar con pocas categorías visuales y mantener las demás extensibles.
- Assets provisionales coherentes, notificaciones discretas y accesos del escritorio duplicados en controles accesibles.
- Estados de usuario nuevo, usuario existente, carga, catálogo vacío y fallo de red.

Entrega: recorrido completo real desde actividad hasta objeto visible en Inicio, conservado después de recargar y cerrar sesión. Las compras repetidas no descuentan dos veces; equipar exige propiedad.

## Paquete 4 — Renovación del estudio y pantallas complementarias

Estado: implementado en modo de integración el 24/09/2026. Ver `docs/eso-paquete-04-experiencia-estudio.md`.

Objetivo: extender la nueva identidad a toda la experiencia sin perder contenido ni herramientas.

- Asignaturas y ficha de materia: siguiente lección clara, temas, recursos y progreso coherente.
- Lección: lectura cómoda, ejemplos, práctica, evidencias, apuntes y profesor IA contextual.
- Ejercicios y tests: respuesta, explicación y siguiente paso; simulacros e historial con el mismo sistema visual.
- Sesión diaria: pasos concretos, pausa/reanudación y finalización medible, aprovechando duraciones actuales.
- Perfil, ajustes y ayuda coherentes con funcionalidades disponibles.
- Calendario, objetivos semanales y notificaciones de las láminas se tratan como ampliaciones funcionales: especificar datos y comportamiento antes de construir. Para una primera renovación, priorizar un plan semanal sencillo y preferencias reales; calendario completo y avisos programados quedan para ampliación posterior.

Entrega: recorrido completo con identidad consistente y acceso a todos los contenidos actuales. No mostrar botones sin función, vídeos inexistentes, estadísticas inventadas o controles de preferencias que no se apliquen.

## Paquete 5 — Assets finales, validación y entrega

Estado: implementado y configurado como interfaz predeterminada el 24/09/2026. La interfaz anterior queda disponible temporalmente con `?ui=classic`. Ver `docs/eso-paquete-05-validacion-y-entrega.md`.

Objetivo: llevar la versión funcional a un acabado visual coherente y verificable.

- Sustituir placeholders por assets con perspectiva, iluminación y escala comunes. Revisar escena inicial, intermedia y avanzada.
- Optimizar imágenes, carga y movimiento; compatibilidad con reducción de animaciones.
- Revisar móvil, tablet y escritorio, lectura, contraste, teclado y controles táctiles.
- Ejecutar regresión de estudio, IA, apuntes, recursos, perfil, simulacros y persistencia; probar flujo de recompensas y compras ante recarga, dos pestañas y fallo de red.
- Validar con tareas de usuarios adultos: retomar estudio, terminar una actividad y entender qué significa cada progreso.
- Documentar cómo añadir objetos, cambiar imágenes, precios y umbrales; migración y procedimiento de reversión del despliegue.

Entrega: versión lista para revisión y despliegue, con pruebas registradas y limitaciones explícitas. Desplegar no forma parte de esta petición de planificación.

## Orden y puntos de entrega

Orden principal: 1 → 2 → 3 → 4 → 5. Los assets finales pueden prepararse tras fijar el contrato en el paquete 1, sin bloquear el motor ni el flujo.

La primera entrega funcional se cierra al finalizar el paquete 3. La renovación global se cierra al finalizar el 5. Así el escritorio se prueba dentro de la app antes de invertir en todos los detalles y pantallas accesorias.

## Impacto técnico previsto

- Principal integración: `apps/e25/index.html`; extraer solo los módulos y estilos necesarios para el nuevo sistema, sin migración general de framework.
- Nuevos módulos frontend propuestos: configuración/presentación de progreso, escena, tienda y personalizador; carpeta `apps/e25/assets/desk/`.
- Backend: rutas específicas de gamificación, servicio de recompensas, modelos y migración Alembic; integrar autenticación y aislamiento ya existentes.
- Entidades conceptuales: configuración de niveles/recompensas, evento premiado, perfil del escritorio, catálogo, propiedad, equipamiento y logro obtenido. Evitar duplicar valores derivados como objetos disponibles por nivel.
- Registro único por evento y usuario/app; compra atómica y propiedad única; una selección equipada por categoría admitida. Precios y requisitos verificados en servidor.
- Extender pruebas existentes y añadir pruebas de dominio; no basar la aceptación solo en capturas.
- Mantener los cambios acotados a ESO Adultos; cualquier cambio del backend compartido requiere comprobar que las otras apps siguen funcionando.

## Fuera de la primera entrega

Pagos, rankings, competición, rachas punitivas, redes sociales, catálogo masivo, escenas 3D y generación de todo el contenido de nuevo. Tampoco se incorporan como obligación las cifras, las asignaturas adicionales ni los ejemplos inconsistentes de las láminas.
