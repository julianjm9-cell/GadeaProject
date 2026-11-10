#!/usr/bin/env bash
# Sent over SSH by the command center. Arguments are validated in both environments.
set -euo pipefail
umask 077

action=${1:-}
cd /opt/educa-suite

check_checkout() {
  [[ "$(git symbolic-ref --quiet --short HEAD)" == main ]]
  [[ -z "$(git status --porcelain --untracked-files=no)" ]]
  [[ -f .env ]]
  command -v flock >/dev/null
  docker compose version >/dev/null
  docker info --format '{{.ServerVersion}}' >/dev/null
}

if [[ "$action" == check ]]; then
  check_checkout
  printf 'EDUCAME_HEAD %s\n' "$(git rev-parse HEAD)"
  exit 0
fi

id=${2:-}
revision=${3:-}
[[ "$id" =~ ^[a-f0-9-]{36}$ && "$revision" =~ ^[a-f0-9]{40}$ ]]
base="$(git rev-parse --absolute-git-dir)/educame-deployments"
job="$base/$id"

if [[ "$action" == status ]]; then
  if [[ ! -f "$job/revision" ]]; then
    printf 'EDUCAME_STATE missing\n'
    exit 0
  fi
  [[ "$(cat "$job/revision")" == "$revision" ]]
  if [[ -f "$job/result" ]]; then
    printf 'EDUCAME_STATE %s\n' "$(cat "$job/result")"
  elif [[ -f "$job/process" ]] && read -r boot pid < "$job/process" &&
    { [[ "$boot" != "$(cat /proc/sys/kernel/random/boot_id)" ]] || ! kill -0 "$pid" 2>/dev/null; }; then
    printf 'EDUCAME_STATE 125\n'
  elif [[ ! -f "$job/process" ]] && (( $(date +%s) - $(stat -c %Y "$job/revision") > 30 )); then
    printf 'EDUCAME_STATE 125\n'
  else
    printf 'EDUCAME_STATE running\n'
  fi
  if [[ -f "$job/log" ]]; then
    grep -E '^\[[1-5]/5\]|^EDUCAME_STEP |^La actualización se ha detenido en la línea' "$job/log" | tail -n 12 || true
  fi
  exit 0
fi

[[ "$action" == start ]]
expected_head=${4:-}
[[ "$expected_head" =~ ^[a-f0-9]{40}$ ]]
check_checkout
mkdir -p "$base"
if mkdir "$job"; then
  printf '%s\n' "$revision" > "$job/revision"
  cat > "$job/run" <<'RUN'
#!/usr/bin/env bash
set -euo pipefail
umask 077
job=$1
revision=$2
expected_head=$3
trap 'code=$?; printf "%s\n" "$code" > "$job/result.tmp"; mv "$job/result.tmp" "$job/result"' EXIT
exec 8>"$(dirname "$job")/lock"
flock -n 8 || { printf 'EDUCAME_STEP Ya hay otro despliegue en curso.\n'; exit 1; }
[[ "$(git symbolic-ref --quiet --short HEAD)" == main && "$(git rev-parse HEAD)" == "$expected_head" ]] ||
  { printf 'EDUCAME_STEP El checkout del VPS cambió después de la confirmación.\n'; exit 1; }
[[ -z "$(git status --porcelain --untracked-files=no)" ]] ||
  { printf 'EDUCAME_STEP El VPS tiene cambios locales pendientes.\n'; exit 1; }
printf 'EDUCAME_STEP Comprobando la revisión de GitHub.\n'
GIT_TERMINAL_PROMPT=0 git fetch origin main
[[ "$(git rev-parse FETCH_HEAD)" == "$revision" ]] || { printf 'EDUCAME_STEP GitHub cambió después de la confirmación.\n'; exit 1; }
git merge --ff-only "$revision"
[[ "$(git rev-parse HEAD)" == "$revision" ]]
bash infra/deploy-hostinger.sh
printf 'EDUCAME_STEP El VPS ha completado las verificaciones.\n'
RUN
  nohup bash "$job/run" "$job" "$revision" "$expected_head" > "$job/log" 2>&1 </dev/null &
  printf '%s %s\n' "$(cat /proc/sys/kernel/random/boot_id)" "$!" > "$job/process.tmp"
  mv "$job/process.tmp" "$job/process"
else
  [[ -f "$job/revision" && "$(cat "$job/revision")" == "$revision" ]]
fi
printf 'EDUCAME_STATE running\n'
