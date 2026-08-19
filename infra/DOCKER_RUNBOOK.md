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

## Servidor Oracle por IP publica

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
