# Docker runbook

## Desarrollo local

```powershell
Copy-Item .env.example .env
notepad .env
docker compose up -d --build postgres backend admin
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.bootstrap
```

URLs:

- Backend y apps privadas: `http://127.0.0.1:8890`
- Dashboard admin directo: `http://127.0.0.1:5174`

## Servidor por IP publica, Hostinger incluido

```bash
cp .env.oracle-ip.example .env
nano .env
docker compose --profile proxy up -d --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.bootstrap
```

URLs:

- Landing inicial: `http://TU_IP_PUBLICA/`
- Dashboard admin: `http://TU_IP_PUBLICA/admin-dashboard/`
- Selector privado: `http://TU_IP_PUBLICA/apps`

En Hostinger, `TU_IP_PUBLICA` es la IPv4 que aparece en el panel del VPS. Para una primera prueba no necesitas dominio: usa `http://IP_DEL_SERVIDOR/`.
Cuando conectes dominio, cambia `SITE_ADDRESS=tu-dominio.com`, `COOKIE_SECURE=true`, `CORS_ORIGINS=https://tu-dominio.com` y `GOOGLE_REDIRECT_URI=https://tu-dominio.com/auth/google/callback`.

## Actualizar version

```bash
git pull
docker compose --profile proxy up -d --build
docker compose exec backend alembic upgrade head
docker compose ps
```

## Ver estado y logs

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f reverse-proxy
```

## Parar sin borrar datos

```bash
docker compose down
```

## Parar borrando base de datos

Solo para pruebas. Esto elimina el volumen de Postgres.

```bash
docker compose down -v
```
