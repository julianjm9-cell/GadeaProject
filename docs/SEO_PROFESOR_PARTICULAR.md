# Plan SEO de Profesor Particular

## Diagnóstico y objetivo

La aplicación de trabajo está detrás del acceso con Google y sus secciones usan navegación interna. Esa parte no es una base fiable para posicionar búsquedas de materiales, juegos o temario. La página pública `/profesor` y el tablón sí podían rastrearse, pero concentraban demasiadas intenciones de búsqueda en una sola URL. Las páginas antiguas todavía usaban la marca inicial en algunos títulos y textos.

El objetivo es que la búsqueda orgánica llegue a páginas públicas que expliquen funciones reales de Profesor Particular, con un camino claro hacia la aplicación. No se promete una posición concreta: Google decide qué páginas indexa, qué título y fragmento muestra y en qué consultas aparecen.

## Mapa de búsquedas a páginas

| Intención de búsqueda | Página principal | Contenido que la satisface |
| --- | --- | --- |
| Herramientas para clases particulares | `/profesor` | Visión general, alumnos, temario y materiales. |
| Materiales para clase, fichas y ejercicios | `/profesor/materiales-para-clases` | Crear, editar, guardar, filtrar y usar recursos. |
| Pasapalabra interactivo, sopa de letras, ahorcado | `/profesor/juegos-interactivos` | Juegos disponibles y pasos para prepararlos y usarlos. |
| Temario por curso y asignatura | `/profesor/temario-clases` | Niveles, asignaturas, explicación y práctica. |
| Clases de apoyo y refuerzo | `/profesor/clases-de-apoyo` | Organización de sesiones, tareas y seguimiento. |
| Buscar profesor particular | `/profesor/anuncios` | Tablón y filtros de anuncios. |
| Buscar alumnos, anunciar clases | `/profesor/anunciar` | Publicación gratuita del anuncio. |

Variantes como «materiales de 3.º ESO» o «clases de matemáticas» se cubren con contenido pertinente dentro de esas páginas. No conviene generar miles de combinaciones de curso, asignatura y ciudad sin contenido propio: serían páginas repetitivas y difíciles de mantener.

## Aplicado en el código

- Títulos, metadescripciones, URL canónicas, etiquetas de compartición y texto visible específicos para cada intención. El tablón y el formulario de publicación reciben metadatos distintos aunque compartan interfaz.
- Cuatro páginas públicas con contenido útil y enlaces entre sí, a la landing y al tablón. La landing enlaza a estas páginas.
- Sitemap actualizado con todas las páginas públicas nuevas. El escritorio privado emite `X-Robots-Tag: noindex, nofollow`.
- Retirada de la marca antigua del título de las condiciones y del texto principal del tablón; la marca pública de estas páginas es Profesor Particular.
- Datos estructurados `WebApplication` en la landing, sin valoraciones ni promesas inventadas.
- Comprobaciones de despliegue para las páginas nuevas y el sitemap.

## Después del despliegue

1. Verificar `https://educame.tech/profesor` y las seis páginas relacionadas en Google Search Console. Enviar `https://educame.tech/sitemap.xml` e inspeccionar las URL prioritarias para confirmar que son rastreables y canónicas.
2. Revisar cada mes en Search Console consultas, impresiones, clics, CTR e indexación por URL. Mejorar primero las páginas que obtengan impresiones pero pocos clics o que no respondan bien a la búsqueda.
3. Añadir ejemplos públicos reales y revisados: una ficha, un juego o un tema representativo con contenido visible sin iniciar sesión. Publicar guías por curso o materia solo cuando aporten un ejemplo, explicación y recursos propios; enlazarlas desde las páginas principales.
4. Obtener menciones y enlaces editoriales legítimos de recursos docentes pertinentes. Evitar intercambio masivo de enlaces, textos de palabras clave y anuncios de pago disfrazados de contenido orgánico.

## Límite de la marca en Google

Las metadescripciones son sugerencias: Google puede componer el fragmento con texto de la página según la consulta. Además, el nombre de sitio de Google se determina a nivel de dominio o subdominio, no para una carpeta como `/profesor`. Mientras `educame.tech` aloje varias aplicaciones bajo la marca inicial, las páginas de Profesor Particular pueden mostrar esa identidad de dominio en algunos formatos aunque sus títulos y contenido ya digan Profesor Particular. Para separar completamente el nombre de sitio haría falta estudiar un dominio o subdominio propio y sus redirecciones, lo cual es una decisión de producto y migración, no un cambio de una etiqueta meta.
