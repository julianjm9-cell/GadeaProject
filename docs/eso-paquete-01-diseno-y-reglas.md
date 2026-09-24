# ESO Adultos — Paquete 01: diseño y reglas

Fecha: 24/09/2026. Estado: preparado para validación visual.

## Resultado del paquete

Se define la dirección visual y funcional previa al motor de gamificación. El prototipo navegable está en `docs/prototypes/eso-adultos-ux-v1.html` y cubre Inicio, una lección, Progreso y la adaptación de la navegación a móvil.

No se ha sustituido todavía la interfaz productiva. Esta separación permite validar jerarquía, legibilidad y flujo antes de tocar una aplicación con contenidos, tests y datos activos.

## Prioridad de cada pantalla

### Inicio

Debe responder en pocos segundos:

1. Qué puedo estudiar ahora.
2. Cuánto tiempo me llevará.
3. Cómo va mi temario.
4. Cómo va mi escritorio y mi ritmo.

El botón principal es `Continuar [asignatura]`. El escritorio ocupa una parte importante de la pantalla, pero no desplaza la acción de estudiar. En móvil aparece después del resumen y antes de los detalles secundarios.

### Lección

El contenido es el protagonista. Se conserva la secuencia actual de cuatro lecciones por tema, el guardado de apuntes, las evidencias cuando procedan y el profesor IA contextual.

La pantalla debe mostrar siempre materia, tema, número de lección, duración estimada, objetivo y próximo paso. Completar solo se permite cuando se cumplen las reglas académicas existentes. Abrir una lección no cuenta como completarla.

### Progreso

Usa tres pestañas:

- `Mi escritorio`: nivel, XP, monedas, escena, inventario, tienda y personalización.
- `Logros`: hitos obtenidos y próximos hitos comprensibles.
- `Estadísticas`: únicamente datos almacenados o calculables.

El porcentaje académico permanece visible y se llama `Temario completado`. No se presenta como porcentaje de obtención del título.

## Navegación cerrada

Navegación global:

- Inicio.
- Asignaturas.
- Progreso.
- Perfil.

Ubicación de funciones existentes:

| Función actual | Nueva ubicación |
|---|---|
| Biblioteca de materias | Asignaturas |
| Recursos oficiales | Asignaturas > Recursos |
| Apuntes guardados | Asignaturas > Mis apuntes |
| Tests por tema | Tema y lección correspondiente |
| Simulacros | Asignaturas > Simulacros; acceso adicional desde sesión |
| Historial de simulacros | Simulacros > Historial |
| Profesor IA | Contextual dentro de lección o simulacro |
| Progreso mensual existente | Estadísticas > Actividad |
| Perfil | Navegación global |

En escritorio se usa barra lateral; en móvil, barra inferior fija. La URL o el estado de navegación deberá permitir volver a la vista correcta tras recargar, dentro de las posibilidades de la arquitectura actual.

## Sistema visual

| Papel | Valor inicial | Uso |
|---|---|---|
| Azul oscuro | `#12315F` | Títulos y texto de alta jerarquía |
| Azul principal | `#176ED8` | Acción principal, selección y progreso |
| Azul claro | `#EAF3FF` | Fondos seleccionados y ayudas |
| Fondo | `#F4F8FD` | Fondo general |
| Verde | `#23866B` | Completado y confirmación |
| Dorado | `#D99A20` | Monedas y recompensas |
| Tinta | `#16243A` | Texto principal |
| Texto secundario | `#5E6D81` | Ayudas y metadatos |

Tipografía objetivo: Inter si ya puede servirse localmente; `Segoe UI` como alternativa sin dependencia. Texto base de 16 px en escritorio y 15–16 px en móvil. Controles táctiles de al menos 44 px. Radio principal de 18 px y sombras discretas.

Los estados nunca dependen solo del color: incluyen texto, icono o ambos. Foco de teclado visible, estructura semántica, región de estado para confirmaciones y descripciones alternativas para la escena.

## Métricas separadas

### Avance académico

- `Temario completado`: temas completados / temas aplicables del catálogo vigente.
- `Progreso por asignatura`: temas completados de la asignatura / temas de esa asignatura.
- `Resultado`: notas de tests y simulacros, separado del avance.
- Completar contenido dentro de la app no certifica haber obtenido oficialmente la ESO.

El catálogo actual tiene 65 temas. El denominador debe obtenerse de los datos, no escribirse como 65 en componentes.

### Escritorio

- XP acumulada.
- Nivel derivado de XP.
- Monedas disponibles.
- Objetos propios y equipados.
- Logros obtenidos.

No se reduce XP, nivel, monedas ni inventario por inactividad.

### Tu ritmo

