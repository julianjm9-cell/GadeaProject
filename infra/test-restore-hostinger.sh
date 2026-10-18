#!/usr/bin/env bash
# Restore a selected backup into a temporary database; never replace the live database.
set -Eeuo pipefail
umask 077
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
BACKUP_PATH="$(realpath -- "${1:?Indica la carpeta backups/deploy-... que quieras comprobar}")"
case "$BACKUP_PATH" in "$ROOT"/backups/*) ;; *) printf 'La copia debe estar en backups/ de esta instalación.\n' >&2;exit 1;; esac
test -s "$BACKUP_PATH/database.dump"
CHECK_DB="restore_check_$(date -u +%Y%m%d%H%M%S)_$RANDOM"
[[ "$CHECK_DB" =~ ^restore_check_[0-9]+_[0-9]+$ ]] || exit 1
cleanup(){ docker compose exec -T postgres sh -c 'dropdb --if-exists -U "$POSTGRES_USER" "$1"' sh "$CHECK_DB"; }
docker compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" "$1"' sh "$CHECK_DB"
trap cleanup EXIT
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" --no-owner --exit-on-error -d "$1"' sh "$CHECK_DB" < "$BACKUP_PATH/database.dump"
docker compose exec -T -e RESTORE_CHECK_DATABASE="$CHECK_DB" backend python -m app.restore_check
if [[ -f "$BACKUP_PATH/documents.tar" ]]; then
  tar -tf "$BACKUP_PATH/documents.tar" > /dev/null
  printf 'OK archivo de documentos legible (no se ha extraído sobre los documentos reales).\n'
fi
printf 'Restauración SQL aislada comprobada. La base de producción no se ha sustituido.\n'
