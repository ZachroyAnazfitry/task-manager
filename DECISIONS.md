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
- **Reason:** Stateless tokens suit API-only backends and avoid server-side session storage.

### React + TypeScript + Vite

- **Decision:** React with TypeScript and Vite for the dashboard.
- **Reason:** TypeScript supports type-safe API contracts and forms (aligns with evaluation criteria); Vite gives fast local dev; SSR was not required for this MVP.

### MySQL and Laravel migrations

- **Decision:** MySQL 8 with schema and indexes defined in Laravel migrations.
- **Reason:** Laravel’s migration system keeps schema in code, supports indexes, and is the single source of truth; optional export in `database/` satisfies “database schema file” submission.

### Docker Compose for local run

- **Decision:** Docker Compose with backend, frontend, and mysql services for local development.
- **Reason:** Reproducible environment, no need to install PHP/Node/MySQL on the host, and a path to future deployment (e.g. AWS) with minimal change.

### Credentials and environment

- **Decision:** No secrets are stored in `docker-compose.yml`. Required variables are documented in a root `.env.example`. To run the app, copy `.env.example` to `.env` at the project root, then run `docker compose up --build`. Credentials are loaded from `.env` (gitignored), keeping the same pattern as production (env-based config, no committed secrets).
- **Reason:** New developers get a single, documented step (`cp .env.example .env`); production uses env vars or a secret store, so local setup mirrors that. Keeps sensitive values out of version control.

### Automatic startup (no manual commands with Docker)

- **Decision:** When using Docker, dependencies and app startup are fully automatic: Composer runs in the backend image build; `key:generate`, `jwt:secret`, and migrations run in the backend container entrypoint/command. No manual `composer install` or artisan commands are required to run the app successfully.
- **Reason:** Reduces onboarding friction and avoids environment drift; aligns with industry practice (build-time deps in Dockerfile, runtime setup in entrypoint/Compose).

---

## Backend: Best Practices Applied 

- **Migrations & indexes:** The `create_tasks_table` migration defines composite indexes for the listing query: `(user_id, status)`, `(user_id, due_date)`, and `(user_id, created_at)`. Each index is documented with a short comment (filter by status, default order by created_at). No redundant single-column index on `user_id` (covered by the composites).
- **Query scopes (Task model):** `scopeForUser`, `scopeStatus`, `scopePriority`, and `scopeLatest` centralize listing logic, keep the controller readable, and ensure queries use the defined indexes.
- **Controller:** `index` uses the scopes and `latest()` for ordering; `show`, `update`, and `destroy` rely on scoped route model binding so that only the authenticated user’s tasks are resolved (404 for others).
- **Scoped route binding:** In `AppServiceProvider::boot()`, the `task` route parameter is resolved via `Task::forUser(auth('api')->id())->findOrFail($value)`, so task resources are never loaded for another user.
- **Backed enums (status & priority):** `TaskStatus` and `TaskPriority`  are the single source of truth for allowed values. The Task model casts `status` and `priority` to these enums; Form Requests validate with `Rule::enum(...)`. API request/response remain string values; enums improve type safety and refactorability in the backend.

---

## Frontend: Best Practices Applied

- **Rules of Hooks:** Hooks are only used at the top level of components or in the custom hook `useAuth`; no conditional or loop-based hook calls. `useAuth` throws if used outside `AuthProvider`, following the usual React context pattern.
- **Purity & side effects:** Components render from props/state/context only; no prop mutation. Side effects (API calls, `localStorage`) run in `useEffect` or event handlers (`handleSubmit`, `handleCreate`), not during render. Pure helpers (e.g. `statusBadgeClass`, `priorityBadgeClass`) are used for derived UI.
- **Context & separation:** Auth state and actions live in `AuthContext`; `ProtectedRoute` centralizes auth checks for private routes. API layer is in `api/`; components stay focused on UI and calling those APIs. Shared types live in `types`.
- **TypeScript:** Props and state are typed (e.g. `Task`, `User`, `TaskFormData`); forms and API responses use these types for consistency and safer refactors.
- **Controlled forms:** Login, Register, and TaskModal use local state and `setState`; loading and error state are handled in component state; no direct DOM mutation.
- **UI/UX features:**
  - **Responsive:** Tailwind responsive utilities (`sm:`, `flex-wrap`, `max-w-4xl mx-auto`, `hidden sm:inline`, etc.) for a mobile-friendly dashboard and auth pages.
  - **Loading states:** List fetch, auth check, and form submit show loading with disabled buttons and clear labels (“Signing in…”, “Saving…”).
  - **Error handling:** Inline form errors plus `react-hot-toast` for API success/error; `getErrorMessage()` normalizes API errors for consistent messages.
  - **Form validation:** Required fields and rules (e.g. password length, match) with user-facing messages.
  - **Appearance:** Tailwind-based UI (gradients, spacing, shadows); delete confirmation modal for tasks.

---

## Trade-offs

| Area | Choice | Trade-off |
|------|--------|-----------|
| JWT vs session | JWT | Stateless and scalable, but token revocation is harder (e.g. need blocklist or short TTL + refresh tokens). |
| React + Vite vs Next.js | React + Vite | Simpler setup and faster iteration. |
| Indexes on tasks | (user_id, status), (user_id, due_date), (user_id, created_at) | Faster filtered and ordered lists; slightly slower writes. Acceptable for task-management workload. |
| Token storage (frontend) | localStorage | Easy to implement; vulnerable to XSS. Mitigated by validation, CSP, and avoiding unsafe DOM insertion. |

---

## Improvements

- **Tests:** PHPUnit for API (auth, task CRUD, validation); Jest + React Testing Library for frontend (auth flow, task list, forms).
- **Refresh tokens:** Short-lived access token + refresh token to improve security without forcing frequent login.
- **Rate limiting:** Stricter limits on auth and task endpoints to reduce abuse.
- **Audit logging:** Log task create/update/delete and auth events for accountability.

---

## Security Considerations

- **Passwords:** Hashed with Laravel’s default (bcrypt); never stored or logged in plain text.
- **JWT:** Signed with a server-side secret (`JWT_SECRET`); token included only in `Authorization` header, not in URLs. Consider short TTL and refresh tokens in production.
- **Input validation:** All register, login, and task inputs validated via Laravel Form Requests (type, length, enums); Eloquent prevents SQL injection via parameterised queries.
- **CORS:** Configured to allow only the frontend origin(s) in production; credentials supported where needed.
- **HTTPS:** In production, serve API and dashboard over HTTPS to protect tokens and data in transit.
- **Sensitive data:** `.env` and secrets not committed; root `.env.example` documents variables used by Docker Compose and the backend. Use `cp .env.example .env` before `docker compose up`; change values in `.env` for production-like local runs.
