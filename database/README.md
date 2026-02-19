# Database

This folder holds **documentation and optional schema exports** for the task management app.

- **Source of truth for schema:** Laravel migrations in `../backend/database/migrations/`
- **Indexes:** Defined in migrations (e.g. `tasks_user_id_index`, composite indexes for listing). See `DECISIONS.md` and `DATABASE_OPTIMIZATION.md` for rationale.
- You can export the current schema for submission with:
  ```bash
  docker compose exec backend php artisan schema:dump
  ```
  or by copying the migration files into this folder for reference.
