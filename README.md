# Task Management App

A production-ready task management system (API + dashboard).

## Repository Structure

```
/task-management-app
  /backend    # Laravel REST API (PHP)
  /frontend   # React + TypeScript dashboard (Vite)
  /database   
  README.md
  DECISIONS.md
  SYSTEM_DESIGN.md
  DATABASE_OPTIMIZATION.md
  docker-compose.yml
```

## Prerequisites

- **Docker** and **Docker Compose** (recommended)
- Or locally: PHP 8.2+, Composer, Node 18+, npm, MySQL 8

## Setup Instructions (Docker)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd task-manager
   ```

2. **Configure environment** 
   - Copy root `.env.example` to `.env`: Run `cp .env.example .env`
   - Optionally edit `.env` to change credentials (defaults work for local).

3. **Start the stack**
   ```bash
   docker compose up --build
   ```
   No manual `composer install` or artisan commands needed, dependencies and migrations run automatically.

4. **Migrations** run automatically when the backend starts.
   Demo login after seeding:
   - **Email:** `demo@example.com`
   - **Password:** `password`

5. **Access the application**
   - **Dashboard:** http://localhost (or http://localhost:80)
   - **API base:** http://localhost:8000/api

6. **Run tests in Docker** (backend API feature/unit tests)
   - One-off container (recommended):  
     `docker compose run --rm backend-test`  
     This installs dev dependencies and runs `php artisan test` (uses SQLite in-memory; no MySQL required).
   - Or inside the running backend container:  
     `docker compose exec backend sh -c "composer install && php artisan test"`

   **Note:** The test run uses a one-off container that exits when tests finish and may appear as "Exited" (outline icon) In Docker Desktop.

## Setup Instructions (Local without Docker)

1. **Backend**
   - Copy `backend/.env.example` to `backend/.env`
   - Copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL=http://localhost:8000`.
   - Set `DB_CONNECTION=mysql`, `DB_HOST=127.0.0.1`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
   - Run `composer install`, `php artisan key:generate`, `php artisan jwt:secret`
   - Run `php artisan migrate` (and optionally `php artisan db:seed`)
   - Start server: `php artisan serve`

2. **Frontend**
   - Copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL=http://localhost:8000`
   - Run `npm install` and `npm run dev`
   - Open http://localhost:5173

## Technology Choices

- **Backend: Laravel (PHP)** – Mature REST API stack, Eloquent ORM, Form Requests for validation, and a large ecosystem. Chosen for rapid, maintainable API development.
- **Auth: JWT (tymon/jwt-auth)** – Stateless tokens; frontend stores the token and sends it with each request.
- **Frontend: React + TypeScript + Vite** – Type safety for API contracts and forms, fast dev experience.
- **Database: MySQL 8** – Reliable, well-supported by Laravel; migrations and indexes keep schema and performance documented.
- **Docker Compose** – Reproducible local environment so any developer can run the app with minimal setup; ready for future deployment (e.g. AWS).

## API Endpoints

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST   | `/api/auth/register` | Register a new user |
| POST   | `/api/auth/login`     | Login and receive JWT token |
| GET    | `/api/auth/me`       | Current user profile (authenticated) |
| GET    | `/api/tasks`         | List tasks (pagination, filter by status/priority) |
| POST   | `/api/tasks`         | Create a task |
| GET    | `/api/tasks/:id`     | Get a task |
| PATCH  | `/api/tasks/:id`     | Update a task |
| DELETE | `/api/tasks/:id`     | Delete a task |

## Documentation

- **DECISIONS.md** – Architecture, trade-offs, security considerations, and future improvements.
- **SYSTEM_DESIGN.md** – Task 2: system design (notification service).
- **DATABASE_OPTIMIZATION.md** – Task 3: database and performance optimization.
