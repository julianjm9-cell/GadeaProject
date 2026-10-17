# Límites de Profesor Particular

La licencia del servidor determina el plan; el estado que envía el navegador no puede activar Premium.

| Función | Normal | Premium |
| --- | --- | --- |
| Sesiones con código | Sección visible y bloqueada | Acceso completo |
| Nuevas fichas de alumnos | Hasta 3 | Sin límite de plan |
| Generación IA de juegos avanzados | Una al día entre todos los tipos | Sin límite diario |
| Creación manual | Libre | Libre |

Los juegos avanzados son Pasapalabra, Ahorcado, Sopa de letras, Memory, Flashcards, Construye la frase, Línea temporal, Encuentra el error, Crucigrama, Arrastrar y soltar, ¿Quién soy?, Elimina al intruso y Bingo de conceptos. Regenerar con IA una pregunta avanzada también utiliza el cupo. Los ejercicios básicos mantienen sus condiciones actuales. Los créditos de IA siguen aplicándose en ambos planes.

El cupo se reinicia a las 00:00 de Europe/Madrid, incluidos los cambios de hora. Solo una generación completada consume el uso. Un fallo libera la reserva; recuperar un intento ya completado no consume un segundo uso. Se comprueba tanto en la ruta directa como en la de trabajos en segundo plano y al contabilizar el resultado, con un bloqueo breve por cuenta para evitar admisiones simultáneas. Una reserva interrumpida puede retomarse con su identificador y caduca tras 30 minutos.

Se guarda un único registro compacto de cupo por usuario en `app_settings`; no requiere migraciones y no depende de los materiales que el profesor conserve o borre. Las fichas existentes por encima de tres se conservan y pueden editarse al pasar a normal. Se rechazan nuevas incorporaciones por encima del límite sin recortar los datos guardados. La recuperación de copias sigue disponible.

Los avisos de Premium se abren sobre el formulario actual para conservar el trabajo pendiente. La activación sigue siendo manual por el administrador tras contactar por `educamesuite@gmail.com` o WhatsApp `+34 663 533 412`. Este cambio no modifica los planes asignados ni la configuración de altas nuevas.

Validación: pruebas de permisos, conservación de fichas al cambiar de plan, cuota compartida entre trece tipos, reintentos, fallos, reservas simultáneas, aislamiento de cuentas y reinicio de día en Madrid. Revisión visual con cuentas ficticias normales y Premium, en escritorio y móvil.
