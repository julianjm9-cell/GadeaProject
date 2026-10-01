# Actualizar la suite en Hostinger

Desde la carpeta donde está instalado este repositorio en el VPS, con Docker Compose v2 y la configuración `.env` existente:

```bash
git pull --ff-only origin main && bash infra/deploy-hostinger.sh
```

Si prefieres subir el ZIP de entrega, descomprímelo **dentro de la carpeta de la instalación existente** (por ejemplo, `/opt/educa-suite`), conservando el `.env` y los volúmenes Docker, y ejecuta `bash infra/deploy-hostinger.sh`. El ZIP no contiene `.env`, contraseñas ni datos de usuarios. No descomprimas el paquete en una subcarpeta anidada dentro de `educa-suite`.

El script construye primero la imagen, espera a PostgreSQL, guarda una copia verificada de la base de datos y del `.env` en `backups/`, ejecuta las migraciones, actualiza los contenedores y comprueba las rutas públicas, el acceso privado, el dashboard y la configuración de Caddy. Un error detiene el proceso: no continúa con los pasos siguientes ni anuncia éxito.

No ejecuta `bootstrap`, no cambia contraseñas, no elimina volúmenes y no sobrescribe `.env`. Los usuarios, licencias y contenidos existentes se conservan. Las claves de IA y OAuth siguen siendo las configuradas en el servidor. Este es un procedimiento de actualización, no de instalación inicial.

Los documentos se conservan en el volumen `educa_suite_documents`. Si el backend está en marcha, el script también guarda sus documentos en `documents.tar`; al incorporar por primera vez un volumen vacío, recupera ahí los archivos existentes antes de actualizar el contenedor.

Profesor Particular queda disponible en `/profesor`, `/profesor/login`, `/profesor/demo` y `/profesor-particular`. El dashboard sigue en `/admin-dashboard/`. La imagen incluye el código de la app, su landing y la captura de presentación; el dashboard usa el directorio `admin/` del repositorio.

El registro inicial utiliza 365 días y 100 créditos por defecto. Opcionalmente configura en `.env` `PROFESOR_SIGNUP_ENABLED`, `PROFESOR_SIGNUP_DAYS` y `PROFESOR_SIGNUP_CREDITS`. Los accesos existentes no se renuevan ni se recargan al iniciar sesión.

Si Git informa de cambios locales o divergencia, no uses `reset --hard`: revisa esos cambios antes de actualizar. Si falla Docker, consulta `docker compose logs --tail=80 backend reverse-proxy`. Una migración fallida requiere revisar el error antes de repetir; no se restaura automáticamente una copia sobre la base de datos activa.

Las comprobaciones del script se ejecutan dentro de la red Docker. Tras completarlo, abre la portada y `/profesor/login` usando el dominio o la IP habituales para confirmar también el acceso público, DNS y HTTPS.
