# OCR de facturas — integración y despliegue

Estado: 1 de octubre de 2026. Primera versión funcional en código local; NO desplegada y NO validada todavía con el proveedor real.

## Lo implementado
- Tarjeta en portada y landing /ocr-facturas; interfaz privada /facturas.
- Acceso mediante sesión de la suite y licencia OCR_FACTURAS asignada desde administración. No se concede automáticamente por registro Google.
- Subida de un documento por trabajo: PDF sin contraseña hasta 10 páginas o imagen PNG/JPEG/WEBP hasta 25 megapíxeles; máximo 15 MB.
- Cola persistente en PostgreSQL, migración 0007_ocr_jobs. Máximo tres trabajos pendientes por usuario.
- Worker Docker independiente, sin puertos públicos, limitado a 1 CPU y 1 GB. Cada documento ejecuta el motor original en un subproceso con directorio propio. No arranca Ollama.
- Revisión editable, descarga del original y Excel con celdas de texto para evitar fórmulas inyectadas.
- Todas las operaciones de documentos validan organización Y usuario en el servidor, además de licencia activa.
- Los documentos y resultados se conservan en el volumen de documentos existente, incluido en las copias del despliegue.
- Un envío reserva un uso inmediatamente para impedir superar el cupo mediante solicitudes paralelas. Los errores también conservan el uso; la interfaz lo explica. Se registran tokens de trabajos completados. Los costes monetarios aún no están calibrados y no deben interpretarse como coste real cero.
- No se reejecutan automáticamente trabajos interrumpidos. Tras 20 minutos se marcan como error para evitar cargos duplicados. Tiempo máximo de proceso: 15 minutos.

## Carpetas y chats
- Suite y referencia principal: C:/Users/julia/Desktop/BUILD.
- Procesador original preservado: C:/Users/julia/Desktop/PROCESADOR.
- Motor incorporado: backend/app/ocr_engine/procesador_facturas.py, copia del original sin configuraciones ni datos privados.
- Adaptador de aislamiento: backend/app/services/ocr_runner.py.
- Coordinación: chat «Integrar la app en la suite». Otro chat activo de BUILD: «Añade la nueva app».
- Antes de modificar, leer el diff actual y este documento. Los chats no sincronizan automáticamente acuerdos. Los futuros cambios del motor deben trasladarse de forma explícita y probada; no copiar encima de los adaptadores.

## Configuración de IA
En el .env DEL SERVIDOR, definir OCR_PROVIDER, OCR_MODEL y OCR_API_KEY. El modelo debe admitir visión. Se aceptan gemini, openai, groq y anthropic según el protocolo ya implementado por el motor original.
No incorporar .env ni config.json a Git ni a la imagen. No trasladar configuraciones de clientes del escritorio.
Alternativamente, sin esas variables, configurar la capacidad OCR de OCR_FACTURAS en Admin > IA y una clave de proveedor. Las variables OCR_* tienen prioridad. No usar los campos de chat/audio de este producto: el procesador solo consume la capacidad OCR.
Se ha trasladado la configuración existente al .env local de BUILD, ignorado por Git. Esto NO cambia el .env remoto. La clave y disponibilidad del modelo siguen sin validarse por un fallo DNS al contactar con Google desde este equipo.

## Despliegue (pendiente)
1. Revisar y subir los cambios del repositorio BUILD, incluidos archivos nuevos.
2. Entrar al VPS y conservar su configuración actual. Configurar OCR_* en su .env sin mostrarlos en consola ni logs.
3. En /opt/educa-suite, ejecutar git pull --ff-only origin main y bash infra/deploy-hostinger.sh.
4. El script hace copias, construye backend y ocr-worker, aplica la migración y arranca los servicios. No ejecutar un compose up aislado sin aplicar primero las migraciones.
5. Comprobar docker compose ps y logs del worker; abrir /ocr-facturas y entrar en /facturas con una cuenta autorizada.
6. Probar una factura sintética con el proveedor real, comprobar importes y tokens, y después una factura propia autorizada.
7. Probar dos cuentas de organizaciones distintas y medir CPU/RAM/disco bajo carga. No se ha medido capacidad del VPS.

Bloqueo actual: el VPS responde por SSH, pero rechaza la autenticación de este equipo (publickey,password). Hace falta habilitar una clave SSH o una sesión autenticada. El permiso de acceso completo al equipo no proporciona credenciales remotas.
No hay Docker disponible en este equipo, por lo que no se ha construido la imagen localmente.

## Verificación realizada
- Pruebas de API: licencia específica, identidad, aislamiento entre clientes en listado/detalle/revisión/descarga/exportación, documentos inválidos, reserva de usos y cola acotada.
- Worker: éxito y timeout persistidos; proceso real del motor con proveedor simulado para imagen, PDF nativo y PDF escaneado multipágina.
- Migración: creación y eliminación de la tabla y relaciones en SQLite. Pendiente ejecución real PostgreSQL en despliegue.
- Navegador: subida y revisión con API simulada en escritorio y móvil.
- La batería general tiene un fallo preexistente de Diplomator, test_app_ai_models_are_isolated_and_used_by_requests, reproducido también en HEAD sin estos cambios.

## Alcance pendiente antes de vender como producto completo
- Validar proveedor real, calidad de extracción, precios y coste por factura; revisar política de consumo ante fallos.
- Migrar las funciones avanzadas de la interfaz antigua: proveedores, plantillas, entrenamiento, gestión de empresas, acciones por lotes y exportación conjunta. Esta primera interfaz cubre subida, extracción, revisión y Excel por factura; no sustituye todavía toda la app de escritorio.
- Conservación y borrado de documentos, monitorización, pruebas de carga y restauración real de copias.
- Revisar tratamiento de datos con el proveedor y políticas comerciales.
