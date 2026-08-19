# Subida rapida a Oracle por IP publica

Esta guia es para probar la suite en una VM de Oracle sin dominio. Quedara asi:

- App/login: `http://TU_IP_PUBLICA/login`
- Selector de apps: `http://TU_IP_PUBLICA/apps`
- Landing inicial: `http://TU_IP_PUBLICA/`
- Web publica U25: `http://TU_IP_PUBLICA/u25`
- Web publica E25: `http://TU_IP_PUBLICA/e25`
- Web publica Diplomator: `http://TU_IP_PUBLICA/diplomator`
- Web publica Cambridge: `http://TU_IP_PUBLICA/cambridge-info`
- Dashboard admin: `http://TU_IP_PUBLICA/admin-dashboard/`
- API directa de comprobacion: `http://TU_IP_PUBLICA/health`

## 1. Preparar servidor

En la VM de Oracle abre el puerto `80` en la lista de seguridad de la VCN y en el firewall del sistema.

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

## 2. Subir y configurar

```bash
git clone TU_REPO_GIT educa-suite
cd educa-suite
cp .env.oracle-ip.example .env
nano .env
```

Cambia en `.env`:

- `TU_IP_PUBLICA`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `SUPERADMIN_EMAIL`
- `SUPERADMIN_PASSWORD`
- `GROQ_API_KEY` u `OPENAI_API_KEY`

## 3. Reconstruir y arrancar

```bash
docker compose --profile proxy up -d --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.bootstrap
docker compose ps
```

Entra en `http://TU_IP_PUBLICA/admin-dashboard/`, inicia sesion con el superadmin y crea usuarios/licencias.

## Comandos utiles

Ver logs:

```bash
docker compose logs -f backend
```

Actualizar despues de cambios:

```bash
git pull
docker compose --profile proxy up -d --build
docker compose exec backend alembic upgrade head
```

Backup manual:

```bash
docker compose exec postgres pg_dump -U educa_suite educa_suite > backup.sql
```
