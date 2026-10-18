# Avisos de administración a Profesor Particular

En el dashboard, **Notificaciones → Nuevo aviso → Revisar aviso → Enviar**. La vista previa muestra el título y el texto tal como los verá el destinatario. El número de cuentas se consulta antes del envío; la confirmación indica la cifra realmente entregada. El historial muestra los últimos 20 envíos y totales agregados de entregados, leídos y eliminados. No identifica qué profesor leyó cada mensaje.

La audiencia son los usuarios y organizaciones activos que tienen un acceso asignado a Profesor Particular, normal o Premium, incluidos accesos de organización. Se excluyen administradores y cuentas de otras aplicaciones. Se incluyen cuentas con licencia caducada, para que puedan consultar sus avisos al recuperar el acceso; la bandeja exige un acceso vigente. El envío se dirige a las cuentas existentes en ese momento: no entrega retroactivamente avisos a cuentas creadas después.

La campana junto al perfil está disponible en el encabezado común. Su contador representa los avisos sin leer, se actualiza al entrar y cada minuto con la pestaña visible. Abrir la bandeja confirma la lectura de los mensajes cargados, sin borrarlos. Los avisos siguen guardados en el servidor tras cerrar sesión, recargar o cambiar de dispositivo. **Eliminar** oculta ese aviso solo para la cuenta actual y no modifica otras bandejas. La bandeja carga hasta 30 avisos por página, con «Ver más avisos» cuando procede.

El contenido es texto plano, de hasta 120 caracteres de título y 3000 de mensaje. No ejecuta HTML ni inserta enlaces arbitrarios. Solo un superadministrador autenticado puede publicar. El servidor verifica el destinatario al consultar, marcar leído o eliminar; no acepta un identificador de otro usuario para cambiar su bandeja. Los mensajes y sus estados tienen respuestas privadas sin caché y no se incluyen en los materiales, copias del trabajo del profesor ni códigos de juego anónimos.

Cada envío tiene una clave única: reintentar después de un fallo de red devuelve el envío anterior sin duplicarlo. La entrega y la auditoría se confirman en una sola transacción. El texto se almacena una sola vez; cada destinatario tiene únicamente la relación con el aviso y las fechas de lectura/eliminación. Eliminar una cuenta suprime sus relaciones sin afectar a otras cuentas.

La migración **0024_profesor_notifications**, posterior a 0023, crea dos tablas nuevas. No altera datos de alumnos, materiales, cuentas ni sesiones. Se distribuyen también el módulo y estilo de la campana, y el JavaScript del dashboard. El comando habitual de despliegue aplica la migración y comprueba la presencia de tablas y recursos:

```bash
cd /opt/educa-suite && git pull --ff-only && bash infra/deploy-hostinger.sh
```

Validado con pruebas automatizadas de autorización, aislamiento, entrega, paginación, reintentos, validación, borrado de cuenta y conservación de datos. Pruebas de navegador con dos cuentas ficticias locales: envío desde dashboard, contador, apertura, conservación al recargar, eliminación y presentación móvil. No se han enviado mensajes a usuarios reales ni desplegado en Hostinger.
