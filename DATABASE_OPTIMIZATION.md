# DATABASE_OPTIMIZATION.md

**Task 3: Database & Performance Optimization** – Query optimization, design challenges, real-world problems.

This document provides answer for the database and performance optimization task.

---

## A. Query Optimization

### A1. SQL query for the report

```sql
SELECT
    u.id,
    u.username,
    u.email,
    COUNT(o.id) AS total_orders,
    COALESCE(SUM(o.total_amount), 0) AS total_spent
FROM users u
INNER JOIN orders o ON o.user_id = u.id
WHERE o.created_at >= NOW() - INTERVAL '30 days'
  AND o.status = 'completed'
GROUP BY u.id, u.username, u.email
ORDER BY total_spent DESC
LIMIT 10;
```

### A2. Indexes to optimize the query

On **orders** table, create a composite index on `(user_id, created_at)` so the database can efficiently filter by the last 30 days and group by user. If most reports filter by `status`, add a composite such as `(status, created_at)` or include `status` in the composite (e.g. `(status, created_at, user_id)`).

### A3. Further strategies to counter slow query

Use an **aggregate table** (e.g. `user_spending_30d`) with one row per user and a rolling 30-day total so that the report reads from this table instead of scanning orders. Run the report on a **read replica** database so the primary DB only handles transactional workload. **Cache** the top-10 result (e.g. in Redis) with a small time window (e.g. 5–15 minutes) to reduce load further.

---

## B. Design Challenge

### B1. Database schema changes

**SQL approach:** Create a new table called user_product_views to record product views per user with a timestamp. Always update `viewed_at` column when a user views a product they have already viewed. That implies one row per (user, product) with a current timestamp.

```sql
CREATE TABLE user_product_views (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, product_id)
);

CREATE INDEX idx_user_product_views_user_viewed
    ON user_product_views (user_id, viewed_at DESC);
```

To enforce "last 50 products" per user, the application (or through the scheduled job) can keeps only the 50 most recent rows per user. The index `(user_id, viewed_at DESC)` will fetch last 50 products for user and find oldest view for this user efficiently.

### B2. SQL vs NoSQL

**SQL (e.g. PostgreSQL)** keeps everything in one place: we can JOIN with `products` table for the homepage and simple analytics. The downside is need to enforce "last 50" in the app or a job, and causes heavy traffic.

**NoSQL (e.g. Redis)** gives very fast reads and writes, and "last 50" is built-in. The downside is we run a second store, and may need to sync it to the main DB for analytics.

**Preference:** I prefer the SQL table for consistency and simplicity. Redis will be used only if latency is critical and to maintain a separate cache or write to both SQL and Redis (dual-write).

### B3. Data retention methods

- **In the application:** After each view (update or insert on `user_id` + `product_id`, set `viewed_at = NOW()`), delete older rows so only the 50 most recent remain for that user. Do this in the same request or in a background task.
- **Scheduled job:** Run a periodic job (e.g. hourly) per user or in batches, deletes all but only for the 50 most recent rows; simpler for the app but the table may hold more than 50 per user.
- **NoSQL (e.g. Redis):** Push the new view onto the list and trim to 50 (e.g. LTRIM); no separate retention step.

### B4. API endpoint design

- **Record a view:** `POST /api/users/me/recent-views` with body `{ "product_id": "<uuid>" }`, or `POST /api/products/:id/view` (product from URL, user from auth). Same (user, product) again just updates `viewed_at` (upsert). Return 204 or 200.
- **Get recent views (homepage):** `GET /api/users/me/recent-views?limit=50` — returns recently viewed products, most recent first. Backend joins `user_product_views` with `products`, orders by `viewed_at DESC`, limit 50.

Example response:

```json
[
  { "product_id": "uuid", "name": "...", "price": 9.99, "viewed_at": "2025-02-19T12:00:00Z" },
  ...
]
```

Optionally, record a view when the user opens a product page—either as a side effect of `GET /api/products/:id` or by having the client call the record-view endpoint.

---

## C. Real-World Problem (10 min) – Orders table at 10M rows

### C1. Improve query performance

- **Indexes:** Add composites to match query (e.g. `(user_id, created_at)`, `(status, created_at)`). Use `EXPLAIN (ANALYZE, BUFFERS)` to find full table scans and fix them with indexes.
- **Query tuning:** Select only the columns needed, avoid `SELECT *`, and use indexed columns in JOINs and WHERE.
- **Read replica:** Run heavy reports on a replica DB so the primary DB stays fast for writes and critical reads.

### C2. Archive old data while keeping it accessible

- **Archive table:** Move old orders (e.g. older than 2 years) to `orders_archive` table (same schema), in the same DB or a separate archive DB. Route recent queries to the main table, use the archive (or a UNION) for full history or reporting.
- **Cold storage:** Export old data to object storage (e.g. Parquet/CSV) for analytics or compliance.

### C3. Ensure minimal downtime during optimization

- **Partitioning:** Create a new partitioned table, backfill in batches (by id or date range), then switch the app in a short maintenance window (rename tables or repoint).
- **Archiving:** Move or delete old rows in batches during low traffic. Apply the soft-delete or mark "archived," and move to archive asynchronously, then hard-delete from main in batches.
