# Database

Task 1 asks for a **database schema file or migration scripts**. This project provides **migration scripts** (Laravel) in `../backend/database/migrations/`. Schema and indexes are defined there.

## Migration scripts

| File | Purpose |
|------|--------|
| `0001_01_01_000000_create_users_table.php` | Users table (auth) |
| `0001_01_01_000001_create_cache_table.php` | Cache table (sessions, etc.) |
| `0001_01_01_000002_create_jobs_table.php` | Jobs queue table |
| `2025_02_16_000001_create_tasks_table.php` | Tasks table (Task 1 schema + indexes) |

**Indexes** are defined in the migrations (e.g. `tasks_user_id_index`, composite indexes for filtered listing). See `DECISIONS.md` and `DATABASE_OPTIMIZATION.md` for rationale.
