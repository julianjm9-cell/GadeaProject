# OCR de facturas en Educa Suite

Estado: 1 de octubre de 2026. Integración corregida para utilizar la interfaz y el backend originales de Aliot. Pendiente de desplegar y probar con el proveedor externo real.

## Lo que se sirve al usuario

`/facturas` muestra `apps/ocr/index.html`, que es copia literal de `C:/Users/julia/Desktop/PROCESADOR/aliot-suite.html` salvo la dirección interna de su API. Conserva pantallas, clientes/workspaces, cola, revisión, galería, proveedores, plantillas, entrenamiento y exportaciones de la app anterior. No se muestra la interfaz reducida de la primera integración.

El backend original también está copiado en `backend/app/ocr_engine/main.py` y `procesador_facturas.py`. La suite comprueba sesión y licencia OCR_FACTURAS y comunica las llamadas de la pantalla original al backend Aliot mediante `/facturas/legacy/api/...`. El servicio original escucha solo en 127.0.0.1, dentro del contenedor backend; no se expone un puerto nuevo.

## Inicio totalmente limpio

Cada usuario de la suite recibe su propia carpeta bajo el volumen existente: `documents/ocr/legacy/<organization_id>/<user_id>/`. La primera apertura crea config y `facturas` vacíos. La interfaz y los clientes nuevos pueden abrirse aunque todavía falte el modelo externo; solo se bloquea el procesamiento hasta configurarlo. No se copian clientes, facturas, Excel, proveedores, entrenamiento, copias ni otros datos de `C:/Users/julia/Desktop/PROCESADOR`. El código fuente copiado no contiene la `config.json` privada original.

Los usuarios de la suite se administran en la suite. Las rutas de gestión de acceso del Aliot antiguo están cerradas en la pasarela; las opciones de modelo y clave también se administran en la suite para impedir que una persona cambie el proveedor o exponga la clave común. El resto de la interfaz y sus rutas originales conservan su funcionamiento. Una cuenta no puede llegar a los datos de otra porque el proxy solo inicia su proceso y carpeta, identificados por los UUID que entrega la sesión validada.

## Configuración externa y despliegue

`OCR_PROVIDER`, `OCR_MODEL` y `OCR_API_KEY` en `.env` del servidor seleccionan el modelo con visión. Sin estas variables se puede usar la capacidad OCR del producto en Admin > IA y la clave de proveedor allí guardada. La clave del escritorio antiguo no se sube a Git ni al servidor de forma automática. El `.env` local de BUILD tiene valores locales e ignorados por Git; no modifica Hostinger.

Desplegar desde la terminal del VPS con:

```bash
cd /opt/educa-suite && git pull --ff-only && bash infra/deploy-hostinger.sh
```

El script hace copia de seguridad, construye backend, aplica la migración ya incluida en el repositorio y actualiza Docker. Después abrir `/ocr-facturas` y `/facturas`. La primera lista de clientes debe salir vacía. Dar licencia OCR_FACTURAS a una cuenta de prueba en Admin. Probar con una factura sintética autorizada, confirmar resultado y Excel, y luego verificar otra cuenta sin acceso a ese workspace.

## Límites y comprobaciones

La implementación inicia hasta tres procesos de Aliot por contenedor y termina los inactivos después de una hora. Es un límite para el VPS actual; medir memoria y concurrencia antes de ampliar las ventas. Cada subida exitosa registra un uso en la suite. La contabilidad monetaria aún no está calibrada por proveedor; las llamadas de IA no se han validado contra el servicio real desde este equipo debido a un fallo DNS. El código se ha comprobado localmente con un proveedor simulado, y se ha verificado que el HTML solo difiere en la URL interna.

La migración `0007_ocr_jobs` y el antiguo flujo `/api/ocr/jobs` siguen presentes por compatibilidad con posibles despliegues anteriores de la primera integración. `/facturas` ya no utiliza ese flujo. No borrar la tabla ni el volumen durante el despliegue; no contienen datos de PROCESADOR antiguo.
