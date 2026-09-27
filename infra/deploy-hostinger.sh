#!/usr/bin/env bash
# Update an existing Educa Suite installation. Run after git pull --ff-only.
set -Eeuo pipefail
umask 077

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
trap 'printf "\nLa actualización se ha detenido en la línea %s. No se han borrado volúmenes ni restablecido contraseñas.\nRevisa: docker compose logs --tail=80 backend reverse-proxy\n" "$LINENO" >&2' ERR

command -v docker >/dev/null
command -v flock >/dev/null
docker compose version >/dev/null
docker info >/dev/null
exec 9> .deploy-hostinger.lock
flock -n 9 || { printf 'Ya hay otra actualización en curso.\n' >&2; exit 1; }
if [[ ! -f .env ]]; then
  printf 'Falta .env. Este comando actualiza una instalación existente; conserva el .env de tu servidor.\n' >&2
  exit 1
fi
docker compose --profile proxy config --quiet

printf '\n[1/5] Construyendo la nueva imagen (la app actual sigue funcionando)…\n'
docker compose build backend

printf '\n[2/5] Preparando copia de seguridad de PostgreSQL…\n'
docker compose up -d --wait --wait-timeout 120 postgres
mkdir -p backups
BACKUP_DIR="$(mktemp -d "$ROOT/backups/deploy-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")"
cp -- .env "$BACKUP_DIR/environment.env"
if [[ -n "${ENV_FILE:-}" && "$ENV_FILE" != .env ]]; then
  cp -- "$ENV_FILE" "$BACKUP_DIR/backend-environment.env"
fi
git rev-parse HEAD > "$BACKUP_DIR/target-revision.txt"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$BACKUP_DIR/database.dump.partial"
test -s "$BACKUP_DIR/database.dump.partial"
docker compose exec -T postgres pg_restore --list < "$BACKUP_DIR/database.dump.partial" > /dev/null
mv -- "$BACKUP_DIR/database.dump.partial" "$BACKUP_DIR/database.dump"
printf 'Copia verificada: %s\n' "$BACKUP_DIR"
if [[ -n "$(docker compose ps -q backend)" ]]; then
  docker compose exec -T backend python -c 'import io, pathlib, sys, tarfile; root=pathlib.Path("/app/data/documents"); archive=tarfile.open(fileobj=sys.stdout.buffer, mode="w|"); archive.add(root, arcname="documents") if root.exists() else None; archive.close()' > "$BACKUP_DIR/documents.tar"
fi

printf '\n[3/5] Aplicando migraciones…\n'
if [[ -f "$BACKUP_DIR/documents.tar" ]]; then
  # On first deployment of the persistent volume, recover existing container files.
  # A populated volume is already current and must not be overwritten by a backup.
  docker compose run --rm --no-deps -T backend python -c 'import pathlib,sys,tarfile; root=pathlib.Path("/app/data/documents"); empty=not root.exists() or not any(root.iterdir()); tarfile.open(fileobj=sys.stdin.buffer,mode="r|").extractall(path="/app/data",filter="data") if empty else sys.stdin.buffer.read()' < "$BACKUP_DIR/documents.tar"
fi
docker compose run --rm --no-deps backend alembic upgrade head

printf '\n[4/5] Actualizando los servicios…\n'
docker compose --profile proxy up -d --no-build --wait --wait-timeout 180

printf '\n[5/5] Comprobando base de datos, app, landing, login y dashboard…\n'
docker compose exec -T backend python -m app.deployment_check
docker compose exec -T reverse-proxy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose ps
printf '\nActualización completada. Abre estas rutas en tu dominio o IP habitual:\n'
printf '  /                     Portada con las cinco apps\n  /profesor             Landing de Profesor Particular\n  /profesor/login       Login y registro\n  /profesor/demo        Demo sin cuenta\n  /profesor-particular  App privada\n  /admin-dashboard/     Dashboard de administración\n'
printf '\nCopia de seguridad: %s\n' "$BACKUP_DIR"
