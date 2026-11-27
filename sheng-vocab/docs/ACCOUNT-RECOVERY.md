# Student password recovery (Tencent production)

Implemented 2026-11-27. Apply `deploy/tencent/migrations/account-recovery.sql` to the Tencent database before publishing frontend assets. This does not use the retired hosted database.

- `public.rw_student_security(p_action, p_payload)` supports `status`, `setup`, `question`, `reset`.
- Setup requires a real, existing Auth session and the current password. Both new students and existing students without recovery settings see onboarding. Teacher-reset students set their password and recovery information again.
- New passwords: 6–72 ASCII letters/digits, excluding the shared initial password. Setup and recovery update the same Auth password used by all clients.
- Recovery requires the custom answer and full birth date in the same request as the new password. No reusable verification token is issued.
- Only the question is retrievable. A salted bcrypt hash of a SHA-256 combined answer/date proof is stored in `rw_private.student_recovery`; neither answer nor birth date is stored in plaintext. Answers normalize case and whitespace, dates use ISO YYYY-MM-DD.
- Five wrong proof attempts lock this account for 15 minutes. Failed attempts return structured errors (rather than raising exceptions that would roll back counters). Advisory locks serialize concurrent attempts.
- Setup/recovery invalidate Auth sessions and require a new password login. Security setup explicitly checks session existence, so an old access JWT cannot change recovery details. Existing legacy business RPCs may accept unexpired access JWTs until expiry; session deletion alone is not immediate revocation of every legacy data endpoint.
- Private table has RLS and no anonymous/authenticated privileges; private functions are not directly executable. The narrow public wrapper delegates to code that validates student role, session/current password or both recovery answers.
- Login session persistence is unchanged. No passwords or recovery answers are saved to browser storage.

Validation: temporary student account against live Tencent API (created/removed by test), six-character password login, wrong current password, each recovery answer wrong separately, 5-attempt lock, lock expiry, old-password rejection, old-session rejection for security RPC, private-table access denied. Browser test `tests/account-security.cjs` covers onboarding, automatic fresh login, date selection/leap years, mobile width, failed recovery retry and return to login.

Migration: retain Auth users, memberships, and `rw_private.student_recovery` together in encrypted/private full-database backups; public-business-only exports are not sufficient for recovery information. Do not publish database dumps or question/answer data to GitHub.
