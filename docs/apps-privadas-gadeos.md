# Apps privadas y GADEOS

## Uso

1. Actualiza Hostinger con el procedimiento habitual y abre LA TERRAZA → Apps.
2. Pulsa **Crear aplicación** o, en GADEOS, **Editar contenido**. Si hace falta conectar, el propio botón abre el acceso de administración y continúa la acción elegida al entrar. Esta sesión autoriza la edición del contenido en el servidor; no añade formularios de usuarios en LA TERRAZA. La conexión de Codex se indica por separado. La sesión administrativa se guarda cifrada en el almacén local durante su vigencia de treinta minutos y se conserva al reiniciar; la contraseña no se guarda y no se envía a los agentes.
3. **Crear aplicación** pide nombre e identificador y crea un espacio privado en `/a/{identificador}` con cuentas y notas guardadas. **Gestionar usuarios** abre su ficha en el dashboard online, donde están las cuentas y los estados Pública/Privada/Pausada. Pública habilita las altas en ese espacio; Privada las reserva a administración; Pausada cierra su uso conservando todos los datos. Las apps anteriores mantienen su propio sistema de cuentas y licencias.
4. App, Landing y Redes sociales abren conversaciones independientes que utilizan la misma cola y publicación automática. El código de una adaptación puede añadirse bajo `apps/custom/{identificador}/index.html`, con recursos servidos desde `/private-app-assets/custom/{identificador}/`.

## Preparar GADEOS

En el **dashboard online → GADEOS → Nuevo usuario**, crea un tributo con su nombre y contraseña inicial. No necesita correo ni una licencia de otra app. Desde **Editar usuario** puedes cambiar el nombre, restablecer la contraseña o desactivar la cuenta. Cambiar la contraseña o desactivarla revoca las sesiones anteriores y conserva el avance. La ficha muestra las etapas completadas. GADEOS y las nuevas apps del catálogo aparecen en el menú; cada una consulta y guarda sus propias cuentas. El enlace directo de GADEOS es `/admin-dashboard/#app/gadeos` y conserva la selección al recargar. La configuración de IA y las licencias de las apps educativas siguen en el dashboard habitual.

En **LA TERRAZA → Apps → GADEOS → Editar contenido → Editar recorrido y cartas** puedes cambiar el día, lugar y horas del planning, las nueve pruebas y los textos de la batalla. Cada prueba tiene solo dos campos: **Título / pista** y **Respuesta correcta**. Las cartas y sus imágenes se conservan en el desplegable **Cartas de recompensa**, separado de las pruebas. Todas las pruebas son editables. No hay selector de mecánicas: cada etapa pide una respuesta escrita. La comparación ignora mayúsculas, tildes y espacios repetidos. La app comprueba la respuesta, no la ubicación física del tributo.

Las configuraciones antiguas se adaptan al leerlas: una elección conserva su solución; ordenar y parejas pasan a la pregunta predeterminada de esa etapa. El reto original se conserva en `legacy_challenge`, solo para administración, también al guardar. Las alternativas antiguas con `|` conservan su primera respuesta y archivan el resto. No se alteran cuentas, revisiones de progreso, estaciones completadas ni cartas ganadas. El progreso público no expone soluciones ni los retos archivados.

La aventura abre directamente en `/juegos-del-hambre-chinchon`, sin landing ni registro. La persona introduce nombre de tributo y contraseña. Hay cuatro secciones: Inicio muestra el planning del viernes; Recorrido muestra nueve botones numerados sobre el camino ilustrado; al tocar uno se abre su pregunta en un popup, con desbloqueo progresivo; Batalla final conserva atacar, defender, concentrar y utilizar cartas. Acertar guarda la carta de batalla antes de mostrar únicamente dos sobres animados, sin textos, cartas ni botones. La celebración se cierra tocando la pantalla o con Intro/Escape; recargar no duplica ni pierde la recompensa. Las etapas completadas abren su pregunta y permiten volver a ver los dos sobres sin modificar el progreso. La pareja de sobres es visual y no cambia las reglas de la batalla. Una derrota conserva la colección; ganar guarda la victoria. Las cuentas tienen progresos independientes. Restaurantes añade el mapa de calles y la selección de locales del viaje; es independiente del juego.

