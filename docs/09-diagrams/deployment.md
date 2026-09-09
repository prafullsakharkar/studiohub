# Deployment pipeline

```mermaid
flowchart LR
  Git[Git Push] --> CI[CI Pipeline]
  CI -->|build| Image[Container Image Registry]
  Image -->|deploy| K8s[Kubernetes Cluster]
  K8s -->|runs| App[App Pods]
  K8s -->|monitor| Observability[Prometheus / Grafana]
  Observability -->|alerts| PagerDuty[PagerDuty]
```
```
