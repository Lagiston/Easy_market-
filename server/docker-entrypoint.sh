#!/bin/sh
# Runs migrate deploy, then starts the server. Split out of a plain
# `migrate:deploy && start` shell chain because of a hang observed live on
# Railway: `prisma migrate deploy` (Prisma's own schema-engine binary, not
# the pg/adapter-pg path the app and pg-boss use) completes its real work —
# logs "All migrations have been successfully applied." / "No pending
# migrations to apply." — but the process itself never exits, so `&&` never
# reaches `start`. Reproduced 3 times in a row against Railway's private
# network; never reproduced locally against a local/bridge-network Postgres.
# Root cause not confirmed (suspected TCP teardown quirk against Railway's
# private network), so this works around it instead of masking it silently:
# `timeout` bounds the step generously (the real migration work has taken
# well under 1s in practice) and only treats a timeout as success if the
# output already shows the migration step actually finished; a genuine
# failure or a still-in-progress timeout still aborts the deploy.
set -e

migrate_log=$(mktemp)
echo "Running database migrations..."
# Redirected to a file rather than piped through `tee` — under /bin/sh
# (dash, no `pipefail`), `if cmd | tee ...` checks tee's exit code, not
# timeout's, which would silently defeat this whole check.
if timeout -k 5 60 bun run --cwd server migrate:deploy > "$migrate_log" 2>&1; then
  cat "$migrate_log"
elif grep -qE "All migrations have been successfully applied\.|No pending migrations to apply\." "$migrate_log"; then
  cat "$migrate_log"
  echo "migrate deploy completed its work but did not exit on its own within 60s — proceeding anyway (see docker-entrypoint.sh)."
else
  cat "$migrate_log"
  echo "migrate deploy failed or did not complete within the timeout."
  exit 1
fi
rm -f "$migrate_log"

exec bun run --cwd server start
