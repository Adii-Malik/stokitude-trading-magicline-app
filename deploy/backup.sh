#!/usr/bin/env bash
# Nightly mongodump to $BACKUP_DIR, keeping the last $KEEP_DAYS.
# Reads MONGO_URI from .env.production so a rotated password needs no edit here.
set -euo pipefail

SITE="${SITE_DIR:-$HOME/site}"
DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
ENV_FILE="$SITE/.env.production"

log() { echo "$(date '+%F %T') $*"; }

[ -f "$ENV_FILE" ] || { log "FAIL no $ENV_FILE"; exit 1; }

URI="$(sed -n 's/^MONGO_URI=//p' "$ENV_FILE" | head -1 | tr -d '"'"'"'\r')"
[ -n "$URI" ] || { log "FAIL MONGO_URI missing from $ENV_FILE"; exit 1; }

mkdir -p "$DIR"
OUT="$DIR/psx-$(date +%Y%m%d-%H%M%S).archive.gz"

# Write aside and move on success, so a failure never touches a good backup.
PART="$OUT.part"
trap 'rm -f "$PART"' EXIT

# mongodump ships in the mongo image, so the VM needs nothing installed.
if ! docker run --rm mongo:7 mongodump --uri="$URI" --archive --gzip > "$PART" 2>/tmp/backup.err; then
    log "FAIL mongodump: $(tail -3 /tmp/backup.err | tr '\n' ' ')"
    exit 1
fi

# A dump of an empty or unreachable database still exits 0, so check the size.
SIZE=$(wc -c < "$PART" | tr -d ' ')
if [ "$SIZE" -lt 1024 ]; then
    log "FAIL dump only ${SIZE}B - treating as failed"
    exit 1
fi

mv "$PART" "$OUT"

find "$DIR" -name 'psx-*.archive.gz' -mtime +"$KEEP_DAYS" -delete
log "OK $(basename "$OUT") ${SIZE}B, $(find "$DIR" -name 'psx-*.archive.gz' | wc -l | tr -d ' ') kept"
