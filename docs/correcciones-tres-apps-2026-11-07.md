# Cierre de correcciones de Profesor Particular, ESO Adultos e Inglés

Fecha: 7 de noviembre de 2026. Base: `90e5028`.

Aplicación del encargo «todo menos las mejoras»: corregir los fallos y riesgos reproducidos de la auditoría, consolidar la publicación y optimizar recursos, conservando el temario, los juegos, las escenas y la navegación actuales. No se añaden las cuatro funciones opcionales propuestas al final de la auditoría.

## Cambios realizados

| Área | Corrección y comportamiento resultante |
| --- | --- |
| Publicación y notificaciones (A01–A02) | Docker incorpora todos los módulos JavaScript compartidos. La migración de notificaciones comprueba la columna y el índice antes de crearlos; admite instalaciones nuevas y actualizaciones. Se comprueban también los recursos dentro de la imagen, sin depender del checkout. |
| Guardado de estudio (A03) | ESO e Inglés rechazan el vaciado sin confirmación y la omisión de campos importantes previamente guardados. La validación conserva campos históricos desconocidos y mantiene los controles de versión entre pestañas. |
| Recuperación de ESO (A04) | Copias locales de cambios pendientes por cuenta y sesión de página, máximo cinco. Las copias caducadas se eliminan al acceder a esa cuenta; plazo de siete días. Recuperación explícita, descarga y comprobación de la versión del servidor antes de aplicar. Una copia antigua nunca se aplica automáticamente encima de un progreso más reciente. Esta protección local depende del almacenamiento disponible en el navegador y no sustituye las copias del servidor. |
| Sesión (A05) | Cliente común para renovar una sesión caducada y repetir una vez la petición original. Coordina peticiones concurrentes y conserva el destino de regreso a Inglés. Excluye terceros y peticiones deliberadamente anónimas. Estudiar sigue disponible aunque se hayan agotado los créditos de IA. |
| Concurrencia de IA (A06) | La admisión y comprobación de saldo usan bloqueos sin espera en PostgreSQL. Una cuenta ocupada recibe un aviso temporal y puede reintentar; no espera bloqueando el bucle asíncrono. Las cuentas con saldo limitado mantienen la serialización hasta confirmar el consumo. La medición operativa se escribe después de liberar el bloqueo. |
| Entrega y consumo de IA (A07) | Chat, OCR y transcripción identifican cada petición. Un reintento con el mismo identificador recupera la respuesta ya completada sin duplicar su cargo, incluso si consumió el último crédito. Se guardan respuesta y consumo en la misma transacción. Los recibos técnicos caducan a los siete días. Las respuestas vacías o los fallos de proveedor no consumen créditos; los mensajes de saturación explican cómo reintentar. Se conserva la compatibilidad de las rutas antiguas. |
| Supervisión y privacidad (A07) | Las llamadas de IA se clasifican por aplicación en el resumen operativo. Las tarifas desconocidas siguen marcadas como desconocidas. Las respuestas privadas de las API no se almacenan en caché compartida. Se acotan los cuerpos de chat, imagen y audio. La política de privacidad explica los recibos técnicos de siete días. |
| Progreso (A08) | El servidor contrasta las recompensas con el catálogo y la evidencia guardada. ESO guarda primero y conserva las recompensas pendientes para volver a enviarlas. El bloqueo del perfil evita perder incrementos concurrentes. No se recalculan ni retiran objetos o logros históricos. |
| Contenido concreto (A09) | Se sustituyen los distractores manifiestamente ajenos al contexto detectados en Historia y Ciencias, manteniendo las respuestas correctas. Se actualiza la expectativa de una prueba que apuntaba a una imagen antigua. |
| Rendimiento (A14) | Nueve variantes WebP sin pérdida, con el mismo tamaño y píxeles decodificados: de 20.052.076 a 14.868.590 bytes (−25,9 %). Se mantienen las URL PNG y su alternativa original; se negocia WebP con `Vary: Accept`. Caddy comprime las respuestas compatibles con gzip/zstd. |
| Verificación (A15) | Dependencias de prueba reproducibles y resolución de Playwright independiente del ordenador. CI incluye catálogos, flujos críticos de las tres apps, Chromium, WebKit y concurrencia real con PostgreSQL. Se amplía el control de despliegue para los nuevos recursos y el esquema. |

## Datos y compatibilidad

- La migración `0026_ai_delivery` añade recibos técnicos y la clasificación de llamadas por aplicación. No elimina cuentas, materiales, fichas, documentos, progreso ni inventario.
- Se han probado las migraciones desde cero hasta `0026` con PostgreSQL 16 y el ciclo `0024 → 0026` conservando datos ficticios de cuentas, licencias, los tres estados de estudio y notificaciones.
- Las comprobaciones Docker usan una base temporal separada. No se ha sustituido la base activa ni se han restablecido contraseñas.
- Las cinco copias diarias de Profesor Particular existentes no cambian de retención ni horario. Las cinco copias locales pendientes de ESO son una protección diferente.
- Las variantes optimizadas mantienen los archivos originales para navegadores y enlaces anteriores.

## Verificación de cierre

- **Backend:** 469 casos distintos verificados entre la suite principal y las comprobaciones focalizadas. La ejecución principal con Python 3.12 en Docker aprobó 464 casos; se corrigió una expectativa demasiado estricta de `Vary` y se comprobó el contrato que necesita Node en el equipo que sí dispone de ese runtime. La ejecución final focalizada aprobó 11 casos, incluidos los tres contratos antiguos añadidos y la concurrencia real en PostgreSQL. Los cuatro contratos de interfaz compartida también aprobaron con Node disponible. Los casos repetidos no se suman al total de casos distintos.
- **Interfaz, corrección y catálogos:** 117 pruebas aprobadas.
- **Navegadores:** 18 pruebas críticas aprobadas en Chromium/WebKit, incluidas recuperación tras recarga, audio, juegos, guardado, escritorio/móvil/tableta y las otras aplicaciones que comparten sesión.
- **Empaquetado:** imagen Docker construida, recursos compartidos servidos desde la imagen sin checkout y Caddy validado.
- **Migraciones y datos:** instalación nueva y actualización con PostgreSQL 16; conservación de cuentas ficticias, licencias, estados de las tres apps y avisos.

Las pruebas de proveedores usan respuestas simuladas: no se gastan créditos reales ni se envían notificaciones a usuarios. PostgreSQL sí se usa de forma real en la prueba concurrente y las migraciones. No se atribuye a estas pruebas una capacidad de usuarios simultáneos del VPS ni se promete ausencia absoluta de fallos.

## Fuera de este encargo

Se mantienen como propuestas las funciones opcionales de aviso de ejercicios, repaso nuevo de errores, demostración pública y guía inicial. También quedan como mejoras editoriales la ampliación del banco de contenidos, una selección adaptativa de preguntas/parejas y nuevas escenas o recorridos. No se han cambiado contenidos buenos, identificadores, distribución de pantallas ni flujos de estudio para introducirlas.

## Publicación

Los cambios se publican mediante el procedimiento habitual, que incluye copia previa y comprobaciones:

```bash
cd /opt/educa-suite && git pull --ff-only origin main && bash infra/deploy-hostinger.sh
```

La verificación del VPS debe proceder de la salida de ese script. Las pruebas locales y de Docker no equivalen a haber desplegado esta revisión en Hostinger.