### Cartel y guía originales

Después de actualizar Hostinger, en **Editar contenido → Imágenes → Aplicar imágenes**, LA TERRAZA importa el paquete preparado en este equipo. También puedes subir tu propio cartel de Inicio, imagen de Recorrido o diseño del sobre y pulsar **Guardar imágenes**, sin preparar un paquete. La imagen de cada carta se cambia en su etapa. El cartel se integra en Inicio después de entrar, la portada azul inspira Recorrido y la imagen de sobre aparece al conseguir cada etapa. Las páginas de los PDF se conservan en el paquete privado, sin añadir secciones a la app. La batalla digital conserva sus reglas actuales. Las horas impresas en un cartel no cambian al editar el planning: sustituye también el cartel si necesitas actualizarlas.

El manifiesto admite `envelope`, una imagen WebP opcional. El servidor valida su ruta privada y exige autenticación para verla. El importador conserva el resto del material y rechaza aplicar un sobre a una versión antigua del backend que todavía no admite ese campo. Actualizar el código en Git no copia imágenes personales al VPS: se importan desde la sesión administrativa de LA TERRAZA.

Los materiales preparados están en `.educame-agents/private-materials/gadeos/`, fuera de Git y del contexto Docker. El manifiesto local contiene el cartel y las páginas WebP extraídas de los PDF. Solo se envían al servidor después de entrar en Administración y pulsar Aplicar. El recibo de cada subida se guarda en SQLite para recuperar una interrupción. Una revisión de campaña antigua se rechaza; al reintentar se conserva la edición reciente. Repetir una importación ya aplicada no vuelve a modificar la campaña. Las páginas y el cartel solo se sirven a tributos autenticados y a administración, sin caché pública. Editar pruebas desde una versión anterior del editor conserva estos materiales.

## Datos y despliegue

- El catálogo y la campaña se guardan en `app_settings`, con revisión para rechazar escrituras antiguas.
- La migración `0027_private_apps` añade cuentas, sesiones y progreso separados de los usuarios existentes; no cambia contraseñas, licencias ni escritorios anteriores.
- Las contraseñas se guardan con bcrypt y las sesiones con tokens opacos cuyo hash se conserva en la base. Cookies HttpOnly, SameSite y comprobación de origen protegen las escrituras.
- Las imágenes se convierten a WebP sin metadatos y se conservan en el volumen de documentos, incluidas en las copias existentes. Solo administración o una cuenta que haya desbloqueado la carta puede leerlas. No se añaden fotos privadas al repositorio.
- Una petición repetida recupera su resultado; una revisión antigua no pisa progreso reciente. El editor de campaña conserva estaciones y cartas obtenidas.
- Las apps privadas salen del sitemap y de las tarjetas de la portada. El comprobador de despliegue distingue el cierre privado declarado de un error HTTP real; no convierte un 503 inesperado en éxito.

## Comprobaciones

`backend/tests/test_private_apps.py` cubre accesos, estados, cuentas, planning, progresos, estaciones, batalla, imágenes y migración con datos ficticios. `tests/gadeos-browser.test.cjs` recorre la app completa contra una API real de ensayo en Chromium y WebKit móvil. `tests/admin-private-apps-browser.test.cjs` crea y edita tributos desde el dashboard, prueba contraseñas, desactivación, revisión antigua y cuentas aisladas entre apps contra la API real de ensayo. `tests/educame-app-catalog-browser.test.cjs` comprueba el catálogo, subchats y edición de contenido de LA TERRAZA con un servidor administrativo simulado.

