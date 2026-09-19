#!/bin/bash
# Nightly Postgres backup: dumps the personalwallet DB. Keeps everything (data is tiny).
set -e
cd "$(dirname "$0")"
mkdir -p backups
STAMP=$(date +%Y-%m-%d_%H-%M)
docker exec personalwallet-db-1 pg_dump -U pw personalwallet | gzip > "backups/personalwallet-$STAMP.sql.gz"
