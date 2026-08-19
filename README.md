# Educa Suite

Suite SaaS multiapp para vender y administrar productos educativos con login, licencias, consumo IA, recursos oficiales centralizados, dashboard de negocio y despliegue Docker.

## Estructura final

- `backend/`: API central con FastAPI, PostgreSQL, SQLAlchemy, Alembic, JWT, usuarios, organizaciones, licencias, estado por usuario y auditoria.
- `apps/`: codigo fuente de cada app, separado por producto.
  - `apps/diplomator/index.html`: app DIPLOMATOR. En SaaS se sirve como `/app`.
  - `apps/cambridge/index.html`: app Cambridge Trainer. En SaaS se sirve como `/cambridge`.
  - `apps/u25/index.html`: app ACCESO UNIVERSIDAD +25. En SaaS se sirve como `/universidad-adultos`.
  - `apps/e25/index.html`: app ACCESO ESO ADULTOS. En SaaS se sirve como `/eso-adultos`.
- `admin/`: dashboard web estatico para usuarios, licencias, consumo, negocio, recursos, observabilidad e IA.
- `marketing/`: landings publicas, demos visuales y materiales comerciales.
- `infra/`: reverse proxy, backups y piezas de operacion.
- `legacy-desktop/`: codigo antiguo de escritorio y builds portables, separado del producto SaaS.
- `docker-compose.yml`: PostgreSQL, backend, admin y reverse proxy opcional.

## Base de datos

El MVP usa PostgreSQL. Los datos se separan por:

- `organizations`: cliente o empresa.
- `users`: usuario individual.
- `licenses`: licencia por organizacion/producto.
- `client_states`: estado de la app por `organization_id` y `user_id`.
- `usage_records`: consumo de IA.
- `audit_logs`: acciones administrativas.
- `documents`: metadatos de documentos por usuario.
- `app_settings`: claves, modelos y guia de estilo para generar temas.
- `backend/app/content/official_resources.json`: recursos oficiales editables desde admin.

El modo recomendado ya no depende de seleccionar una carpeta local.

## Preparar entorno

```powershell
Copy-Item .env.example .env
notepad .env
```

Cambia al menos:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `SUPERADMIN_EMAIL`
- `SUPERADMIN_PASSWORD`
- `OPENAI_API_KEY` o `GROQ_API_KEY`

## Arrancar servicios

```powershell
docker compose up --build -d postgres backend admin
```

API: `http://127.0.0.1:8890`
Dashboard: `http://127.0.0.1:5174`

## Subir a Oracle por IP publica

Para una primera prueba sin dominio usa la plantilla preparada:

```bash
cp .env.oracle-ip.example .env
docker compose --profile proxy up -d --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.bootstrap
```

Guia completa: `infra/ORACLE_IP_DEPLOY.md`.
Runbook Docker: `infra/DOCKER_RUNBOOK.md`.

Rutas publicas de venta:

- `/`: landing inicial con acceso a las cuatro apps.
- `/suite`: alias de la landing inicial.
- `/u25`: web publica de ACCESO UNIVERSIDAD +25.
- `/e25`: web publica de ACCESO ESO ADULTOS.
- `/diplomator`: web publica de DIPLOMATOR.
- `/cambridge-info`: web publica de CAMBRIDGE TRAINER.

Rutas privadas tras login:

- `/universidad-adultos`
- `/eso-adultos`
- `/app`
- `/cambridge`

## Ejecutar migraciones

```powershell
docker compose exec backend alembic upgrade head
```

## Crear o resetear superadministrador

```powershell
docker compose exec backend python -m app.bootstrap
```

## Flujo de prueba

1. Entra en `http://127.0.0.1:5174`.
2. Usa API base `http://127.0.0.1:8890`.
3. Inicia sesion con `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD`.
4. Crea una organizacion.
5. Crea un usuario con contrasena temporal.
6. Crea una licencia `active` vigente para esa organizacion.
7. Entra como cliente en `http://127.0.0.1:8890/login`.
8. Abre `/apps` y entra en la app licenciada: `/app`, `/cambridge`, `/universidad-adultos` o `/eso-adultos`.
9. Revisa consumo en el dashboard.
10. Ajusta la guia de estilo o analiza DOCX de ejemplo desde Admin > IA.

## Pruebas

```powershell
docker compose exec backend python -m pytest
```

Las pruebas cubren login requerido, contrasena incorrecta, usuario inactivo, organizacion suspendida, licencia suspendida/caducada, licencia activa, aislamiento de estado por usuario y por app, selector de productos y bloqueo de rutas admin para usuarios normales.

## Operacion

Backup manual de Postgres:

```powershell
.\infra\backups\backup-postgres.ps1
```

El dashboard incluye:

- Vista global por producto.
- Centro de negocio con MRR estimado, coste IA y margen.
- Editor de recursos oficiales para U25/E25.
- Observabilidad con logs, errores frontend y coste registrado.

## Pendientes para cerrar producto

- Google Drive desde Perfil: OAuth, tabla de integraciones, refresh token cifrado y subida real de documentos.
- Almacenamiento de documentos: ampliar `documents` con proveedor, `drive_file_id`, MIME, tamano y estado de sincronizacion.
- Revocacion de sesiones: tabla de sesiones/refresh tokens.
- Costes por modelo: afinar tarifas reales por proveedor/modelo.
- Produccion: dominio real, HTTPS, `COOKIE_SECURE=true`, CORS restringido y secretos fuertes.
