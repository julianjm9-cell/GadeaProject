# Planning y restaurantes de Chinchón

Consulta de fuentes: **18 de noviembre de 2026**. Las dos imágenes del propietario definen el planning y los intervalos de precio; no se copian los originales personales a Git. El viaje se divide en viernes 20 y sábado 21. La última corrección del propietario sustituye el viernes por una actividad BLOQUEADA, 21:00 llegada al refugio y 22:00 batallas finales. Todo el sábado queda BLOQUEADO; su contenido se conserva solo en administración hasta que el propietario lo muestre desde LA TERRAZA. El planning no representa horarios de apertura confirmados ni controla las nueve pruebas.

## Lugares y puntuaciones

Las cifras son puntuaciones de Google reproducidas por las fuentes enlazadas, consultadas en esta fecha. No se usa una API de Google Places ni se promete actualización en directo. La estrella enlaza a la fuente; Google Maps abre la búsqueda del nombre y dirección. No confundir la nota propia de un agregador con su apartado de Google. Cuando hay divergencia entre el texto introductorio y el bloque de valoraciones, se usa el bloque que identifica Google.

| Local | Puntuación /5 y fuente | Coordenadas del marcador y procedencia |
| --- | --- | --- |
| La Repesca, Plaza Mayor 27 | [4,3 · GastroRank](https://gastrorank.es/es/restaurante/ver/mediterrania/chinchon-restaurante-la-repesca) | 40.140176, -3.422106 · GeoCoordinates de la misma ficha |
| La Señora Winebar | [4,5 · Restaurant Guru](https://es.restaurantguru.com/La-Senora-Winebar-Chinchon) | [40.1405294, -3.4203115 · MyMenuWeb](https://mymenuweb.com/es/restaurants/439509/) |
| La Casa del Pregonero | [4,4 · Restaurant Guru](https://es.restaurantguru.com/amp/La-Casa-del-Pregonero-Chinchon) | [40.1400722, -3.4229376 · OSM](https://www.openstreetmap.org/node/13249570476) |
| Tomeguín & Colibrí | [4,7 · Restaurant Guru](https://es.restaurantguru.com/Tomeguin-and-Colibri-Specialty-Coffee-Shop-Chinchon) | [40.1397222, -3.4232529 · OSM](https://www.openstreetmap.org/node/13249570470) |
| La Tahona del Iberia | [4,6 · Restaurant Guru](https://es.restaurantguru.com/La-Tahona-del-Iberia-Chinchon) | [40.1404588, -3.4225534 · OSM](https://www.openstreetmap.org/node/13249570482) |
| Lima Limón | [4,7 · Restaurant Guru](https://restaurantguru.com/Lima-limon-Chinchon) | [40.1403828, -3.4218076 · OSM](https://www.openstreetmap.org/node/13249570456) |
| La Balconada | [4,3 · Restaurant Guru](https://es.restaurantguru.com/La-Balconada-Chinchon) | [40.140396, -3.4227621 · OSM](https://www.openstreetmap.org/node/4756740888) |
| El Convento · Parador de Chinchón | [4,5 · Restaurant Guru](https://es.restaurantguru.com/pastry-Chinchon-m32) | [40.1395246, -3.4234014 · punto del Parador en OSM](https://www.openstreetmap.org/node/5452316666). [Identidad del restaurante](https://paradores.es/es/restaurante-el-convento-parador-de-chinchon) |
| Café de la Iberia | [4,3 · Restaurant Guru](https://es.restaurantguru.com/Cafe-de-la-Iberia-Chinchon) | [40.1404698, -3.4224624 · OSM](https://www.openstreetmap.org/node/4756739521) |
| Mesón Cuevas del Vino | [4,1 · Restaurant Guru](https://es.restaurantguru.com/Meson-El-Duende-Chinchon-2) | [40.1406473, -3.4173394 · enlace de llegada de su web oficial](https://www.cuevasdelvino.com/informacion/). Se usa la entrada indicada por el negocio, no el centro del mapa incrustado. |
| Mesón Quiñones | [4,3 · pos.do](https://pos.do/es/chinchon/restaurante/meson-de-quinones) | [40.1412594, -3.42072 · OSM](https://www.openstreetmap.org/node/4756756529) |
| Bodega Viña Bayona | [4,6 · Espacio Vinos Web](https://espaciovinosweb.com/bodegas/madrid/titulcia/bodega-vina-bayona/) | **Fuera del mapa del centro**. [Su web oficial sitúa la bodega en Calle Grande 28, Titulcia](https://vinabayona.com/), corrigiendo el municipio de la imagen del propietario. |

## Mapa y licencias

- **Nuestro refugio:** Plaza Mayor 36, Chinchón, marcado con un icono de casa distinto de los restaurantes. Se muestra en todos los filtros y abre el [lugar facilitado por el propietario en Google Maps](https://www.google.com/maps/place//data=!4m2!3m1!1s0xd4213cc52af36cd:0x47efcf9bc8a0045b). Coordenadas **40.1398503, -3.4224314** del [portal 36 en OpenStreetMap](https://www.openstreetmap.org/node/13249626732); la dirección coincide con la [ficha municipal de alojamientos](https://ciudad-chinchon.com/turismo/conoce-chinchon/donde-dormir.php). En la app aparece «Nuestro refugio», sin revelar el nombre privado del alojamiento.
- Leaflet **1.9.4**, distribuido localmente con su [licencia BSD de dos cláusulas](../apps/gadeos/leaflet-LICENSE.txt). Fuente de los archivos: paquete publicado `leaflet@1.9.4`, `dist/leaflet.js` y `dist/leaflet.css`.
- Plano derivado de [OpenStreetMap](https://www.openstreetmap.org/copyright), licencia [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Atribución visible en el mapa. Calles y edificios proceden de la API pública OSM, exportación del 18-11-2026: `/api/0.6/map?bbox=-3.427,40.137,-3.4155,40.1435`.
- Reproducción: `python scripts/build-chinchon-map.py export.osm`. Salida: `apps/gadeos/town-map.svg`. Los límites se comparten con la proyección de `restaurants.js`; no mover los marcadores individuales a posiciones decorativas. Los grupos de locales pueden desplazarse unos píxeles para no tapar el refugio; al ampliar, cada punto individual conserva su coordenada.
- No se reutilizan fotografías de restaurantes ni capturas de Google Maps. Se sirven la base vectorial y los iconos locales, con enlaces externos explícitos. La vista de mapas funciona aunque no haya conexión a un proveedor cartográfico; los enlaces externos requieren internet.

## Comprobación

El recorrido del juego reutiliza esta geometría con una paleta nocturna y un encuadre en el casco histórico. Los puntos corresponden al [refugio](https://www.openstreetmap.org/node/13249626732), la [torre](https://www.openstreetmap.org/way/1144478502), la [iglesia](https://www.openstreetmap.org/way/1144478506), la [taberna](https://www.openstreetmap.org/node/13249570475), el [teatro](https://www.openstreetmap.org/way/1144478512) y el [ayuntamiento](https://www.openstreetmap.org/way/446651301). Cada número desplazado se une con una línea a su punto real. La subsección solo se muestra al completar las dos pruebas del autobús y permite arrastrar, ampliar, alejar y centrar el mapa.

Con datos ficticios: guardar planning por días desde LA TERRAZA, recargar, conservarlo al guardar con un editor anterior, rechazar revisión antigua y horario inválido. En Chromium y WebKit móvil: viernes con cuatro entradas y sábado oculto, cuatro pestañas, mapa de restaurantes cargado, refugio visible con todos los filtros, selección del local, enlace a Google Maps, recarga y partida de diez pruebas con recorrido libre tras el autobús.
