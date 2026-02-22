# SYSTEM_DESIGN.md

**Task 2: System Design** – Notification service (architecture, scalability, trade-offs).

This document presents a standalone design for a notification service that could be implemented in any stack (e.g. Laravel, Node.js, Go) and could serve applications such as a task manager, billing system, or any product requiring multi-channel notifications.

---

## Scenario

Design a notification service that:

- Sends notifications via **email**, **SMS**, **push**, and **in-app**
- Handles **100,000+ notifications per day**
- Supports **scheduled notifications** (send later)
- **Tracks delivery status** and **retries failed deliveries**
- **Scales to 1M+ notifications per day** within 6 months

---

## A. Architecture Design

### A1. High-level system diagram

```mermaid
flowchart TB
  subgraph producers [Producers]
    App1[Application 1]
    App2[Application 2]
  end

  subgraph ingestion [Ingestion]
    API[Notification API]
  end

  subgraph queue [Message Queue]
    MQ[(Queue / SQS / Redis)]
  end

  subgraph scheduler [Scheduling]
    Sched[Scheduler]
  end

  subgraph workers [Workers]
    W1[Worker]
    W2[Worker]
  end

  subgraph channels [Channel Providers]
    Email[Email Provider]
    SMS[SMS Provider]
    Push[Push Provider]
  end

  subgraph storage [Storage]
    DB[(Database)]
  end

  App1 --> API
  App2 --> API
  API --> MQ
  API --> DB
  Sched --> MQ
  MQ --> W1
  MQ --> W2
  W1 --> Email
  W1 --> SMS
  W1 --> Push
  W1 --> DB
  W2 --> Email
  W2 --> SMS
  W2 --> Push
  W2 --> DB
```

**Flow:** Producers (e.g. task app, billing app) call the Notification API with immediate or scheduled requests. The API validates, persists metadata, and enqueues a job (or the Scheduler enqueues due jobs). Workers consume from the queue, load the notification and recipient, call each channel provider (email, SMS, push), and write in-app rows to the database. They update delivery status after each channel. The database stores notification metadata, scheduling intent, and per-channel delivery status.

### A2. Key components and their responsibilities

| Component | Responsibility |
| --------- | -------------- |
| **Notification API** | Accept create/schedule requests; validate payload and recipient; enqueue job or write to scheduler store; return notification ID for status tracking; expose GET status and optional list by user. |
| **Scheduler** | For "send at" time: either enqueue with queue delay (e.g. SQS message timer, Redis TTL) or a cron that queries due notifications and enqueues jobs. Keeps "when to send" separate from the API request path. |
| **Queue** | Decouple producers and workers; absorb traffic spikes; support retries and dead letter queue (DLQ). Durable so messages are not lost on worker crash. |
| **Worker(s)** | Dequeue job; load notification and recipient; for each channel (email, SMS, push, in-app), call the provider or write to DB; update delivery status; on failure, retry with backoff or send to DLQ. |
| **Delivery status store** | Persist per-channel status (pending, sent, failed, retrying) and timestamps. Enables "track delivery status" and "retry failed deliveries" flows; supports idempotency. |
| **Channel providers** | External: SendGrid/Resend (email), Twilio (SMS), FCM/OneSignal (push). In-app: own database table read by clients (poll or subscribe). |

### A3. Database schema design

**Entity relationship diagram**

```mermaid
erDiagram
    NOTIFICATIONS ||--o{ NOTIFICATION_DELIVERIES : "has"
    NOTIFICATIONS ||--o| IN_APP_NOTIFICATIONS : "may have"

    NOTIFICATIONS {
        uuid id PK
        bigint user_id
        string type
        json channels
        json payload
        timestamp scheduled_at
        string status
        string idempotency_key
        timestamp created_at
        timestamp updated_at
    }

    NOTIFICATION_DELIVERIES {
        uuid id PK
        uuid notification_id FK
        string channel
        string status
        string external_id
        timestamp sent_at
        text failure_reason
        int retry_count
        timestamp created_at
        timestamp updated_at
    }

    IN_APP_NOTIFICATIONS {
        uuid id PK
        bigint user_id
        uuid notification_id FK
        string title
        text body
        timestamp read_at
        timestamp created_at
    }
```

**notifications** (core table)

