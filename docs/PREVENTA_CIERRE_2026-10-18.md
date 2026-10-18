# Cierre técnico de la auditoría de Profesor Particular

18 de octubre de 2026. Esta entrega modifica código y preparación de despliegue; no acredita que Hostinger ya ejecute la nueva versión.

## Paquete 1 · Cuentas y seguridad

- Alta por contraseña pendiente de acreditación del correo. No hay licencia, créditos ni sesión de trabajo hasta verificarlo. El titular del correo elige la contraseña al abrir el enlace, para no conservar una contraseña escogida por un registro previo ajeno.
- Google acredita el correo y conserva el identificador de usuario, organización, contenido y licencias. Al acreditar una cuenta sin correo verificado, se invalidan su contraseña anterior y sesiones. Las cuentas ya verificadas conservan su contraseña legítima.
- Sesiones registradas en el servidor, revocables y con renovación rotatoria. Cambio de contraseña, recuperación, cambios administrativos efectivos de seguridad y cierre de todas las sesiones invalidan los accesos anteriores. Cambiar un plan o el nombre visible no elimina contenido.
- Verificación y recuperación mediante enlaces aleatorios de un solo uso, de treinta minutos; solo se guardan sus huellas. Respuesta genérica a las solicitudes de recuperación y límites de intentos. Las rutas y pantallas distinguen la falta de correo saliente.
- Validación de Host, protección de privacidad por ruta ASGI y comprobación de origen para escrituras con cookie. Backend y administración publicados solo en localhost; Caddy suministra la IP real al backend, que solo confía en pares de redes privadas/host.
- Credenciales OAuth cifradas con una clave de despliegue independiente de la base. El despliegue la genera una vez, conserva la existente y convierte los tokens antiguos sin cambiar sus cuentas Google. El cifrado no sustituye la custodia de `.env`.
- Actualización compatible de dependencias y sustitución de la biblioteca JWT. El análisis de requisitos de esta entrega no encuentra avisos conocidos; esto no certifica la inexistencia de vulnerabilidades.

**Transición:** los tokens anteriores al despliegue carecen de sesión revocable. Será necesario iniciar sesión de nuevo una vez; no se borran cuentas, licencias ni escritorios. Los accesos antiguos por contraseña siguen disponibles. Si el propietario acredita con Google un correo que todavía no constaba verificado, deberá usar Google o la recuperación por correo para definir después una contraseña propia.

## Paquete 2 · Guardado y sesiones

- Cinco borradores de edición por cuenta, caducidad de siete días, comprimidos y separados de la biblioteca. Recuperación desde Perfil → Recuperar trabajo. Guardar un borrador nunca sobrescribe automáticamente el material.
- Copia técnica local por cuenta para ediciones/cambios pendientes ante desconexión. Si hay otra revisión en el servidor, se ofrece descargar los cambios; no se mezclan automáticamente ni se impone una versión antigua sobre una nueva.
- Aviso propio al cerrar el editor: seguir editando o cerrar conservando el borrador. Comprobado en navegador: modificar un título, cerrar la pestaña, volver a entrar, recuperar la edición y guardarla.
- Bandeja de generaciones recientes y recuperación del mismo identificador. Los resultados nuevos se vinculan al material guardado para no ofrecerlo otra vez como pendiente; el servidor comprueba la incorporación.
- Ruta antigua y generación en segundo plano usan la misma admisión, identificador, progreso, reserva y cobro. La regeneración utiliza ese mismo sistema. Un reintento no crea una contabilidad alternativa.
- Hasta ochenta preguntas tanto en material como en sesión e índices de corrección. Los materiales incompatibles por tamaño, formato o imágenes locales muestran el motivo antes de compartir.
- Seguimiento con reconexión progresiva, pausa en pestaña oculta y consultas por revisión; las respuestas sin cambios no incluyen todo el material. Los latidos no incrementan la revisión del contenido y sus escrituras se agrupan.
- Ficha administrativa: guardado real y última copia separados. Límites de tamaño, profundidad, listas, estructura y formato en el guardado, conservando campos históricos y protecciones de conflicto.

**Límite de recuperación:** no se puede garantizar trabajo nunca guardado ante pérdida simultánea del dispositivo y del servidor. Los cinco respaldos nocturnos siguen siendo cinco, a las 00:00 de Madrid. Un borrador no es una copia externa del VPS.

## Paquete 3 · Comercial y operación

