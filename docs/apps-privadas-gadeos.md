# Apps privadas y GADEOS

## Uso

1. Actualiza Hostinger con el procedimiento habitual y abre LA TERRAZA → Apps.
2. Si aparece **Conectar administración**, entra con tu cuenta de administrador. La sesión se guarda en el almacén local de conexiones; no se envía a los agentes.
3. **Crear aplicación** pide nombre e identificador y crea un espacio privado en `/a/{identificador}` con cuentas y notas guardadas. Pública habilita las altas en ese espacio; Privada las reserva a administración; Pausada cierra su uso conservando todos los datos. Las apps anteriores mantienen su propio sistema de cuentas y licencias.
4. App, Landing y Redes sociales abren conversaciones independientes que utilizan la misma cola y publicación automática. El código de una adaptación puede añadirse bajo `apps/custom/{identificador}/index.html`, con recursos servidos desde `/private-app-assets/custom/{identificador}/`.

## Preparar GADEOS

En Apps → GADEOS → **Tributos y recorrido**, crea un tributo con su contraseña inicial. Puedes cambiar el nombre, restablecer la contraseña o desactivar la cuenta. Cambiar la contraseña o desactivarla revoca las sesiones anteriores y conserva el avance.

**Editar recorrido y cartas** permite personalizar textos, respuestas, pistas e imágenes de los ocho sobres. Las estaciones 7 y 8 están preparadas para que escribas vuestras pruebas. La adivinanza también es editable. Hay cuatro mecánicas: código/adivinanza, elección, orden y parejas. En código puedes aceptar alternativas separadas con `|`. Pon en los sobres físicos las claves elegidas para cada parada; la app comprueba esas claves, no la ubicación física del tributo.

GADEOS abre directamente en `/gadeos`, sin landing ni registro. La persona introduce nombre de tributo y contraseña. Cada estación superada entrega su carta y abre la siguiente. Tras ocho estaciones, la batalla permite atacar, defender, concentrar y utilizar las cartas. Una derrota conserva la colección; ganar guarda la victoria. Las cuentas tienen progresos independientes.

### Cartel y guía originales

En **Tributos y recorrido → Cartel y guía → Aplicar cartel y guía**, LA TERRAZA importa el paquete preparado en este equipo. El cartel se integra en Inicio después de entrar y **Guía** abre las páginas originales, con ampliación, navegación y lectura en texto. La guía de las cartas físicas se presenta junto a la ayuda de la aventura; la batalla digital conserva sus reglas actuales.

Los materiales preparados están en `.educame-agents/private-materials/gadeos/`, fuera de Git y del contexto Docker. El manifiesto local contiene el cartel y las páginas WebP extraídas de los PDF. Solo se envían al servidor después de entrar en Administración y pulsar Aplicar. El recibo de cada subida se guarda en SQLite para recuperar una interrupción. Una revisión de campaña antigua se rechaza; al reintentar se conserva la edición reciente. Repetir una importación ya aplicada no vuelve a modificar la campaña. Las páginas y el cartel solo se sirven a tributos autenticados y a administración, sin caché pública. Editar pruebas desde una versión anterior del editor conserva estos materiales.

## Datos y despliegue

- El catálogo y la campaña se guardan en `app_settings`, con revisión para rechazar escrituras antiguas.
- La migración `0027_private_apps` añade cuentas, sesiones y progreso separados de los usuarios existentes; no cambia contraseñas, licencias ni escritorios anteriores.
- Las contraseñas se guardan con bcrypt y las sesiones con tokens opacos cuyo hash se conserva en la base. Cookies HttpOnly, SameSite y comprobación de origen protegen las escrituras.
- Las imágenes se convierten a WebP sin metadatos y se conservan en el volumen de documentos, incluidas en las copias existentes. Solo administración o una cuenta que haya desbloqueado la carta puede leerlas. No se añaden fotos privadas al repositorio.
- Una petición repetida recupera su resultado; una revisión antigua no pisa progreso reciente. El editor de campaña conserva estaciones y cartas obtenidas.
- Las apps privadas salen del sitemap y de las tarjetas de la portada. El comprobador de despliegue distingue el cierre privado declarado de un error HTTP real; no convierte un 503 inesperado en éxito.

## Comprobaciones

`backend/tests/test_private_apps.py` cubre accesos, estados, cuentas, progresos, estaciones, batalla, imágenes y migración con datos ficticios. `tests/gadeos-browser.test.cjs` recorre la app completa contra una API real de ensayo en Chromium y WebKit móvil. `tests/educame-app-catalog-browser.test.cjs` comprueba el catálogo y los subchats usando un servidor administrativo simulado.

Si un encargo antiguo se termina desde el repositorio, se registra su revisión GitHub en `jobs[id].externalCompletion` **después de verificarla en origin/main**. Se conserva el fallo y la copia original; la cola muestra la resolución real y no vuelve a publicar esa copia incompleta. Este recibo no afirma que Hostinger esté actualizado.
