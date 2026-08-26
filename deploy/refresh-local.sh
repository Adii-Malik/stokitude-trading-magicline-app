#!/usr/bin/env bash
# Replace the local database with a copy of production.
#
#   npm run db:local              dump production, restore into localhost
#   npm run db:local -- --reuse   restore the last dump again, no network
#
# Reads the production URI from $PROD_URI, or ~/.psx-prod-uri if that is unset,
# so the password never reaches your shell history. Write it once:
#
#   printf '%s' 'mongodb+srv://...' > ~/.psx-prod-uri && chmod 600 ~/.psx-prod-uri
#
# Only ever writes to localhost, and refuses anything else. The guard is the
# point: prod and dev are different Atlas clusters, and a --drop pointed at the
# wrong one is not something you find out about gently.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_URI="${LOCAL_URI:-mongodb://localhost:27017}"
STORE="$HOME/.psx-local-db"
ARCHIVE="$STORE/latest.archive"

case "$LOCAL_URI" in
    mongodb://localhost*|mongodb://127.0.0.1*) ;;
    *) echo "refusing: this script only restores into localhost"; exit 1 ;;
esac

command -v mongodump >/dev/null || {
    echo "mongodump not found - brew install mongodb-database-tools"; exit 1; }

# Check the server first. A restore that dies halfway leaves you with a
# half-dropped database, which is worse than not starting.
if ! (exec 3<>/dev/tcp/127.0.0.1/27017) 2>/dev/null; then
    echo "localhost:27017 is closed. Start it with:"
    echo "  mongod --config /usr/local/etc/mongod.conf &"
    # brew services needs the tap trusted first, and --fork does not work on
    # macOS any more, so the plain background form is the one that just runs.
    echo "or, after 'brew trust mongodb/brew':"
    echo "  brew services start mongodb-community"
    exit 1
fi

mkdir -p "$STORE"

if [ "${1:-}" = "--reuse" ]; then
    [ -f "$ARCHIVE" ] || { echo "no previous dump - run without --reuse"; exit 1; }
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

    echo "dumping production..."
    # Written aside and moved, so a failed dump never replaces a good one you
    # could still have restored with --reuse.
    mongodump --uri="$URI" --archive="$ARCHIVE.part" --gzip --quiet
    mv "$ARCHIVE.part" "$ARCHIVE"
    echo "  $(du -h "$ARCHIVE" | cut -f1)"
fi

echo "restoring into localhost..."
mongorestore --uri="$LOCAL_URI" --archive="$ARCHIVE" --gzip --drop --quiet

echo
# Run from backend/, which is where the driver is installed.
(cd "$ROOT/backend" && LOCAL_URI="$LOCAL_URI" node -e '
const { MongoClient } = require("mongodb");
(async () => {
    const client = new MongoClient(process.env.LOCAL_URI);
    await client.connect();
    const db = client.db("psx_monitor");
    for (const name of ["portfolios", "transactions", "positions", "journalentries", "stocks", "psxdailies"]) {
        console.log("  " + name.padEnd(16) + String(await db.collection(name).countDocuments()).padStart(8));
    }
    await client.close();
})();
') || echo "  (restored, but could not read the counts back)"

# Saying so beats leaving you to wonder why the app still shows Atlas data.
if ! grep -q '^MONGO_URI=mongodb://localhost' "$ROOT/backend/.env" 2>/dev/null; then
    echo
    echo "backend/.env still points somewhere else. To use this copy:"
    echo "  MONGO_URI=mongodb://localhost:27017/psx_monitor"
fi
