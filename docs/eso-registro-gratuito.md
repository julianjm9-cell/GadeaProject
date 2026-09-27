# Registro gratuito de ESO Adultos

## Primer paquete

El registro usa las tablas actuales de usuarios, organizaciones, licencias y consumo. No borra cuentas ni requiere una migración de esquema.

- Entrada: `/e25/login?mode=register`.
- Alta: `POST /auth/eso/register`, con correo, nombre y contraseña.
- La cuenta recibe exclusivamente una licencia personal de ESO, plan `ESO_FREE`.
- Valores iniciales: 100 créditos de IA y 365 días. Se pueden cambiar en el `.env` del servidor con `ESO_SIGNUP_CREDITS` y `ESO_SIGNUP_DAYS`. Solo afectan a nuevas concesiones.
- `ESO_SIGNUP_ENABLED=false` cierra el registro y la concesión gratuita a cuentas existentes. No quita accesos ya concedidos.
- Un correo existente debe iniciar sesión con su contraseña. El alta no cambia esa contraseña ni reemplaza la cuenta.
- Google concede únicamente el producto de la página de acceso, exige correo verificado y conserva las licencias existentes, incluso caducadas o suspendidas.
- Volver a entrar no renueva plazos ni añade créditos. El dashboard puede modificar el acceso y el total de cada app.
- El dashboard muestra la fecha de alta de la cuenta y distingue el acceso gratuito. En una cuenta antigua que añade ESO, la fecha sigue siendo la de creación de la cuenta.
- Al agotarse los créditos de ESO, siguen disponibles el contenido, estado y progreso; chat, OCR y audio requieren saldo. Las otras apps mantienen su política de acceso.
- Las peticiones de IA con saldo limitado se serializan por cuenta en PostgreSQL para que dos peticiones simultáneas no gasten el mismo saldo.

## Límites de este primer paquete

El registro con contraseña valida el formato del correo, pero todavía no envía un enlace de verificación ni recupera contraseñas por correo. Para eso falta conectar un servicio de correo transaccional. Google sí proporciona verificación del correo. La protección de frecuencia usa el mismo mecanismo en memoria del acceso actual: en despliegues con varios procesos se debe sustituir por un contador compartido.

## Pendientes del plan visual

1. Renovar la landing de ESO siguiendo el mockup público.
2. Simplificar el inicio de la app conservando sesión diaria, exámenes y progreso.
3. Quitar el selector de apps de los perfiles y devolver el cierre de sesión a la landing correspondiente en las cuatro apps.

## Comprobación

Las pruebas cubren alta y visibilidad en dashboard, aislamiento de apps, correo duplicado, alta deshabilitada, límite de intentos, incorporación de cuentas existentes, cuentas bloqueadas, Google sin renovación y estudio con saldo agotado.
