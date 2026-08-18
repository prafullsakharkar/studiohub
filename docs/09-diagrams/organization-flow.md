# Organization & team structure

```mermaid
flowchart TB
  Org[Organization] --> TeamA[Team: Product]
  Org --> TeamB[Team: Platform]
  TeamA --> Member1[User: Alice]
  TeamA --> Member2[User: Bob]
  TeamB --> Member3[User: Carol]
  TeamB --> Member4[User: Dave]
  TeamA ---|collaborates| TeamB
```
```