| Column | Type | Description |
| ------ | ---- | ----------- |
| `id` | UUID / bigint | Primary key |
| `user_id` | UUID / bigint | Recipient (or tenant id) |
| `type` | VARCHAR | e.g. `task_reminder`, `payment_receipt` |
| `channels` | JSON / enum | `["email", "sms", "push", "in_app"]` |
| `payload` | JSON | `title`, `body`, `link`, etc. |
| `scheduled_at` | TIMESTAMP nullable | When to send; null = immediate |
| `status` | VARCHAR | `pending`, `processing`, `completed`, `failed` |
| `idempotency_key` | VARCHAR unique nullable | Avoid duplicate sends |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**notification_deliveries** (per-channel tracking)

| Column | Type | Description |
| ------ | ---- | ----------- |
| `id` | UUID / bigint | Primary key |
| `notification_id` | FK → notifications | |
| `channel` | VARCHAR | `email`, `sms`, `push`, `in_app` |
| `status` | VARCHAR | `pending`, `sent`, `failed` |
| `external_id` | VARCHAR nullable | Provider message ID |
| `sent_at` | TIMESTAMP nullable | |
| `failure_reason` | TEXT nullable | |
| `retry_count` | INT default 0 | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**in_app_notifications** (optional; or fold into a single notifications table with `channel = in_app` and `read_at`)

| Column | Type | Description |
| ------ | ---- | ----------- |
| `id` | UUID / bigint | Primary key |
| `user_id` | FK | |
| `notification_id` | FK → notifications | |
| `title` | VARCHAR | |
| `body` | TEXT | |
| `read_at` | TIMESTAMP nullable | |
| `created_at` | TIMESTAMP | |

**Indexes**

- `notifications`: `(user_id, created_at)` for listing by user; `(status, scheduled_at)` for scheduler; `(idempotency_key)` unique.
- `notification_deliveries`: `(notification_id, channel)` for lookup; `(status)` for "retry failed" queries.

The same concepts (notification, per-channel delivery, in-app) can be mapped to a NoSQL model if needed; see Trade-offs (C2).

### A4. Technology stack recommendations with justifications

| Layer | Recommendation | Justification |
| ----- | -------------- | -------------- |
| **API** | Any stateless stack (Node.js, Laravel, Go) | Stateless so it scales horizontally; only validates and enqueues, no heavy work in the request path. |
| **Queue** | Redis (Bull/Sidekiq) or AWS SQS | Durable; supports delay (Redis TTL or SQS message timer). SQS is fully managed; Redis is fast and simple to run. |
| **Workers** | Same language as API or separate (e.g. Go for throughput) | Long-running processes that pull from queue and call providers; scale by adding worker instances. |
| **Database** | PostgreSQL or MySQL | Relational model fits notifications (user, status, channels); ACID for status updates; strong indexing for "due scheduled" and "failed to retry." |
| **Email** | SendGrid, Resend, or AWS SES | Deliverability and compliance (SPF, DKIM); no need to run SMTP. |
| **SMS** | Twilio or AWS SNS | Reliability, global coverage; pay-per-use. |
| **Push** | FCM (free) or OneSignal | Device token management and delivery handled by provider. |
| **Scheduling** | Queue delay or scheduler process | Avoids blocking the API; clear separation of "when to send" vs "send now." |

### A5. Reliability: retries, dead letter queue

- **Retries:** The worker catches provider errors (4xx/5xx, rate limits), retries with exponential backoff (e.g. 1 min, 5 min, 15 min), and enforces a max attempt count (e.g. 3–5). After each attempt, update `notification_deliveries.status` and `retry_count`.
- **Dead letter queue (DLQ):** After max retries, move the job to a DLQ (or mark the delivery as `failed` and optionally store in a `failed_notifications` table). A separate process or manual intervention can inspect, alert, or re-enqueue for retry.
- **Idempotency:** Use `idempotency_key` (or notification ID + channel) when calling providers so duplicate jobs do not cause double-sends.
- **At-least-once delivery:** Process the job once, then update status. If a worker crashes after sending but before updating, another worker may retry the same job; idempotency at the provider (or idempotency_key) prevents duplicate side effects.

---

## B. Scalability & Performance

### B1. Scale from 100K to 1M+ notifications per day

