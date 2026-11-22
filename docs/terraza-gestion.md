# Gestión integrada en LA TERRAZA

El propietario ha pedido reunir LA TERRAZA y el dashboard sin retirar todavía la administración online. La sección **Gestión** es el acceso principal. El dashboard de `https://educame.tech/admin-dashboard/` permanece disponible como respaldo, con la misma interfaz y rutas de siempre. Su retirada necesita una decisión posterior del propietario.

## Dónde hacer cada cosa

| Tarea | Lugar |
| --- | --- |
| Crear apps, cambiar Pública/Privada/Pausada y contraseña de entrada | Apps |
| Revisar temas, juegos, preguntas, textos y landings | Contenido |
| Pedir implementaciones, seguir trabajos y deshacer la última subida | Encargos |
| Usuarios, licencias, notificaciones, IA y anuncios | Gestión |
| GitHub y despliegue confirmado en Hostinger | Operación |

Desde **Gestionar usuarios** en una tarjeta se abre Gestión con esa app seleccionada. El selector incluye también GADEOS y las apps privadas del catálogo. En las apps educativas normales aparecen Usuarios y licencias, Notificaciones y Modelos de IA. Profesor Particular añade Anuncios. Las apps privadas conservan sus cuentas con nombre y contraseña, sin convertirse en usuarios por correo. HazloTú mantiene su configuración de acceso existente.

La vista de todas las apps conserva el resumen, los modelos y los anuncios. La inspección de una cuenta de Profesor Particular mantiene su ficha y la elección de finalidad exigida por el servidor. Las decisiones de moderación, borrado, recuperación y envío mantienen las confirmaciones y comprobaciones del dashboard original.

## Una administración, dos accesos

Gestión sirve una adaptación local de los mismos archivos de `admin/` dentro de LA TERRAZA. La adaptación cambia la navegación y los colores y evita duplicar barras laterales. No modifica los archivos que se sirven online ni guarda una segunda base de cuentas. Las operaciones llegan a la API online existente con los mismos permisos de superadministrador, revisiones, validaciones y auditoría.

La sesión administrativa es la misma que utiliza Apps. Conectarse una vez permite usar ambas secciones durante su vigencia de treinta minutos. El token real permanece en el servidor local y en su almacén cifrado; el navegador recibe solo una cookie HttpOnly de sesión local y un marcador sin permisos. Cerrar la sesión administrativa la invalida en el servidor. Las conexiones de Codex, GitHub y SSH son independientes.

El puente permite exclusivamente rutas y métodos administrativos enumerados. No acepta un destino remoto arbitrario, encabezados de autorización enviados por el navegador ni rutas de archivos libres. La API local exige el origen del panel. Solo la página administrativa integrada admite ser enmarcada por el propio origen local; el resto conserva sus restricciones. Las nuevas claves de proveedores se envían al servidor online, no a GitHub ni a los encargos de los agentes.

Las modificaciones de cuentas, licencias y configuración se aplican inmediatamente online. No requieren un despliegue. Las implementaciones de código siguen pasando por Encargos, GitHub y Hostinger. Esta distinción se conserva también cuando se trabaja enteramente desde LA TERRAZA.

## Verificación y transición

Las pruebas en Chromium y WebKit móvil utilizan una API real aislada y cuentas ficticias. Comprueban creación desde LA TERRAZA, lectura desde el dashboard, edición inversa, licencias, notificaciones dirigidas a una app, modelos, anuncios, cierre de sesión y pantalla móvil. Las pruebas unitarias verifican los destinos permitidos, la sesión del servidor y que los archivos online originales no se hayan transformado. No envían avisos a usuarios reales ni hacen llamadas de pago a proveedores.

Antes de retirar el dashboard de respaldo se debe revisar con el propietario el uso real de las funciones menos frecuentes, incluida la inspección, moderación y configuración de proveedores. Mientras tanto, el enlace al respaldo queda visible en Gestión y al pie de LA TERRAZA, y las rutas antiguas siguen funcionando.
