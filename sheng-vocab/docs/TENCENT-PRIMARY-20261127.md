# Tencent primary cutover — 2026-11-27

User designated Tencent as the default production backend. Canonical frontend:
https://6v8nhmyrfj-art.github.io/ReciteWords/tencent-test/ . Historical path name is
retained; the test banner is removed. Old sheng-vocab index/class entrypoints redirect.
Own-domain DNS remains paused for ICP filing.

Before switching, both databases were backed up and writes paused. Source snapshot
restored with exact object/column permissions, then target-only classroom sessions,
classroom events and oral answers merged in a single transaction. Duplicate passed
words remain one row per existing primary key, keeping the latest passed timestamp.
Goal range changes use the latest timestamp. Daily oral usage is source + target minus
shared snapshot usage, bounded below by either current counter. Unexpected overlapping
edits abort instead of silently overwriting.

Expected merged counts: 44 member accounts, 14 libraries, 65 classroom sessions,
628 classroom events, 1715 class passes, 205 oral answers, 1960 weekly checks.
All 21 business tables are verified row-for-row against the prepared union;
source account IDs and password hashes are verified separately. Authentication
sessions may require a fresh login after the database switch; passwords are retained.
Incomplete sessions against an outdated teacher target revision retain history,
but existing application rules may require restarting against the updated goal.

Source Supabase remains write-fenced to prevent stale tabs creating split histories.
It is an archive, not a default runtime. Do not unfreeze or roll back without reconciling
new Tencent writes. Tencent local database backups and IP certificate renewal timers
remain enabled. Domain cutover instructions: TENCENT-GITHUB-TEST.md; adapt only deployment
configuration, origins, auth URLs, proxy and certificate settings when ICP is approved.
