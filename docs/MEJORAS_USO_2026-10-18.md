# Mejoras de los recorridos existentes

18 de octubre de 2026. Sin nuevas secciones, cambios de planes, migraciones ni acceso a usuarios reales.

- Respuestas compartidas: estado real de guardado, cola de borradores por pregunta, conservación de la versión más reciente y reintentos progresivos. Avanzar, comprobar, terminar o salir espera al guardado pendiente. Los reintentos automáticos guardan respuestas; no repiten una corrección ni finalizan una partida.
- Una respuesta pendiente permanece en memoria de la pestaña. Se avisa antes de abandonarla y se puede reintentar. No se añade almacenamiento persistente de respuestas de alumnos en el navegador.
- Materiales: curso y tipo también en privados; búsqueda, curso, asignatura, tipo y página independientes para cada vista durante la navegación. Recuento de resultados filtrados. El selector Combinados/Sueltos público conserva su comportamiento.
- Editor: errores junto al campo, relación accesible con el mensaje, apertura del ejercicio y de los detalles correspondientes, foco en la solución o enunciado afectados y validación del título. Guardar y Guardar y usar comparten el mismo comportamiento.
- Juegos: mensajes de error integrados, confirmación de finalización dentro de la actividad en uso personal y compartido, foco recuperado después de corregir y estados de revisión traducidos. Se evita repetir el enunciado de los huecos.
- Cambiar una respuesta elimina la corrección anterior. Las partes que no cambian conservan su valoración cuando procede; reintentar un guardado idéntico no borra una corrección válida. La autocorrección numérica usa el mismo margen de redondeo en ambos recorridos.
- El bloqueo de sesiones ofrece «Consultar Premium», conservando el contacto y la activación manual.

## Comprobación

- Batería completa de backend: 376 pruebas superadas. Después se añadió y superó una comprobación adicional que renderiza los 26 formatos en uso personal, alumno y seguimiento del profesor: 377 pruebas distintas de backend en total.
- 26 pruebas de interfaz superadas, incluidas pérdida de conexión, edición durante un envío, conservación de la última respuesta, orden de navegación, límites de reintento, validación de campos y envío del formulario sin navegación nativa.
- Matriz de integración: responder, guardar, comprobar, avanzar, terminar y volver a cargar los 26 formatos, comprobando el mismo resultado desde alumno y profesor. Incluye formatos antiguos con imágenes para conservar compatibilidad.
- Navegador con cuentas ficticias: filtros públicos/privados independientes; validación y guardado del editor; fallo temporal del servidor, recuperación automática y respuesta conservada; corrección verde/roja, finalización y resultado; recorrido personal con fracciones; filtros en móvil sin desbordamiento.
- No equivale a jugar manualmente todas las combinaciones de contenido de los 26 formatos. Las comprobaciones automáticas cubren sus contratos y renderizado; las interacciones de navegador se centran en los recorridos modificados.

El despliegue sigue utilizando `bash infra/deploy-hostinger.sh`. Esta entrega no configura correo, contratos, alertas externas ni ensayos en el VPS.