Si un encargo antiguo se termina desde el repositorio, se registra su revisión GitHub en `jobs[id].externalCompletion` **después de verificarla en origin/main**. Se conserva el fallo y la copia original; la cola muestra la resolución real y no vuelve a publicar esa copia incompleta. Este recibo no afirma que Hostinger esté actualizado.

Al actualizar un recorrido de ocho pruebas se añade la novena sin borrar las ocho anteriores, sus respuestas, las cartas, las victorias ni el progreso. El título y la antigua pregunta se reúnen en un único título/pista sin perder texto. La batalla requiere completar las nueve; un editor antiguo con ocho pruebas se rechaza para que no pueda borrar la nueva. Antes de actualizar Hostinger, LA TERRAZA muestra el aviso correspondiente y conserva la edición del servidor. Las ilustraciones genéricas nuevas son públicas; los materiales personales siguen protegidos. Véase [diseño y prompts](gadeos-visual-v2.md).

## Nombre secreto y dirección pública

La entrada y la cabecera muestran el título gráfico **JUEGOS DEL HAMBRE EN CHINCHÓN**. `/gadeos` y `/a/gadeos` redirigen a `/juegos-del-hambre-chinchon`; la sesión, las cuentas y el progreso conservan sus identificadores internos. El jugador utiliza `/api/arena-chinchon` y `/aventura-chinchon-assets`, sin el nombre secreto en las direcciones visibles.

Antes de superar una prueba cuya respuesta correcta es GADEOS, se muestran sobres y caras genéricas sin ese logotipo. Las imágenes personales permanecen guardadas y se recuperan al descubrir el nombre; las cartas siguen perteneciendo a quien las consiguió. El descubrimiento se guarda en el progreso y una edición posterior no lo revoca. Los enlaces y API internos anteriores siguen disponibles para compatibilidad y administración. Las pruebas `test_chinchon.py` comprueban las redirecciones, autenticación, pausas, imágenes y descubrimiento.


### Planning por días y restaurantes · 18-11-2026

Inicio muestra viernes 20 (cuatro entradas, una bloqueada) y sábado 21 (bloqueado), con el autobús 337 desde Pavones, siguiendo la última corrección del propietario. En LA TERRAZA → Editar recorrido y cartas → Planning por días se editan transporte, nombre de cada día, descripción, horarios y actividades; se pueden añadir y quitar días y actividades. El servidor conserva el planning cuando guarda un editor anterior, valida los horarios y rechaza revisiones antiguas. Cambiar el planning nunca completa una prueba ni cambia las cartas.

Restaurantes es la cuarta pestaña. Mapa local de calles con Leaflet 1.9.4 y datos de OpenStreetMap, marcadores geográficos, grupos ampliables para los locales muy cercanos, búsqueda visual por cena/desayuno/comida/cuevas y enlace a Google Maps por local. La base del mapa se sirve desde la app; no requiere clave ni peticiones de mapas a terceros. Las puntuaciones son una instantánea de las fuentes, no una conexión a Google Places. Véase [fuentes, posiciones y licencias](chinchon-viaje-restaurantes.md). Los precios vienen de la guía del propietario. Viña Bayona está en Titulcia y queda fuera del mapa del centro.


### Corrección del viernes y contenido bloqueado

La versión 2 del planning fija el viernes en 18:00 llegada a Chinchón y mochilas, una actividad BLOQUEADA, 21:00 llegada al piso y 22:00 batallas finales. El sábado queda bloqueado por completo. LA TERRAZA añade «Bloquear este día» y «Bloquear actividad». El contenido privado se conserva para editarlo, pero la API del jugador omite los horarios y textos de la actividad bloqueada y todas las actividades y subtítulo del día bloqueado. No se revela al progresar por las pruebas.

La actualización convierte el planning anterior de viernes 20 y sábado 21 a esta versión, conservando las actividades privadas del sábado. Un editor antiguo sin días conserva el planning nuevo; uno que intente reemplazar los días sin conocer la versión recibe un aviso de recarga. Las ediciones posteriores realizadas con la versión 2 se respetan.