- **Queue:** Move from a single Redis instance to Redis Cluster or to SQS; partition by tenant or priority if needed to avoid hot keys.
- **Workers:** Add more worker instances (horizontal scaling). Use a dedicated queue for notifications so notification jobs do not block other application work.
- **Database:** Introduce read replicas for status and list APIs; keep writes on the primary. Add the indexes described in A3; consider partitioning the notifications table by time or user_id if it grows very large.
- **Channels:** Use provider bulk or async APIs where available (e.g. SendGrid batch); consider batching small payloads to reduce per-message overhead.
- **Rate limits:** Respect provider limits (Twilio, SendGrid); use per-provider queues or client-side throttling so one channel does not block others.

### B2. Traffic spike: 50K notifications in 5 minutes

- **Queue as buffer:** All requests are enqueued immediately; the API responds quickly with "accepted" and a notification ID. Workers drain the queue; the API layer never has to process 50K sends.
- **Auto-scaling workers:** Scale worker count based on queue depth (e.g. SQS metrics + Auto Scaling Group, or Kubernetes HPA). As depth increases, add workers; as it drains, scale down.
- **Backpressure:** If queue depth exceeds a threshold, the API can return 503 or "scheduled for later" so clients know the system is under load and can back off or retry.
- **Provider limits:** Proactively throttle outbound calls to each provider (e.g. 100 req/s per provider) so the system does not get blocked; excess jobs remain in the queue and are processed as capacity allows.

### B3. High availability and fault tolerance

- **Stateless API and workers:** No in-memory state; any instance can serve any request or job. Enables rolling deploys and replacement of failed instances without losing work.
- **Queue durability:** Use a durable queue (SQS, or Redis with AOF); messages are not lost on worker crash.
- **Database:** Primary plus replicas; automated failover if supported by the chosen DB. Regular backups and point-in-time recovery.
- **Multi-region (optional):** For 1M+/day or global latency, add a second region with its own queue and workers; route by tenant or use a global queue with regional workers.
- **Health checks:** API and workers expose health endpoints; the orchestrator (e.g. Kubernetes, ECS) restarts unhealthy processes.

---

## C. Trade-offs

### C1. In-house vs third-party (SendGrid, Twilio, AWS SNS)

- **Third-party (recommended for most):** Faster to ship; deliverability (email), compliance (SMS), and push infrastructure are handled by the provider; pay-per-use; less operational burden. Trade-off: vendor lock-in, cost at very high volume, dependency on the provider’s SLA.
- **In-house:** Full control, no per-message fee at scale, custom logic. Trade-off: you operate SMTP, SMS gateways, and push infrastructure; deliverability and compliance are your responsibility; higher ops and time to market.
- **Recommendation:** Use third-party services for email, SMS, and push; build in-house only the orchestration (API, queue, workers, delivery status database). That balances speed, cost, and reliability for 100K–1M notifications per day.

### C2. SQL vs NoSQL for this use case

- **SQL (recommended):** Notifications are structured (user, type, status, channels); queries like "due scheduled," "failed by channel," and "list by user" are natural; transactions for status updates; indexes for time-range and user. Fits the relational model well.
- **NoSQL:** A document store could hold notification payloads; a wide-column or time-series store could hold delivery events. Benefit: flexible schema, good for very high write volume and append-only logs. Trade-off: fewer ad-hoc queries, eventual consistency; more work to implement "retry failed" and reporting.
- **Recommendation:** Use SQL for core notifications and delivery status; consider NoSQL only for high-volume event logs (e.g. delivery events) if you outgrow SQL write capacity.

### C3. Synchronous vs asynchronous processing

- **Asynchronous (recommended):** The API enqueues and returns immediately; workers send in the background. Benefits: low API latency, absorbs spikes, retries and DLQ are natural. Trade-off: eventual consistency; the client must poll status or use webhooks to know when a notification was delivered.
- **Synchronous:** The API calls the provider and returns only after send. Benefits: simple, immediate feedback. Trade-off: API latency and fragility under load; provider latency or failure blocks the request; does not scale to 100K+/day in a single service.
- **Recommendation:** Use fully asynchronous processing for sending; optionally provide a synchronous "dry run" or "validate only" endpoint that does not send but validates payload and recipient.
