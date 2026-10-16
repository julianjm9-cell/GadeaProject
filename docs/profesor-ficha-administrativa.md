# Ficha administrativa de Profesor Particular

Desde Usuarios → Profesor Particular, pulsar el nombre abre `profesor-user.html?user=<UUID>` en otra pestaña. La sesión administrativa se mantiene en el mismo origen; el enlace no incluye credenciales. La ficha se consulta en modo de solo lectura y no suplanta al profesor.

## Alcance

- Cuenta, alta, licencia, créditos e indicadores de conexión con Google, Drive y Meet. Nunca sus credenciales.
- Recuentos actuales de alumnos, planificación, tareas, materiales y temas. No son totales históricos de creación.
- Catálogo de metadatos de materiales con búsqueda, asignatura, formato y páginas de 25. No incluye cuerpo, preguntas, respuestas, IDs de alumnos ni contenido de archivos.
- Últimos 50 eventos de actividad, trabajos de generación, consumos y cambios disponibles; hasta cinco copias de recuperación. Los listados indican su alcance y ausencia de registros.
- Las versiones se consultan por columnas de metadatos: no se descomprimen ni exponen los escritorios guardados.
- Sin acceso excepcional a nombres, notas o materiales completos. Si se necesita más adelante, requiere un flujo específico de soporte con alcance, instrucciones y autorización documentados según proceda; no se habilita con esta actualización.

## Registro y conservación

Los inicios de sesión correctos de cuentas con licencia de Profesor Particular se registran desde esta versión, indicando Google o contraseña. La autenticación es compartida entre aplicaciones: este evento no demuestra por sí solo que se haya abierto Profesor Particular. La renovación de token no se cuenta como un inicio de sesión. Una cuenta vinculada a Google puede también entrar por contraseña: son datos distintos.

La apertura autenticada del escritorio se observa en GET `/api/state?app=profesor_particular`, agrupada cada 30 minutos. No es un indicador en directo ni un seguimiento de cada clic. Las fechas se muestran en horario de Madrid. No se registra IP, ubicación precisa, URL visitada, agente de navegador ni huella de dispositivo para esta ficha.

Los eventos de inicio/apertura se eliminan tras 90 días. Cada consulta de ficha/catálogo registra administrador, cuenta, fecha, sección y finalidad seleccionada (administración, soporte o seguridad), sin guardar búsquedas ni contenido; se elimina tras 180 días. La limpieza se ejecuta con la tarea del worker cada cinco minutos mientras esté disponible y también al consultar la ficha. El borrado de cuenta elimina estos nuevos eventos asociados. Otros registros operativos tienen su propia política.

Las cifras de generación corresponden a trabajos que aún conserva la base de datos; no equivalen necesariamente a todos los intentos desde el alta. Los consumos mostrados pertenecen solo a Profesor Particular. Las sesiones vigentes no revelan código, respuestas ni participantes.

## Seguridad y operación

GET `/admin/profesor-users/{UUID}` y `/admin/profesor-users/{UUID}/materials` exigen superadministrador activo de una organización activa. Los errores y respuestas administrativas llevan `private, no-store` y `noindex`. Las respuestas usan listas explícitas de campos y no serializan el objeto User ni el estado privado.

La migración 0021 ajusta las copias a cinco y añade su fecha diaria sin modificar el escritorio actual. La ficha usa los registros de auditoría existentes. No se infieren conexiones anteriores al despliegue ni se alteran cuentas, revisiones o contenido al consultar. La actualización de `/privacidad` explica finalidad, alcance y plazos; debe mantenerse visible y comunicarse a usuarios por el medio adecuado cuando corresponda. No constituye una autorización general para inspeccionar contenido privado.

Para publicar en el VPS, utilizar el despliegue habitual con sus copias y comprobaciones de conservación: `cd /opt/educa-suite && git pull --ff-only && bash infra/deploy-hostinger.sh`. El worker debe estar funcionando para que la limpieza periódica se ejecute también sin visitas al dashboard.
