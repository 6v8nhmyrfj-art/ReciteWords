#!/bin/bash
set -euo pipefail
umask 077
cd /home/ubuntu/recitewords-selfhost/config
# Source write fence must exist before taking the final consistent snapshot.
guards=$(PGPASSFILE=/home/ubuntu/.recitewords-source.pgpass psql 'host=aws-0-ap-south-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.nnooeadfgsvbddrjwyan sslmode=require' -X -w -At -c "select count(*) from pg_trigger where tgname='rw_migration_freeze'")
[[ "$guards" == 23 ]] || { echo "Unexpected source fence count: $guards"; exit 1; }
backup=/home/ubuntu/recitewords-backups/final-$(date -u +%Y%m%dT%H%M%SZ).dump
[[ ! -e "$backup" ]] || { echo 'Final backup already exists; inspect before retry'; exit 1; }
sudo docker run --rm --network host -v /home/ubuntu/.recitewords-source.pgpass:/run/source.pgpass:ro -e PGPASSFILE=/run/source.pgpass -e PGCONNECT_TIMEOUT=20 mirror.ccs.tencentyun.com/library/postgres:17 pg_dump --dbname='host=aws-0-ap-south-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.nnooeadfgsvbddrjwyan sslmode=require' --format=custom --no-password > "$backup.partial"
mv "$backup.partial" "$backup"
sha256sum "$backup" > "$backup.sha256"
sudo docker compose -f compose.json stop auth rest functions
sudo docker cp "$backup" rw-db:/tmp/final.dump
sudo docker exec rw-db pg_restore --list /tmp/final.dump > /tmp/rw-final.toc
# The fence belongs only to the retired source; do not carry it into the new writable database.
grep -v 'rw_migration_freeze' /tmp/rw-final.toc > /tmp/rw-final-filtered.toc
sudo docker cp /tmp/rw-final-filtered.toc rw-db:/tmp/final.toc
sudo docker exec rw-db pg_restore -U supabase_admin -d postgres --schema=auth --schema=public --schema=rw_private --clean --if-exists --single-transaction --exit-on-error --use-list=/tmp/final.toc /tmp/final.dump
python3 sync-acl.py
python3 check-data.py > final-data-check.json
python3 - <<'PY'
import json
rows=json.load(open('final-data-check.json'))
assert len(rows)==23 and all(x['equal'] for x in rows), rows
print('Final restore verified: 23 tables including accounts, all rows match source.')
PY
sudo docker compose -f compose.json start auth rest functions
sudo docker exec rw-gateway nginx -s reload
printf 'Final restored snapshot: '
cat "$backup.sha256"
