# Auditoría de Profesor Particular y ESO Adultos — 27 de octubre de 2026

## Alcance y evidencia

Revisión del código actual, los flujos de guardado, acceso, materiales, juegos, temas, exámenes, progreso y páginas públicas. Las correcciones locales se aplicaron después de esta revisión. No se ha desplegado nada en Hostinger.

- Pasan 13 pruebas de Node sobre ESO Adultos: juegos, sesión diaria, exámenes y asignaturas. Una ejecución previa de 12 pruebas complementarias también pasó.
- Durante la auditoría, cuatro pruebas antiguas de navegador de Profesor Particular fallaban al buscar nombres o selectores de una interfaz anterior. Se actualizaron y vuelven a cubrir los flujos actuales.
- La suite Python del backend llegó a 420 pruebas aprobadas y tres fallos por rutas obsoletas de sus propias pruebas; se corrigieron esas rutas y las tres pasaron al repetirlas. La protección nueva de estado de ESO también pasó su prueba de integración.
- No se ha verificado aquí el servidor real, el OCR con una foto real ni el proveedor de IA de Hostinger. La clave Groq local devolvió HTTP 403 en una prueba de conexión; no permite concluir que el servidor de producción tenga el mismo problema.

## Correcciones aplicadas localmente

- ESO Adultos muestra el estado real del guardado, permite reintentar, ofrece descargar una copia de los cambios pendientes y avisa antes de cerrar la pestaña con cambios sin confirmar. Los apuntes solo indican «guardados» después de la respuesta correcta del servidor.
- `/api/state` de ESO Adultos entrega una revisión `ETag` y exige `If-Match` al guardar. Una pestaña antigua recibe un conflicto y no sobrescribe el progreso nuevo.
- El catálogo público de Profesor Particular exige curso y asignatura cuando el profesor ha filtrado ambos; los materiales personales sin etiqueta siguen disponibles para corregirlos.
- Se actualizaron las pruebas antiguas de navegación, catálogo y acceso con código a los controles actuales, y se añadieron pruebas para el guardado de ESO y el filtro de materiales.
- La landing y el documento de despliegue describen los límites reales del plan normal y el alta normal por defecto.
- La inspección visual automatizada cubre diez juegos habituales y siete juegos avanzados adicionales en escritorio, portátil y móvil. Las 29 imágenes de portada referenciadas por los juegos públicos destacados existen y no están vacías.

## Comprobaciones que requieren producción o revisión editorial

- Probar en Hostinger una generación con IA y un OCR de un examen real (con consentimiento y una cuenta de ensayo). Las pruebas locales comprueban formatos, errores y reintentos, pero no las credenciales ni los límites efectivos del proveedor en producción.
- Revisar manualmente la precisión de las unidades de ESO generadas desde plantillas y convertir las más consultadas en lecciones redactadas específicamente. La estructura y las preguntas funcionan; una prueba automática no puede confirmar su calidad pedagógica.
- La extracción del código de los dos HTML grandes a módulos sigue siendo una mejora de mantenimiento, no una corrección funcional necesaria para esta entrega.

## Correcciones prioritarias