Ventana móvil de siete fechas consecutivas terminando hoy, usando la zona horaria efectiva de la aplicación. Un día cuenta una vez si hay al menos una actividad de estudio válida. La interfaz muestra fechas reales mediante nombre de día y estado accesible.

`Sesiones completadas` es una métrica diferente: exige un identificador de sesión y un evento de finalización. Seleccionar 15, 30 o 45 minutos es una estimación, no tiempo real estudiado.

## Reglas de recompensas para implementar en el paquete 02

Configuración inicial propuesta:

| Evento | XP | Monedas | Clave de unicidad |
|---|---:|---:|---|
| Lección completada | 30 | 5 | usuario + lección |
| Serie de ejercicios completada | 15 | 3 | usuario + serie + versión |
| Test aprobado | 25 | 5 | usuario + test; primera aprobación |
| Tema completado | 100 | 30 | usuario + tema |
| Asignatura completada | 500 | 100 | usuario + asignatura |
| Simulacro completado | 200 | 40 | usuario + intento válido |
| Sesión diaria completada | 50 | 10 | usuario + sesión |
| Ritmo semanal alcanzado | 100 | 20 | usuario + semana ISO |

El umbral inicial para `Test aprobado` será 70 %, configurable. Un intento posterior puede actualizar la mejor nota, pero no repetir la recompensa de primera aprobación. Un simulacro requiere envío final y respuestas mínimas válidas; crearlo o abrirlo no entrega premio.

Las recompensas son acumulables cuando representan hechos diferentes: la cuarta lección puede conceder recompensa de lección y provocar la recompensa única de tema. El resultado se procesa como una operación única para impedir estados intermedios incoherentes.

`Sesión diaria completada` necesita una definición nueva: completar todos los pasos del plan creado. No se concederá únicamente por registrar actividad durante ese día.

## Niveles propuestos

| Nivel | Nombre | XP mínima |
|---:|---|---:|
| 1 | Inicio | 0 |
| 2 | Primeros pasos | 200 |
| 3 | Cojo ritmo | 500 |
| 4 | Constancia | 900 |
| 5 | Avanzando | 1.400 |
| 6 | Mi espacio | 2.000 |
| 7 | Recta final | 2.800 |
| 8 | Mi espacio completo | 3.800 |

Los umbrales son configuración inicial y deben validarse con datos reales de frecuencia. `Graduado ESO` queda reservado para un hito académico explícito, no para el nivel de decoración.

## Contrato inicial de objetos y escena

Cada objeto debe declarar al menos:

- ID estable, nombre, categoría y descripción.
- Precio, nivel mínimo y condición opcional.
- Referencia a imagen de escena y miniatura.
- Ancla de escena, escala relativa, desplazamiento y orden de capa.
- Variante o estado visual opcional.
- Indicadores de objeto inicial o especial.

La escena define anclas como `wall`, `desk_surface`, `floor_left`, `floor_right`, `shelf` y `centerpiece`. El catálogo determina cómo se dibuja un objeto; tienda, inventario y personalizador consumen el mismo registro.

Formato recomendado de assets: WebP o PNG transparente para escena; WebP cuadrado para miniatura. Todas las piezas de una colección deben compartir perspectiva, punto de luz y escala. Un fallback CSS o una silueta neutra permite operar sin el asset final.

## Migración de usuarios actuales

- Conservar `done`, tests, intentos, actividad, apuntes, evidencias, chats y preferencias válidas.
- Inicializar nivel 1, saldo 0 e inventario básico seguro.
- Registrar una versión de esquema del estado de gamificación.
- Crear marcas de eventos históricos reconocidos antes de entregar cualquier recompensa retroactiva.
- Primera propuesta: no conceder monedas o XP históricos automáticamente. Evita saldos distintos según la calidad de datos antiguos y elimina dobles premios. Esta política debe explicarse al usuario si el sistema se publica sobre cuentas existentes.

## Criterios de aceptación del paquete

- Inicio, Lección y Progreso tienen diseño responsive comprobable.
- La acción de continuar es localizable sin desplazar la pantalla en móvil habitual.
- Progreso académico, resultado, XP, nivel, monedas y ritmo usan nombres distintos.
- Toda función actual tiene un destino en la navegación propuesta.
- Existen reglas de unicidad para cada recompensa inicial.
- El contrato de objetos permite cambiar assets sin cambiar la lógica.
- No se han modificado datos ni flujos productivos durante la validación del prototipo.

## Decisiones aplazadas con intención

Calendario completo, objetivos manuales, notificaciones programadas, vídeos de ayuda y modo oscuro requieren comportamiento y datos propios. No se muestran como controles activos hasta implementarlos. La primera versión puede añadir planificación semanal sencilla después del flujo principal de escritorio.
