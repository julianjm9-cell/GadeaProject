# OCR de facturas en Educa Suite

Estado: 1 de octubre de 2026. FACTURAS conserva la interfaz y el backend originales, con marca propia, landing y acceso. Pendiente de desplegar y probar con el proveedor externo real.

## Lo que se sirve al usuario

`/facturas` muestra `apps/ocr/index.html`, copiado de `C:/Users/julia/Desktop/PROCESADOR/aliot-suite.html` y adaptado en marca, icono y dirección interna de la API. Conserva pantallas, clientes/workspaces, cola, revisión, galería, proveedores, plantillas, entrenamiento y exportaciones de la app anterior. La landing está en `/ocr-facturas` y el login en `/facturas/login`.

El backend original también está copiado en `backend/app/ocr_engine/main.py` y `procesador_facturas.py`. La suite comprueba sesión y licencia OCR_FACTURAS y comunica las llamadas de la pantalla original al backend Aliot mediante `/facturas/legacy/api/...`. El servicio original escucha solo en 127.0.0.1, dentro del contenedor backend; no se expone un puerto nuevo.

## Inicio totalmente limpio

Cada usuario de la suite recibe su propia carpeta bajo el volumen existente: `documents/ocr/legacy/<organization_id>/<user_id>/`. La primera apertura crea config y `facturas` vacíos. La interfaz y los clientes nuevos pueden abrirse aunque todavía falte el modelo externo; solo se bloquea el procesamiento hasta configurarlo. No se copian clientes, facturas, Excel, proveedores, entrenamiento, copias ni otros datos de `C:/Users/julia/Desktop/PROCESADOR`. El código fuente copiado no contiene la `config.json` privada original.

Los usuarios de la suite se administran en la suite. Las rutas de gestión de acceso del producto anterior están cerradas en la pasarela. Cada cuenta puede ajustar su propio motor y clave desde «Modelos e IA»; la configuración central de la suite sirve como valor inicial hasta que esa cuenta guarde una configuración propia. La pasarela no devuelve claves completas al navegador ni permite cambiar rutas del servidor o URLs arbitrarias. Una cuenta no puede llegar a los datos de otra porque el proxy solo inicia su proceso y carpeta, identificados por los UUID de la sesión validada.

## Configuración externa y despliegue

`OCR_PROVIDER`, `OCR_MODEL` y `OCR_API_KEY` en `.env` del servidor seleccionan el modelo inicial con visión. Sin estas variables se puede usar la capacidad OCR del producto en Admin > IA y la clave de proveedor allí guardada. Un usuario con licencia puede después guardar un modelo y una clave propios desde FACTURAS. La clave del escritorio antiguo no se sube a Git ni al servidor de forma automática. El `.env` local de BUILD tiene valores locales e ignorados por Git; no modifica Hostinger.

Desplegar desde la terminal del VPS con:

```bash
cd /opt/educa-suite && git pull && docker compose --profile proxy up -d --build && docker compose ps
```

El comando reconstruye y reinicia los servicios de la suite. Después abrir `/ocr-facturas`, `/facturas/login` y `/facturas`. La primera lista de clientes debe salir vacía. Dar licencia OCR_FACTURAS a una cuenta de prueba en Admin. Probar selección de modelo, entrenamiento con una factura sintética autorizada, resultado, Excel y aislamiento de otra cuenta.

## Límites y comprobaciones

La implementación inicia hasta tres procesos por contenedor y termina los inactivos después de una hora. Es un límite para el VPS actual; medir memoria y concurrencia antes de ampliar las ventas. Cada subida exitosa registra un uso en la suite. La contabilidad monetaria aún no está calibrada por proveedor. Las llamadas a proveedores externos y un entrenamiento completo con factura real requieren una prueba en el VPS con una clave válida.

La migración `0007_ocr_jobs` y el antiguo flujo `/api/ocr/jobs` siguen presentes por compatibilidad con posibles despliegues anteriores de la primera integración. `/facturas` ya no utiliza ese flujo. No borrar la tabla ni el volumen durante el despliegue; no contienen datos de PROCESADOR antiguo.