- Altas futuras normales: tres alumnos, un juego avanzado con IA al día si hay saldo y creación manual libre. Las licencias actuales no se migran a un plan inferior.
- Premium por contacto y activación manual. Sin precios inventados, checkout, cargos ni renovaciones automáticos. Página `/profesor/planes` y texto de la app explican que «sin límite diario» no elimina los créditos ni los límites de capacidad.
- Registro operativo de llamadas de generación de actividades, incluidos fallos y reintentos, separado de los créditos del cliente: modelo, proveedor, estado, duración y tokens disponibles. Coste desconocido si no se dispone de tarifa/uso, no un cero ficticio.
- Dashboard administrativo y `python -m app.operation_check`: señales recientes del worker y copias, retrasos de respaldo, espacio, errores de IA y umbral de coste. El worker escribe alertas técnicas en sus registros; no se ha configurado un canal externo de avisos.
- Ensayo de restauración disponible en `infra/test-restore-hostinger.sh`: base temporal, comprobación de contenido y archivo de documentos legible. No sustituye ni restaura sobre la base real. Todavía debe ejecutarse con una copia real en Hostinger.
- CI para pruebas de backend, interfaz, migraciones/conservación y avisos de dependencias. Pruebas obsoletas adaptadas al comportamiento actual.
- Privacidad y almacenamiento local explican borradores, seguridad y metadatos operativos. Plantillas internas de oferta/encargo en `docs/PREMIUM_VENTA_ASISTIDA.md`; no se publican contratos con huecos como si estuvieran aceptados.

## Validación de esta entrega

- 373 pruebas de backend superadas, incluidas migraciones, conservación del estado, cuentas, recuperación, créditos, sesiones, Diplomator y OCR.
- 19 pruebas de interfaz superadas. Comprobación de sintaxis de los scripts y las plantillas modificadas, y de ambos scripts de despliegue/restauración.
- Análisis de `backend/requirements.txt` sin vulnerabilidades conocidas en la fecha de la entrega.
- Revisión en navegador de recuperación y guardado de una edición. El logotipo mantiene su función de Inicio y ahora tiene contorno, sombra, foco de teclado y selección visible en las tres apariencias. Cabecera de 78 px en escritorio y 66 px en móvil, sin desbordamiento horizontal en la comprobación móvil.
- No se ha construido una imagen Docker local: el servicio Docker de este equipo no está disponible. La construcción y el ensayo con PostgreSQL real siguen siendo comprobaciones del despliegue.

## Configuración y comprobación de Hostinger

1. Conservar `.env`, documentos y volúmenes. Ejecutar la actualización habitual:

   ```bash
   cd /opt/educa-suite && git pull --ff-only && bash infra/deploy-hostinger.sh
   ```

   El script añade configuración de seguridad y solo cambia la política de altas nuevas a `PROFESOR_FREE`; conserva las licencias existentes. Aplica `0022_revocable_accounts` y `0023_teacher_editor_recovery` después de generar la copia previa y antes de comprobar las huellas de los escritorios.

2. Configurar correo saliente en `.env`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD` y TLS. Ejemplo de transporte: STARTTLS en 587 o SSL en 465, según el proveedor. `PUBLIC_BASE_URL` debe ser el dominio HTTPS real. No pegar contraseñas en chats ni sustituir la clave OAuth en actualizaciones futuras.

   **Sin SMTP:** se conserva el acceso de cuentas existentes y Google; el alta nueva por correo y la recuperación por enlace se muestran como no disponibles. No se simula que se envió un correo.

3. Consultar el dashboard y ejecutar:

   ```bash
   docker compose exec -T backend alembic current
   docker compose exec -T backend python -m app.operation_check
   ```

4. Elegir la carpeta de copia indicada por el despliegue y ejecutar:

   ```bash
   bash infra/test-restore-hostinger.sh backups/deploy-CARPETA-REAL
   ```

   Sustituir la carpeta por una existente. La prueba valida SQL/restauración y legibilidad del archivo; falta comprobar manualmente que los documentos recuperados concretos y sus permisos son los esperados antes de prometer un tiempo de recuperación.

5. Opcionalmente definir `AI_MODEL_PRICES_JSON` con las tarifas reales por millón de tokens de cada modelo y `AI_MONTHLY_BUDGET_USD`. Contrastar los intentos sin uso conocido con la consola/factura del proveedor. Un umbral avisado no equivale a un bloqueo de gasto del proveedor.

6. Confirmar HTTPS, firewall, que 8890/5174 no son públicos, copias propias de Hostinger, espacio ocupado por respaldos de despliegue y conservación de las claves. No se han borrado respaldos antiguos ni añadido servicios externos.

## Lo que sigue siendo externo al código

- Datos de la oferta individual: precio final, impuestos, duración, créditos, soporte, cancelación y derechos aplicables, comunicados antes de cobrar.
- Aceptación y archivo de condiciones, facturación y encargo cuando el profesor/centro utiliza el servicio como responsable del tratamiento. Completar responsables, subencargados, ubicación y garantías reales de Hostinger/IA; esta entrega no acredita contratos que no se han facilitado.
- Canal y responsable de atender alertas, ensayo real de restauración y medición gradual de capacidad. No se ha realizado una prueba de carga ni un ensayo sobre producción desde este entorno.

Referencias primarias: [recuperación de contraseña, OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [AEPD, relación entre responsable y encargado](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/8-responsable-y-encargado-del-tratamiento), [TRLGDCU consolidado, BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555).