| Prioridad | App | Hallazgo comprobado | Acción recomendada |
| --- | --- | --- | --- |
| Alta | ESO Adultos | `saveState()` encadena peticiones, pero devuelve `false` al fallar sin mostrarlo. Guardar apuntes y generarlos con IA puede mostrar «guardados» antes de confirmar el POST. | Añadir estado visible «Guardando / Guardado / Sin guardar», reintento y aviso al salir. Confirmar el guardado antes de anunciar éxito. |
| Alta | ESO Adultos | `/api/state` no usa revisión ni `If-Match` para esta app. Dos pestañas de la misma cuenta pueden sobrescribir el progreso de la otra. | Aplicar control de versiones o revisión, como ya existe en Profesor Particular, y ofrecer recuperación del conflicto. |
| Alta | Profesor Particular | Las pruebas de navegador de inicio, catálogo avanzado y juegos usan etiquetas o selectores anteriores y fallan antes de probar el flujo. | Actualizar las pruebas a la UI actual y mantener un recorrido completo de material → juego → sesión → respuesta. |
| Media | Ambas | Las últimas interacciones han mostrado repetidamente recortes y barras de scroll en juegos y vistas previas. Las pruebas actuales cubren lógica mejor que tamaños reales de pantalla. | Añadir comprobaciones visuales en móvil, portátil y escritorio para todos los tipos de juego; comprobar panel, controles, solución y scroll. |
| Media | Profesor Particular | El filtro de cursos y asignaturas permite materiales sin metadatos de curso o asignatura (`allowsCourse('')` y `allows('')` devuelven `true`). Esto deja visibles recursos genéricos incluso con una selección estricta. | Definir si los recursos sin metadatos son «Generales» y etiquetarlos, o completar su curso/asignatura antes de filtrar. Probar ambos casos. |
| Media | ESO Adultos | El flujo de corrección con imagen incluye vista previa, revisión del OCR e inserción, pero la prueba con una fotografía real y una corrección real sigue pendiente. | Probar JPG/PNG/WEBP, texto manuscrito y varias páginas con una cuenta de ensayo; verificar créditos, errores y guardado. |
| Media | Ambas | La conexión real con IA no quedó validada en este entorno (Groq respondió 403). | Hacer una prueba controlada en Hostinger para apuntes, corrección de examen y generación de material; registrar proveedor, respuesta, coste y mensaje de error sin datos personales. |

## Mejoras de producto y operación

| Prioridad | App | Oportunidad | Propuesta concreta |
| --- | --- | --- | --- |
| Media | Profesor Particular | Las piezas avanzadas tienen muchas variantes visuales y mecánicas. | Revisar cada juego con una ficha de aceptación: propósito, interacción, feedback, teclado/táctil, tamaño mínimo y captura real. Retirar el sello «destacado» de los que no pasen la revisión. |
| Media | ESO Adultos | Las lecciones usan contenido específico en algunas unidades y puntos genéricos en otras. | Priorizar las unidades de mayor uso y sustituir contenido genérico por ejemplos y preguntas redactados para cada tema. |
| Baja | Profesor Particular | La landing dice que los materiales son gratis, pero la FAQ dice que Premium incluye el temario completo y recursos avanzados. | Unificar la explicación pública con los permisos reales: qué es gratis, qué requiere Premium y qué límite tiene la IA. |
| Baja | Operación | `infra/HOSTINGER_UPDATE.md` aún afirma que el alta nueva es Premium por defecto; el código actual usa `PROFESOR_FREE`. | Actualizar el runbook y añadir una comprobación del plan de altas tras desplegar. |
| Baja | Ambas | `apps/profesor/index.html` y `apps/e25/index.html` concentran mucho código (aprox. 374 y 609 KB). | Extraer progresivamente estado, juegos y vistas a módulos sin cambiar la experiencia. Facilitará pruebas y evitará regresiones en cambios pequeños. |

## Orden recomendado

1. **Confianza del usuario:** guardado visible y control de conflictos en ESO Adultos; prueba real de IA y OCR.
2. **Calidad del juego:** renovar las pruebas de Profesor Particular y revisar visualmente todos los juegos en tres tamaños.
3. **Claridad comercial:** filtros de catálogo con metadatos, contenido específico y mensajes públicos coherentes con los planes actuales.

## Puntos que ya están bien encaminados

Profesor Particular ya incluye revisión de estado con `ETag`, aviso de guardado fallido y copias durante el despliegue. ESO Adultos ya tiene preguntas autocorregibles por tema, tres modalidades de juego y revisión del texto reconocido antes de añadirlo a un examen. Conviene conservar estos comportamientos al corregir lo anterior.
