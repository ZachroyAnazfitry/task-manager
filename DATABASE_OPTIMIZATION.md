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

**Recommendation:** I prefer the SQL table for consistency and simplicity. Redis will be used only if latency is critical and to maintain a separate cache or write to both SQL and Redis (dual-write).

### B3. Data retention (only keep last 50 items)

- **In the application:** After each view (upsert on `user_id` + `product_id`, set `viewed_at = NOW()`), delete older rows so only the 50 most recent remain for that user. Do this in the same request or in a background task.
- **Scheduled job:** Run a periodic job (e.g. hourly) that, per user or in batches, deletes all but the 50 most recent rows; simpler for the app but the table may briefly hold more than 50 per user.
- **NoSQL (e.g. Redis):** Push the new view onto the list and trim to 50 (e.g. LTRIM); no separate retention step.

### B4. API endpoint design

To **record a view**, expose `POST /api/users/me/recent-views` with body `{ "product_id": "<uuid>" }` or `POST /api/products/:id/view` (product from path; user from auth). The operation should be idempotent: the same (user, product) updates `viewed_at` (upsert). Return 204 or 200 with a minimal body. To **get recent views** for the homepage, expose `GET /api/users/me/recent-views?limit=50`, which returns a list of recently viewed products, most recent first. Example response shape:

```json
[
  { "product_id": "uuid", "name": "...", "price": 9.99, "viewed_at": "2025-02-19T12:00:00Z" },
  ...
]
```

The backend joins `user_product_views` with `products` and orders by `viewed_at DESC`, limiting to 50. Optionally, `GET /api/products/:id` can record a view as a side effect when the product is fetched, or the client can call the dedicated view endpoint when the product page is opened.

---

## C. Real-World Problem (10 min) – Orders table at 10M rows

### C1. Improve query performance

Ensure **indexes** match access patterns: e.g. `(user_id, created_at)` for "orders by user," `(status, created_at)` for "recent completed orders," and composites that match WHERE/ORDER BY/JOIN in the application. Use `EXPLAIN (ANALYZE, BUFFERS)` to find sequential scans and add or adjust indexes. **Partitioning** `orders` by `created_at` (e.g. range by month or quarter) means queries that filter by date only touch the relevant partition(s), reducing I/O and lock scope. For **query tuning**, select only needed columns, avoid SELECT *, ensure joins use indexed columns, and consider covering indexes for read-heavy queries. Run reporting and heavy analytical queries on a **read replica** so the primary handles writes and critical reads only. For frequent reports (e.g. orders by day, totals by user), maintain **pre-aggregated tables or materialized views** refreshed by a job.

### C2. Archive old data while keeping it accessible

Move old orders (e.g. `created_at` older than 2 years) to an **archive table** (`orders_archive`) with the same schema, in the same database or a dedicated archive database. The application can route "recent" queries to the main table and "full history" or reporting to a UNION of main and archive, or to the archive when the date range is known to be old. If `orders` is range-partitioned by date, **detach** old partitions and attach them to an archive schema or read-only archive DB; recent queries then hit only the active partition(s), and old data remains queryable from the archive. For **cold storage**, export old partitions or batches to object storage (e.g. Parquet or CSV) for analytics or compliance. "Accessible" then means queryable via an archive DB or restorable/queryable from cold storage for ad-hoc analysis, rather than in the primary hot path.

### C3. Ensure minimal downtime during optimization

In PostgreSQL, create new **indexes** with `CREATE INDEX CONCURRENTLY ...` so the table remains writable and the index is built in the background; avoid long-running `CREATE INDEX` without CONCURRENTLY, which can lock the table. For **partitioning**, create a new partitioned table, backfill in batches (e.g. by id or created_at ranges), then switch the application in a short maintenance window (e.g. rename tables or point to the new table). Alternatively, adopt native partitioning and migrate in chunks, using a small maintenance window for the final cutover. When **archiving**, move or delete old rows in batches (e.g. by order id or created_at range) during low traffic, and avoid a single large DELETE that holds locks for a long time. Optionally use a soft-delete or "archived" flag and move data asynchronously to the archive, then hard-delete from the main table in batches. Apply schema changes and long-running data migrations on a replica then promote or fail over, or schedule a short maintenance window with a clear rollback plan (e.g. keep the old table until the new one is verified).
