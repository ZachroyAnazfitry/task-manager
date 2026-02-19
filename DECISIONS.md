# DECISIONS.md

Architectural decisions, trade-offs, security considerations, and possible improvements for the Task Management App (Task 1).

---

## Architectural Decisions

### Monorepo layout (backend / frontend / database)

- **Decision:** Single repository with `backend` (Laravel), `frontend` (React), and `database` (docs/schema).
- **Reason:** Keeps API and dashboard in sync, simplifies Docker Compose and shared documentation, and matches the required submission structure.

### API-only backend

- **Decision:** Laravel serves only JSON API endpoints; no server-rendered views.
- **Reason:** Frontend is a separate SPA; clear separation of concerns and ability to scale or replace the frontend (e.g. mobile app) without changing the API.

### JWT for authentication

- **Decision:** Use JWT (tymon/jwt-auth) so that login returns a token; frontend sends `Authorization: Bearer <token>`.
- **Reason:** Spec explicitly requires “Login and receive JWT token”; stateless tokens suit API-only backends and avoid server-side session storage.

### React + TypeScript + Vite (no Next.js)

- **Decision:** React with TypeScript and Vite for the dashboard.
- **Reason:** TypeScript supports type-safe API contracts and forms (aligns with evaluation criteria); Vite gives fast local dev; SSR was not required for this MVP.

### MySQL and Laravel migrations

- **Decision:** MySQL 8 with schema and indexes defined in Laravel migrations.
- **Reason:** Laravel’s migration system keeps schema in code, supports indexes, and is the single source of truth; optional export in `database/` satisfies “database schema file” submission.

### Docker Compose for local run

- **Decision:** Docker Compose with backend, frontend, and mysql services for local development.
- **Reason:** Reproducible environment, no need to install PHP/Node/MySQL on the host, and a path to future deployment (e.g. AWS) with minimal change.

### Credentials and environment (ready-for-deployment local setup)

- **Decision:** No secrets are stored in `docker-compose.yml`. Required variables are documented in a root `.env.example`. To run the app (and mimic production configuration), copy `.env.example` to `.env` at the project root, then run `docker compose up --build`. Credentials are loaded from `.env` (gitignored), keeping the same pattern as production (env-based config, no committed secrets).
- **Reason:** New developers get a single, documented step (`cp .env.example .env`); production uses env vars or a secret store, so local setup mirrors that. Keeps sensitive values out of version control.

### Backend: indexing, scopes, and scoped binding (Task 1 / evaluation criteria)

- **Decision:** The tasks migration defines composite indexes with inline comments; the Task model uses query scopes for listing; the TaskController uses those scopes in `index` and scoped route model binding for `show`/`update`/`destroy`.
- **Reason:** Aligns with the [Full Stack Engineer submission](https://nexwave.io/tenthub/full-stack-engineer/) (database migrations, design appropriate indexes) and evaluation criteria (code quality, security awareness, production readiness). Indexes support filtered and ordered listing without full table scans; scopes keep the controller thin and the query reusable; scoped binding returns 404 for other users’ tasks instead of 403, avoiding information leakage.

### Backend: backed enums for task status and priority

- **Decision:** Task status and priority are implemented as PHP 8.1 backed enums (`App\Enums\TaskStatus`, `App\Enums\TaskPriority`) with string backing. The Task model casts these attributes to the enum; validation uses `Rule::enum(...)`.
- **Reason:** Single source of truth, type safety in code, and better refactorability; aligns with modern PHP and Laravel best practice. API payloads stay string-based so the frontend contract is unchanged.

### Automatic startup (no manual commands with Docker)

- **Decision:** When using Docker, dependencies and app startup are fully automatic: Composer runs in the backend image build; `key:generate`, `jwt:secret`, and migrations run in the backend container entrypoint/command. No manual `composer install` or artisan commands are required to run the app successfully.
- **Reason:** Reduces onboarding friction and avoids environment drift; aligns with industry practice (build-time deps in Dockerfile, runtime setup in entrypoint/Compose).

---

## Backend: Practices Applied (Task 1 Submission)

In line with *What to Submit for Task 1* and the evaluation criteria (code quality, architecture, production readiness):

- **Migrations & indexes:** The `create_tasks_table` migration defines composite indexes for the listing query: `(user_id, status)`, `(user_id, due_date)`, and `(user_id, created_at)`. Each index is documented with a short comment (filter by status, filter by due date, default order by created_at). No redundant single-column index on `user_id` (covered by the composites).
- **Query scopes (Task model):** `scopeForUser`, `scopeStatus`, `scopePriority`, and `scopeLatest` centralize listing logic, keep the controller readable, and ensure queries use the defined indexes.
- **Controller:** `index` uses the scopes and `latest()` for ordering; `show`, `update`, and `destroy` rely on scoped route model binding so that only the authenticated user’s tasks are resolved (404 for others).
- **Scoped route binding:** In `AppServiceProvider::boot()`, the `task` route parameter is resolved via `Task::forUser(auth('api')->id())->findOrFail($value)`, so task resources are never loaded for another user.
- **Backed enums (status & priority):** `TaskStatus` and `TaskPriority` (PHP 8.1 backed enums) are the single source of truth for allowed values. The Task model casts `status` and `priority` to these enums; Form Requests validate with `Rule::enum(...)`. API request/response remain string values; enums improve type safety and refactorability in the backend.

---

## Trade-offs

| Area | Choice | Trade-off |
|------|--------|-----------|
| JWT vs session | JWT | Stateless and scalable, but token revocation is harder (e.g. need blocklist or short TTL + refresh tokens). |
| React + Vite vs Next.js | React + Vite | Simpler setup and faster iteration; we give up built-in SSR/API routes if we needed them later. |
| Indexes on tasks | (user_id, status), (user_id, due_date), (user_id, created_at) | Faster filtered and ordered lists; slightly slower writes. Acceptable for task-management workload. |
| Token storage (frontend) | localStorage | Easy to implement; vulnerable to XSS. Mitigated by validation, CSP, and avoiding unsafe DOM insertion. |

---

## What We Would Improve With More Time

- **Tests:** PHPUnit for API (auth, task CRUD, validation); Jest + React Testing Library for frontend (auth flow, task list, forms).
- **Refresh tokens:** Short-lived access token + refresh token to improve security without forcing frequent login.
- **Rate limiting:** Stricter limits on auth and task endpoints to reduce abuse.
- **Audit logging:** Log task create/update/delete and auth events for accountability.
- **Accessibility:** ARIA labels, keyboard navigation, and screen-reader-friendly markup (a11y).
- **E2E tests:** Playwright or Cypress for critical flows (register, login, create task, mark done).

---

## Security Considerations

- **Passwords:** Hashed with Laravel’s default (bcrypt); never stored or logged in plain text.
- **JWT:** Signed with a server-side secret (`JWT_SECRET`); token included only in `Authorization` header, not in URLs. Consider short TTL and refresh tokens in production.
- **Input validation:** All register, login, and task inputs validated via Laravel Form Requests (type, length, enums); Eloquent prevents SQL injection via parameterised queries.
- **CORS:** Configured to allow only the frontend origin(s) in production; credentials supported where needed.
- **HTTPS:** In production, serve API and dashboard over HTTPS to protect tokens and data in transit.
- **Sensitive data:** `.env` and secrets not committed; root `.env.example` documents variables used by Docker Compose and the backend. Use `cp .env.example .env` before `docker compose up`; change values in `.env` for production-like local runs.
