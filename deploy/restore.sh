#!/usr/bin/env bash
# Restore a dump made by backup.sh:  ./restore.sh ~/backups/psx-20260815-020000.archive.gz
# Refuses to run without --yes, since this overwrites live collections.
set -euo pipefail

ARCHIVE="${1:-}"
SITE="${SITE_DIR:-$HOME/site}"
ENV_FILE="$SITE/.env.production"

[ -f "$ARCHIVE" ] || { echo "usage: $0 <archive.gz> [--yes]"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "no $ENV_FILE"; exit 1; }

URI="$(sed -n 's/^MONGO_URI=//p' "$ENV_FILE" | head -1 | tr -d '"'"'"'\r')"
[ -n "$URI" ] || { echo "MONGO_URI missing from $ENV_FILE"; exit 1; }

if [ "${2:-}" != "--yes" ]; then
    echo "This replaces collections in the live database with $(basename "$ARCHIVE")."
    echo "Re-run with --yes to proceed."
    exit 1
fi

docker run --rm -i mongo:7 mongorestore --uri="$URI" --archive --gzip --drop < "$ARCHIVE"
echo "restored $(basename "$ARCHIVE")"
