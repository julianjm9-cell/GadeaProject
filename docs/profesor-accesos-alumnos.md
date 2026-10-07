# Accesos Alumnos (Profesor Particular)

La pestaña **Accesos Alumnos** aparece en el escritorio de Profesor Particular. Solo las cuentas con licencia `PROFESOR_PREMIUM` pueden crear y gestionar accesos; el servidor repite esa comprobación en todas las operaciones. Las cuentas de alumno tienen credenciales y una cookie independientes de las del profesor: únicamente pueden abrir `/profesor/alumno` y consultar su nombre, el del profesor y el enlace de Meet compartido.

El profesor crea el usuario desde la tarjeta del alumno. La contraseña aleatoria solo aparece al crear el acceso o al restablecerla; en la base de datos se guarda su hash. Pausar el acceso, cambiar la contraseña o retirar Premium invalida el acceso del alumno. Si se elimina el alumno del escritorio, su portal queda bloqueado.

Para generar enlaces de Meet, habilita **Google Meet REST API** en el mismo proyecto de Google Cloud usado para el acceso con Google. El cliente OAuth existente debe aceptar el alcance `https://www.googleapis.com/auth/meetings.space.created` y conservar el URI de redirección configurado en `GOOGLE_REDIRECT_URI` (en producción: `https://educame.tech/auth/google/callback`). El profesor pulsa **Conectar Google Meet** y concede permiso con su propia cuenta Google. Si Google aún no está configurado, puede pegar un enlace `https://meet.google.com/xxx-yyyy-zzz` creado por su cuenta. El alumno lo verá sin refrescar manualmente en un máximo de 20 segundos; **Actualizar enlace** permite consultarlo al instante.

Meet se abre en una pestaña nueva de Google. La aplicación gestiona los accesos y comparte el enlace, sin alojar la videollamada ni sus grabaciones.

El despliegue con `docker compose --profile proxy up -d --build` crea la tabla y columnas nuevas durante el inicio del backend. La migración Alembic `0009_profesor_student_access` también está disponible para instalaciones que gestionen el esquema mediante Alembic.
