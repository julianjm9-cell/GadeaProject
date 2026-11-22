# Contenido de las apps en LA TERRAZA

En **Contenido**, elige una app y Temario, Juegos, Interfaz o Landing. Busca una palabra del título, del enunciado o del texto. **Revisar contenido** en cada tarjeta de Apps abre ese mismo catálogo con el producto seleccionado.

Al abrir una pieza aparecen sus campos, como título, explicación, pregunta, opciones y respuesta correcta. El selector de respuesta muestra las opciones del juego. **Ver texto actual** permite comparar con el contenido del proyecto. Los borradores se guardan en la base local de LA TERRAZA, con una copia inmediata en el navegador para recuperar una recarga. Una revisión evita que dos pestañas sobrescriban sus borradores. Si cambia el archivo original, se debe reabrir y revisar la ficha.

**Aplicar correcciones** guarda un encargo en la misma cola habitual. La corrección se aplica exactamente en una copia Git aislada, se revisa con el motor elegido en Encargos y se comprueba. El revisor no puede cambiar otros valores ni archivos como parte de una corrección manual. Un fallo conserva la copia y aparece en Encargos. El recibo del envío se guarda antes de empezar; reenviar el mismo identificador retoma el mismo trabajo. Las diferencias de saltos de línea entre Windows y Git no alteran la identidad de la fuente.

**Mejorar esta pieza con un agente** permite pedir ampliaciones, nuevas actividades, cambios en mecánicas o reorganización. El encargo incluye la app, la ficha y el archivo de origen. Las mejoras abiertas y las correcciones manuales se envían por separado para que el revisor pueda conservar exactamente el texto corregido. Se utiliza el motor y modelo elegidos en Encargos; no se cambia de proveedor por dentro.

Las entregas válidas se integran y suben a GitHub mediante la cola automática. Se conserva el mecanismo habitual de Deshacer última subida. La publicación de contenido en Hostinger sigue en **Operación** y necesita un despliegue. El catálogo describe el proyecto local, no demuestra qué versión está funcionando en producción.

## Cobertura y origen

El catálogo lee archivos seguidos por Git, sin ejecutarlos, en las apps de Profesor Particular, ESO Adultos, Inglés, Diplomator, Universidad +25, Facturas y GADEOS, las nuevas apps en `apps/custom/` y las landings asociadas. Incluye el catálogo JSON de temario de Profesor Particular, los recursos oficiales y las plantillas de temario y juegos del servidor. Desglosa datos estáticos de JavaScript, JSON, HTML y Python. Conserva identificadores, rutas, contraseñas y propiedades técnicas fuera de los campos editables. Los errores al desglosar una plantilla se muestran y no se ocultan como contenido revisado.

Una pieza es un bloque de contenido del código, no necesariamente un tema completo. Un tema puede tener varias piezas, como teoría, ejemplos y preguntas. El contenido que se calcula con variables conserva su plantilla y se modifica mediante un encargo sobre esa ficha. Las imágenes, nuevas estructuras y reglas también se pueden solicitar al agente. El catálogo no entra en cuentas particulares ni extrae notas, partidas o material generado de sus bases privadas.

Las pruebas y el planning guardados de GADEOS se siguen editando en su editor conectado al servidor. Desde Contenido, al seleccionar GADEOS aparece **Editar planning y pruebas guardados**. Así se edita la configuración efectiva y no solo sus valores iniciales de código. Ese editor mantiene sus propias revisiones y comprobaciones administrativas.

## Funcionamiento local

Para instalar en otro equipo, ejecuta `npm ci` antes de abrir LA TERRAZA y conserva Python para desglosar sus plantillas. No hace falta un despliegue de Hostinger para abrir este editor local. Conserva `.educame-agents/` para recuperar borradores y recibos. Los nuevos módulos usan Acorn y parse5 para analizar código y HTML, y `ast` de Python para sus literales; no usan `eval`, no importan ni ejecutan el código de las apps al catalogarlo.

La API local rechaza orígenes ajenos. Solo acepta campos del catálogo, comprueba tipos, límites y opciones correctas y valida la revisión original antes de modificar una copia. Las cadenas nuevas se codifican como datos, incluyendo cierres de etiquetas `script`, comillas y Unicode.

## Comprobaciones

`npm.cmd test` incluye la extracción sin ejecución, el guardado tras reinicio, conflictos entre pestañas, reenvíos, fuentes antiguas, texto HTML, JSON, Python y Unicode. Una prueba completa usa un revisor simulado y un remoto Git temporal para verificar la corrección, los checks y la publicación sin modificar GitHub real. `tests/educame-content-browser.test.cjs` comprueba búsqueda, edición, respuesta correcta, recuperación y cola en Chromium y WebKit móvil. Estos ensayos no representan una llamada real al proveedor ni un despliegue en producción.
