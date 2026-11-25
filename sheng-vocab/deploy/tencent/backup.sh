#!/bin/sh
set -eu
umask 077
backup_dir=/opt/recitewords-backups
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$backup_dir/database-$stamp.dump"
docker exec rw-db pg_dump -U supabase_admin -d postgres -Fc > "$backup_file.partial"
mv "$backup_file.partial" "$backup_file"
docker exec rw-db pg_dumpall -U supabase_admin --roles-only --no-role-passwords > "$backup_dir/roles-$stamp.sql"
sha256sum "$backup_file" > "$backup_file.sha256"
find "$backup_dir" -maxdepth 1 -type f -name 'database-*.dump*' -mtime +14 -delete
find "$backup_dir" -maxdepth 1 -type f -name 'roles-*.sql' -mtime +14 -delete
