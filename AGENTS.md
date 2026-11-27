# ReciteWords production conventions

- User decision on 2026-11-27: Tencent is the production backend. All future work,
  database reads/writes, testing and releases target Tencent by default.
- Canonical frontend: https://6v8nhmyrfj-art.github.io/ReciteWords/tencent-test/
  The historical directory name is retained for bookmarks/login continuity;
  this is the primary site, not a disposable test environment.
- API: https://129.204.40.183, configured in backend-config.mjs. Keep endpoint,
  public key and environment in deployment configuration, not business logic.
- Supabase project nnooeadfgsvbddrjwyan is the retired source/archive. Do not
  write there or unfreeze it by default. A rollback needs an explicit plan that
  preserves all new Tencent data; never simply overwrite production with an old dump.
- The working checkout corresponds to sheng-vocab/ in GitHub. app.html and root MJS/CSS are maintained source; index.html in GitHub is a redirect. Generate deployable static assets with
  deploy/tencent/build.py; publish to repository directory tencent-test/. Keep
  sheng-vocab/index.html and class.html as redirects to the canonical frontend.
  Sync authorized code changes to GitHub and verify the deployed page.
- Current environment ID remains tencent-test-20261127 to preserve account cache
  isolation and login continuity. Its name does not imply disposable data.
- The user's own domain DNS was paused for ICP filing. Do not restore it until
  the user says filing is ready. Prepare migration using deployment configuration,
  API origins, auth URLs, Nginx and certificates; do not hardcode the new domain.
- Never publish exports/, database dumps, credentials, service-role keys or
  account/password lists. Temporary test accounts must be cleaned up.
- Main-site databases are live student records. Back up before data migrations,
  compare source/target deltas, and verify row-level access and preservation.
