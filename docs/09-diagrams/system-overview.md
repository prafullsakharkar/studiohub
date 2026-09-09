# System overview

```mermaid
flowchart TD
  subgraph Client
    UI[Web / Mobile UI]
  end

  subgraph Edge
    CDN[CDN]
    LB[Load Balancer]
  end

  subgraph API
    API[API Gateway]
    Auth[Auth Service]
  end

  subgraph Services
    Backend[Backend Services]
    Worker[Background Workers]
  end

  subgraph Data
    DB[(Postgres / Primary DB)]
    Cache[(Redis / Cache)]
    Broker[(Event Broker)]
  end

  UI -->|HTTPS| CDN --> LB --> API
  API -->|auth| Auth
  API -->|REST / gRPC| Backend
  Backend --> DB
  Backend --> Cache
  Backend --> Broker
  Broker --> Worker
  Worker --> DB
```
```
