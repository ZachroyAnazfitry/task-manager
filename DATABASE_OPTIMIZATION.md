# DATABASE_OPTIMIZATION.md

**Task 3: Database & Performance Optimization** – Query optimization, design challenges, real-world problems.

This document provides a standalone answer for the database and performance optimization task. It uses the given PostgreSQL schema and addresses the report query, the "Recently Viewed Products" design challenge, and the real-world problem of a large orders table.

---

## Scenario

The following PostgreSQL schema is used for the questions below:

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    total_amount DECIMAL(10, 2),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    category VARCHAR(100),
    price DECIMAL(10, 2),
    stock_quantity INTEGER
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY,
    order_id UUID REFERENCES orders(id),
    product_id UUID REFERENCES products(id),
    quantity INTEGER,
    price DECIMAL(10, 2)
);
```

---

## A. Query Optimization (30 min)

### A1. SQL query for the report

**Requirement:** Generate a report showing the top 10 users by total spending in the last 30 days, including user details, total number of orders, and total amount spent.

Using `orders.total_amount` as the source of truth for spending (simplest and aligned with "total amount" in the schema):

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

If the business defines "total spending" from line items instead of `orders.total_amount`, use a subquery or join to `order_items` and aggregate `SUM(oi.quantity * oi.price)` per order, then per user; the report shape (user details, order count, total spent) stays the same, with the SUM coming from `order_items`.

### A2. Indexes to optimize the query

On **orders**, create a composite index on `(created_at, user_id)` or `(user_id, created_at)` so the database can efficiently filter by the last 30 days and group by user without a full table scan. If most reports filter by `status`, add a composite such as `(status, created_at)` or include `status` in the composite (e.g. `(status, created_at, user_id)`). The composite index on orders already supports the join to `users`; if you use `(created_at, user_id)`, the join on `user_id` is still efficient. A standalone index on `orders(user_id)` is redundant if the composite starts with or includes `user_id`. On **users**, the primary key is already indexed, so no additional index is needed for the join.

Together, these indexes allow the database to narrow orders by date range (and optionally status), then aggregate by user, without scanning the entire orders table.

### A3. Further strategies if the query is still slow with millions of records

A **materialized view** can pre-aggregate "user spending in last 30 days" (e.g. user_id, total_orders, total_spent, last_refreshed) and be refreshed periodically (e.g. hourly via cron or a scheduled job). The report then reads from the materialized view instead of joining and aggregating the full orders table. **Partitioning** `orders` by `created_at` (e.g. by month or quarter) means the report only scans the partition(s) that cover the last 30 days, reducing I/O and lock contention. Alternatively, maintain a **summary table** (e.g. `user_spending_30d`) updated by the application or a batch job with one row per user and a rolling 30-day total; the report reads from this small table. Running this report (and other heavy reads) on a **read replica** lets the primary database focus on transactional workload. If real-time accuracy is not required, **caching** the top-10 result (e.g. in Redis or application memory) with a short TTL (e.g. 5–15 minutes) further reduces load.

---

## B. Design Challenge (20 min) – Recently Viewed Products

**Requirement:** For each user, store the last 50 products they viewed, track when they viewed each product, and support fast queries for the homepage.

### B1. Database schema changes

**SQL approach (primary):** Add a table to record product views per user with a timestamp. Use "move to front on re-view" semantics: when a user views a product they have already viewed, update `viewed_at` so it becomes the most recent. That implies one row per (user, product) with a current timestamp.

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

To enforce "last 50" per user, the application (or a scheduled job) keeps only the 50 most recent rows per user (see B3). The index `(user_id, viewed_at DESC)` makes "fetch last 50 for user" and "find oldest view for this user" efficient.

**Alternative (NoSQL):** Use a per-user structure (e.g. Redis LIST or a document store) holding an ordered list of `{ product_id, viewed_at }` with at most 50 entries. On each view, push the entry (or update position if re-view) and trim to 50. This gives very fast reads and writes and natural "last N" semantics without deletes in SQL.

### B2. SQL vs NoSQL (or both) and why

**SQL** fits an existing PostgreSQL stack: it is easy to JOIN with `products` for the homepage (product name, price, image), and it provides ACID and a single place for analytics. The trade-off is that the application or a job must enforce "last 50" (deletes or pruning), and high view volume can mean many updates or deletes per user. **NoSQL (e.g. Redis)** offers very low latency reads and writes, and "last N" is natural (e.g. LPUSH + LTRIM). The trade-off is a separate store to operate and optionally sync to the main DB for analytics, and eventual consistency if you dual-write. As a recommendation, use the SQL table above for consistency with the rest of the schema and simpler operations; consider Redis or similar if homepage latency is critical and you accept maintaining a cache or dual-write.

### B3. Data retention (only keep last 50 items)

**In the application**, after inserting or updating a view (e.g. upsert on `(user_id, product_id)` setting `viewed_at = NOW()`), run a delete that keeps only the 50 most recent rows for that user—for example, delete rows where `(user_id, viewed_at)` is not in the current top 50 (using a subquery or CTE with `ORDER BY viewed_at DESC LIMIT 50`). This can be done in the same request or asynchronously. A **scheduled job** can periodically (e.g. daily or hourly), for each user or in batches, delete all but the 50 most recent rows per user; this reduces complexity in the request path but can leave temporarily more than 50 rows per user. A **trigger** could enforce the cap on INSERT/UPDATE, but for "last 50" it is more complex and can slow down writes, so the application or job is usually clearer. In a **NoSQL** setup, when adding a view you push to the list and trim to 50 (e.g. LTRIM 0 49), with no separate retention step.

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
