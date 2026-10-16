# Historial y protección del escritorio de Profesor Particular

## Qué queda protegido

Las fichas y notas, calendario, tareas, biblioteca, temas personales y demás datos
del escritorio se guardan al momento con un número de revisión. La protección
contra sobrescrituras entre pestañas sigue actuando en cada guardado. El historial
de recuperación conserva copias diarias, no una copia completa por cada edición.

Se conservan como máximo cinco copias por usuario, comprimidas en
`profesor_state_snapshots`. La revisión actual se guarda en
`client_states.profesor_revision`. Las otras aplicaciones conservan su estado.
El historial se elimina al borrar la cuenta.

La tarea `teacher-daily-backups` del worker programa una copia cada día a las
00:00 en `Europe/Madrid`, con sus cambios de horario de verano e invierno. No depende
de que el profesor tenga la aplicación abierta. Su marcador de ejecución está en
`app_settings.profesor_history_last_daily_backup`. Cada cuenta se procesa en una
transacción corta con bloqueo del escritorio y unicidad por cuenta/fecha. Si se
interrumpe una tanda, al volver el servicio se completan las cuentas pendientes sin
duplicar las ya copiadas. Los días pasados sin servicio no se rellenan con copias
ficticias. La fecha mostrada es la de captura real, no una medianoche inventada.

El límite total de cinco incluye las copias excepcionales de protección antes de
recuperar, vaciar expresamente el escritorio o cambiar administrativamente el acceso.
Cuando no hay cambios también puede haber una copia por día: su revisión coincide,
pero las fechas de copia son distintas. La migración 0021 conserva solo las cinco
copias existentes más recientes y programa la siguiente ejecución para medianoche.

## Recuperación por el profesor

Menú del perfil → **Historial y recuperación** → elegir **Recuperar** y confirmar.
La lista muestra fecha y número de alumnos, clases, tareas y materiales.
La recuperación crea una revisión nueva: la versión sustituida también sigue en
el historial, dentro del límite de cinco. El tipo de cuenta vigente lo decide
la licencia; recuperar una versión no concede Premium ni elimina Premium.

El historial contiene los datos y referencias a adjuntos del escritorio. No es
una segunda copia física de los archivos, ni una copia de toda la base de datos.
Las sesiones temporales de juego conservan su funcionamiento y caducidad propios.

## Conflictos, conexiones fallidas y escritorios vacíos

`GET /api/state?app=profesor_particular` devuelve un `ETag`. El cliente envía ese
valor en `If-Match` al guardar; la respuesta actualiza el valor para el siguiente
guardado de la cola. El servidor bloquea la fila y aplica además una actualización
condicionada a la revisión esperada. Una pestaña obsoleta recibe 409 y un cliente
antiguo sin versión recibe 428 si la cuenta ya contiene datos. Solo se admite un
primer guardado sin cabecera en una cuenta realmente vacía con revisión cero.

No se reintenta automáticamente un conflicto contra la nueva revisión, porque
eso sobrescribiría el trabajo de la otra pestaña. **Revisar guardado** permite
descargar el trabajo pendiente en JSON y cargar después la versión guardada.
No hay una mezcla automática de versiones. El archivo descargado contiene datos
privados y debe conservarse de forma privada si hace falta asistencia.

Los fallos de conexión mantienen el aviso de cambios pendientes y permiten
reintentar. Si el servidor alcanzó a guardar pero se perdió la respuesta, el
reintento no puede pisar una revisión posterior: será necesario revisar el guardado.

Los datos con colecciones inválidas o ausentes respecto al contenido existente
se rechazan. Si el guardado vaciaría todo el escritorio, se requiere confirmar
expresamente desde **Revisar guardado**; también se conserva la versión anterior.

## Cambios administrativos y despliegue

Cambiar plan o acceso conserva el usuario y su estado, y asegura una versión de
su contenido antes del cambio. Cambiar nombre, correo o contraseña conserva su
identificador. Trasladar a otra organización una cuenta con datos se bloquea:
requiere un traslado controlado de datos y documentos, no solo cambiar una casilla.

La migración 0020 añade revisión e historial y crea la versión inicial de las
cuentas existentes sin modificar su JSON. La migración 0019 pendiente ya no borra
fichas ni planificación; solo retira las antiguas credenciales de alumnos. Esto
no reconstruye los datos eliminados por versiones de esa migración ya ejecutadas.

`infra/deploy-hostinger.sh` mantiene la copia local verificada anterior a las
migraciones y compara las huellas de cada escritorio antes y después de migrar.
Si un escritorio existente cambia o desaparece, detiene la actualización antes
de sustituir los servicios. El control detecta la alteración; no revierte por sí
solo una migración ni restaura una copia sobre trabajo más reciente.

Un guardado del usuario durante el despliegue se acepta si una cadena continua de
justificantes acredita sus revisiones y las huellas del contenido anterior y nuevo.
Se conservan hasta 50 justificantes ligeros por escritorio: solo números y hashes,
sin contenido privado recuperable. El control también admite las antiguas copias
completas durante el despliegue de transición. Un hueco en la cadena o una alteración
sin un guardado legítimo detiene la actualización. En la
primera actualización, si el backend anterior aún no utiliza revisiones, una
edición simultánea también puede detener la comprobación. Reintentar fuera del
horario de uso; no forzar el paso ni restaurar una copia global por ese motivo.

Los endpoints de historial requieren sesión y licencia de Profesor Particular.
Nunca se devuelve el historial de otra cuenta ni se expone al participante que
entra mediante código. Los registros de recuperación guardan identificadores y
revisiones, sin nombres, notas ni respuestas.

## Límite de esta protección

Todo el historial reside en la misma base de datos del VPS. Protege frente a
errores de edición, guardado y cambios de cuenta. No protege frente a pérdida del
VPS, corrupción completa de la base de datos o eliminación de sus volúmenes.
Para ese caso hace falta una copia externa, que este cambio no configura.

No restaurar una copia global sobre usuarios que ya han vuelto a introducir
información. Recuperar únicamente la versión o los registros necesarios y
conservar siempre el contenido actual antes de hacerlo.
