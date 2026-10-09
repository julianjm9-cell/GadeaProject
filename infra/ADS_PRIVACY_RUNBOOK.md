# Tablón: operación, privacidad y tareas del titular

Fecha y versión: 2026-10-09.3. Este registro describe medidas aplicadas; no certifica cumplimiento jurídico completo.

## Funcionamiento implementado

- Publicación sin cuenta, con declaración de mayoría de edad y derechos sobre contenido, condiciones y consentimiento de publicación separado. Se guarda texto, versión y fecha. No hay casillas premarcadas, tampoco al editar.
- Contenido/contacto profesional voluntario visible, avisando de buscadores y copias. No se promete anonimato ni ausencia de datos personales.
- Gestión con clave aleatoria en fragmento URL, solo hash en BD; API mediante cabecera. Enlace descargable, no almacenado automáticamente en localStorage. No enviar nunca la clave por correo a soporte.
- Datos y claves privados no se cachean ni indexan; CSP, bloqueo de marcos y no-referrer en el tablón. Subidas limitadas a 5 MB, decodificadas y recodificadas sin EXIF; límite total de solicitud, límites de frecuencia y validaciones del servidor. Texto escapado en interfaces pública y administrativa.
- Los anuncios no caducan ni se borran automáticamente. El anunciante puede pausarlos o eliminarlos con su enlace privado y administración puede retirarlos o borrarlos cuando corresponda.
- Avisos privados: nombre/correo salvo excepción de abuso sexual infantil, motivo, URL, buena fe, referencia y enlace de seguimiento. Resoluciones motivadas y registro manual de correos enviados. No se identifica al denunciante ante el anunciante.
- Las copias de despliegue se conservan hasta una revisión manual. El despliegue desactiva y elimina el antiguo temporizador `educa-suite-backup-retention.timer`. Las copias del proveedor, manuales y exportaciones también deben revisarse de forma manual.

## Cada día: comunicaciones

Abrir administración → anuncios → denuncias. Priorizar amenazas, fraude y datos de menores. El justificante web confirma automáticamente la recepción. Para avisos con correo, usar «Preparar acuse», enviarlo desde educamesuite@gmail.com y después marcarlo enviado. No hay SMTP configurado ni envío automático: abrir un borrador no equivale a enviarlo.

Investigar de forma objetiva. No es preciso monitorizar todo el contenido de forma general, pero deben atenderse diligentemente avisos que permitan identificar su ilicitud. Si se retira/restaura, explicar hechos y norma sin datos del denunciante. Registrar además la decisión en cada aviso afectado; enviar resolución por correo y marcar envío. Atender solicitudes de revisión en el punto de contacto. Ante sospechas de delitos con amenaza para vida/seguridad, valorar y cumplir la comunicación a autoridades exigida por el artículo 18 DSA; ante peligro inmediato, servicios de emergencia. No descargar material de abuso infantil para investigarlo.

## Derechos y enlace perdido

Canal: educamesuite@gmail.com. Acusar recibo, registrar fecha, petición, anuncio/cuenta y vencimiento de un mes; cualquier ampliación legal debe comunicarse dentro del primer mes. Identificar al solicitante proporcionalmente: enlace privado si lo conserva, control del contacto ya publicado o evidencia previa verificable. No cambiar contacto ni entregar una nueva clave solo porque alguien conozca el anuncio. No pedir DNI de rutina. Si no se logra identificar, explicar límites y alternativas. Puede retirarse preventivamente contenido con datos ajenos mientras se investiga. No conservar documentos identificativos más tiempo del necesario.

## Registro de tratamientos del tablón

Responsable: Julián Jiménez Moreno (datos en aviso legal). Personas: anunciantes adultos, informantes y usuarios técnicos. Publicación: consentimiento; gestión: prestación del servicio; seguridad: interés legítimo documentable de evitar fraude/abuso; avisos legales: obligación legal. Datos: contenido e imagen, contacto público, consentimiento, hash de gestión; avisos: identidad/contacto, motivo y resolución. Público: solo contenido del anuncio. Destinatarios privados: administración, alojamiento y autoridades cuando corresponda. Conservación: sin borrado por plazos automáticos; revisar manualmente anuncios, avisos y copias y atender las solicitudes de supresión verificadas. Revisar garantías de Hostinger y del correo antes de afirmar regiones o transferencias concretas. En el tablón no se envían anuncios a IA.

## Proveedores, cookies y seguridad: completar fuera del código

El titular debe obtener/archivar contratos de encargado de tratamiento de Hostinger y demás encargados, confirmar regiones efectivas, subencargados, acceso fuera del EEE y garantías de transferencias. Comprobar también Gmail utilizado para soporte (no presumir que una cuenta gratuita tenga las condiciones de Workspace). Ajustar política a estos datos reales; no se han inventado ubicaciones ni firmado contratos desde el código.

No se han encontrado scripts Analytics/Tag Manager/Meta Pixel/Clarity/Hotjar en las landings revisadas. El tablón solo carga recursos propios. Comprobar el sitio desplegado, plugins, CDN y cambios posteriores. Antes de añadir rastreo no exento, incorporar consentimiento previo y rechazo equivalente. Revisar cookies reales y duraciones configuradas al cambiar variables del servidor.

Mantener actualizaciones, permisos mínimos, MFA de Hostinger/Git/correo y copias restringidas. Verificar COOKIE_SECURE=true en producción y evitar registro de cuerpos de formularios, claves o comunicaciones. Mantener un registro de incidencias; valorar riesgo de brechas y notificación a AEPD dentro de 72 horas desde conocimiento cuando proceda, y comunicación a afectados si existe alto riesgo. No toda incidencia requiere notificación.

## Restauración y excepciones

Restaurar aislado de internet. Conservar antes las solicitudes de supresión y decisiones posteriores a la fecha de la copia, aplicar de nuevo todas las bajas/retiradas y ejecutar la limpieza antes de reabrir el sitio. No restaurar copias directamente a publicación pública. Comprobar también imágenes huérfanas. Revisar cualquier copia externa/manual: el temporizador no la elimina. Si una reclamación u obligación exige preservar evidencia concreta, documentar motivo, alcance, acceso y fecha de revisión en un archivo restringido; no mantener anuncios públicos por ello.

## Alcance pendiente

Estas medidas se centran en el tablón. La aplicación docente requiere revisar por separado el papel responsable/encargado respecto a alumnos, contrato del artículo 28 RGPD cuando corresponda, tratamiento de menores, proveedores IA y transferencias. Revisión jurídica final de textos y operación recomendada; una exención no sustituye obligaciones.

Fuentes: [RGPD](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [LSSI](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758), [DSA](https://eur-lex.europa.eu/eli/reg/2022/2065), [AEPD cookies](https://www.aepd.es/guias/guia-cookies.pdf).
