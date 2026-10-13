# Profesor Particular: comprobaciones de privacidad pendientes en producción

Fecha de revisión del código: 13 de octubre de 2026. Este documento registra comprobaciones técnicas y tareas del titular; no certifica cumplimiento jurídico.

## Lo que hace la aplicación

- No crea cuentas ni fichas de alumnos. El acceso a un juego usa un código temporal y una cookie técnica; la sesión no pide nombre ni correo. El profesor ve respuestas y resultados de esa sesión sin una identidad asociada en la aplicación.
- Las sesiones vencen a las 24 horas. Un proceso periódico elimina de la base activa el material copiado, las respuestas y las calificaciones; el profesor puede borrarlos antes. Las respuestas privadas se sirven con `Cache-Control: private, no-store`.
- El estado privado del profesor también se sirve sin caché. Las páginas públicas revisadas no incorporan Analytics, Tag Manager, Meta Pixel, Hotjar ni Clarity.
- Un código entregado individualmente puede permitir que el profesor identifique al participante fuera de la aplicación. Los materiales y respuestas libres también pueden contener datos personales si alguien los escribe. No se debe afirmar que los juegos son anónimos en sentido jurídico ni que es imposible tratar datos de menores.

## Comprobaciones del titular

1. **Desplegar y verificar.** Ejecutar `git pull --ff-only` y `bash infra/deploy-hostinger.sh` en `/opt/educa-suite`. El despliegue debe superar la comprobación de la base, de las cabeceras privadas y del proceso de limpieza. Revisar también `docker compose ps ocr-worker` y el procedimiento de [conservación de sesiones](TEACHER_DATA_RETENTION.md).
2. **Copias antiguas.** Identificar las copias de `backups/` anteriores a la migración 0018 y las instantáneas de Hostinger. Pueden contener fichas antiguas aunque la base activa ya no las tenga. Restringir acceso, registrar fecha y finalidad de cada copia y retirar manualmente las que dejen de ser necesarias, tras verificar que existe una recuperación viable. Repetir la limpieza tras cualquier restauración.
3. **Encargados y transferencias.** Conservar las condiciones y contratos aplicables de Hostinger y de los servicios efectivamente usados: Google (inicio de sesión, Drive, Meet y correo de soporte), Groq, Gemini u OpenAI según configuración. Confirmar ubicaciones, subencargados, posibles accesos desde fuera del EEE y garantías. Actualizar la política de privacidad con hechos confirmados; el código no puede aceptar contratos ni confirmar regiones por el titular. Si una función no dispone de garantías adecuadas, no usarla con datos personales hasta resolverlo.
4. **Solicitudes de derechos.** Recibirlas en el contacto publicado, registrar fecha, alcance y respuesta. Verificar identidad de forma proporcionada, localizar cuenta, materiales, sesiones todavía activas y copias pertinentes. Registrar las supresiones que deban reaplicarse al restaurar una copia. No pedir un documento de identidad por defecto.
5. **Incidencias.** Restringir accesos, conservar evidencia mínima, anotar cuándo se conoció el incidente, sistemas y categorías de datos afectadas y medidas adoptadas. Valorar el riesgo y, cuando proceda, la notificación a la AEPD dentro de 72 horas y la comunicación a afectados si existe alto riesgo. No enviar por correo ordinario copias de materiales o respuestas para investigar.
6. **Cambios futuros.** Antes de añadir analítica, publicidad, SDK o herramientas externas, revisar las cookies y el consentimiento previo. Repetir la comprobación de textos públicos si vuelven a añadirse perfiles, agenda individual o seguimiento.

La información al usuario debe describir destinatarios, transferencias y plazos de conservación cuando correspondan; el contrato con un encargado debe ajustarse al artículo 28 RGPD. Fuentes oficiales: [RGPD, artículos 13, 28, 33 y 34](https://eur-lex.europa.eu/eli/reg/2016/679/oj/spa), [AEPD, contratos con encargados](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/8-responsable-y-encargado-del-tratamiento/FAQ-0238-cual-seria-el-contenido-del-contrato-de-encargo-de-tratamiento) y [AEPD, guía de cookies](https://www.aepd.es/guias/guia-cookies.pdf).
