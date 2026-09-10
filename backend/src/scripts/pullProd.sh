#!/usr/bin/env bash
#
# Copy production into the local database.
#
# The dev Atlas cluster was a free tier, Atlas reclaimed it after it sat idle,
# and every local login went with it. Local mongod does not expire, and while
# the app is still being built the thing dev testing actually wants is a copy
# of the real book rather than a second cluster of invented rows. So the dev
# database is now a restore of production, refreshed whenever it goes stale.
#
#   npm run db:pull            # from backend/
#
# The production URI is not stored here and does not reach the laptop's disk in
# any form that outlives the run. It is read out of the box's own
# .env.production over ssh, written to a 0600 file in a temp directory that is
# deleted on exit, and passed to mongodump by --config rather than --uri - an
# argument would put the password in `ps` for every process on the machine to
# read.
#
# Set PROD_MONGO_URI yourself to dump from somewhere else.
#
set -euo pipefail

LOCAL_URI="${LOCAL_MONGO_URI:-mongodb://127.0.0.1:27017/psx_monitor}"

# The one thing this script must never do is write to production. A restore
# target that is not loopback is a typo, not an intention, and the cost of
# being wrong here is the only copy of the book.
case "$LOCAL_URI" in
    mongodb://127.0.0.1:*|mongodb://localhost:*) ;;
    *) echo "Refusing to restore into a target that is not local: $LOCAL_URI" >&2; exit 1 ;;
esac

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
chmod 700 "$WORK"
umask 077

PROD_URI="${PROD_MONGO_URI:-$(ssh oracle 'grep -m1 "^MONGO_URI=" ~/site/.env.production | cut -d= -f2-' | tr -d '\r"')}"
[ -n "$PROD_URI" ] || { echo "Could not read the production URI from the box." >&2; exit 1; }

# Database names, not credentials, so these are safe to hold and to print. The
# two are mapped explicitly because the archive carries the source name and
# prod's need not match the local one.
src_db="${PROD_URI##*/}";  src_db="${src_db%%\?*}"
dst_db="${LOCAL_URI##*/}"; dst_db="${dst_db%%\?*}"
local_host="${LOCAL_URI%/*}"
[ -n "$src_db" ] || { echo "The production URI names no database." >&2; exit 1; }

printf 'uri: %s\n' "$PROD_URI" > "$WORK/source.yaml"

echo "Dumping production ($src_db)..."
mongodump --config="$WORK/source.yaml" --db="$src_db" --archive="$WORK/prod.gz" --gzip --quiet

# --drop, and per collection rather than the whole database: a half-replaced
# database is harder to reason about than either of the two it was made from,
# and dropping only what the archive refills leaves nothing orphaned.
echo "Restoring into $dst_db..."
mongorestore --uri="$local_host" --archive="$WORK/prod.gz" --gzip --drop \
    --nsFrom="$src_db.*" --nsTo="$dst_db.*" --quiet

echo "Done. $dst_db matches production as of $(date '+%Y-%m-%d %H:%M')."
