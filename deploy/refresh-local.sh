#!/usr/bin/env bash
# Replace the dev database with a copy of production.
#
#   npm run db:local              dump production, restore into dev
#   npm run db:local -- --reuse   restore the last dump again, no network
#
# The target is whatever backend/.env points at - the dev Atlas cluster, or a
# local mongod, either works. Override with TARGET_URI.
#
# Reads the production URI from $PROD_URI, or ~/.psx-prod-uri if that is unset,
# so the password never reaches your shell history. Write it once:
#
#   ssh oracle 'sed -n "s/^MONGO_URI=//p" ~/site/.env.production' \
#       | tr -d '\r\n' > ~/.psx-prod-uri && chmod 600 ~/.psx-prod-uri
#
# The one thing it will not do is restore onto the host it dumped from. That is
# the only way this command could hurt you, so it is checked every run, on the
# stored source host even when --reuse skips the dump entirely.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STORE="$HOME/.psx-local-db"
ARCHIVE="$STORE/latest.archive"
SOURCE_HOST_FILE="$STORE/source-host"

# Host only - never the credentials, so this is safe to print.
host_of() { printf '%s' "$1" | sed -E 's#^mongodb(\+srv)?://##; s#^[^@]*@##; s#[/?].*##'; }

TARGET="${TARGET_URI:-}"
if [ -z "$TARGET" ]; then
    TARGET="$(sed -n 's/^MONGO_URI=//p' "$ROOT/backend/.env" 2>/dev/null | head -1 | tr -d '"'"'"'\r')"
fi
[ -n "$TARGET" ] || { echo "no target - set TARGET_URI or MONGO_URI in backend/.env"; exit 1; }

command -v mongodump >/dev/null || {
    echo "mongodump not found - brew install mongodb-database-tools"; exit 1; }

# A local target has to actually be running, or the restore dies halfway and
# leaves a half-dropped database behind.
case "$(host_of "$TARGET")" in
    localhost*|127.0.0.1*)
        if ! (exec 3<>/dev/tcp/127.0.0.1/27017) 2>/dev/null; then
            echo "localhost:27017 is closed. Start it with:"
            echo "  mongod --config /usr/local/etc/mongod.conf &"
            exit 1
        fi
        ;;
esac

mkdir -p "$STORE"

if [ "${1:-}" = "--reuse" ]; then
    [ -f "$ARCHIVE" ] || { echo "no previous dump - run without --reuse"; exit 1; }
    SOURCE_HOST="$(cat "$SOURCE_HOST_FILE" 2>/dev/null || echo unknown)"
    echo "reusing the dump from $(date -r "$ARCHIVE" '+%F %H:%M')"
else
    URI="${PROD_URI:-}"
    if [ -z "$URI" ] && [ -f "$HOME/.psx-prod-uri" ]; then
        URI="$(tr -d '\r\n' < "$HOME/.psx-prod-uri")"
    fi
    if [ -z "$URI" ]; then
        read -rs -p "production URI: " URI
        echo
    fi
    [ -n "$URI" ] || { echo "no production URI given"; exit 1; }
    SOURCE_HOST="$(host_of "$URI")"
fi

if [ "$SOURCE_HOST" = "$(host_of "$TARGET")" ]; then
    echo "refusing: source and target are both $SOURCE_HOST"
    echo "that would restore production onto itself"
    exit 1
fi

echo "$SOURCE_HOST  ->  $(host_of "$TARGET")"

if [ "${1:-}" != "--reuse" ]; then
    echo "dumping..."
    # Written aside and moved, so a failed dump never replaces a good one you
    # could still have restored with --reuse.
    mongodump --uri="$URI" --archive="$ARCHIVE.part" --gzip --quiet
    mv "$ARCHIVE.part" "$ARCHIVE"
    printf '%s' "$SOURCE_HOST" > "$SOURCE_HOST_FILE"
    echo "  $(du -h "$ARCHIVE" | cut -f1)"
fi

echo "restoring..."
mongorestore --uri="$TARGET" --archive="$ARCHIVE" --gzip --drop --quiet

echo
# Run from backend/, which is where the driver is installed.
(cd "$ROOT/backend" && TARGET_URI="$TARGET" node -e '
const { MongoClient } = require("mongodb");
(async () => {
    const client = new MongoClient(process.env.TARGET_URI);
    await client.connect();
    const db = client.db("psx_monitor");
    for (const name of ["portfolios", "transactions", "positions", "journalentries", "stocks", "psxdailies"]) {
        console.log("  " + name.padEnd(16) + String(await db.collection(name).countDocuments()).padStart(8));
    }
    await client.close();
})();
') || echo "  (restored, but could not read the counts back)"
