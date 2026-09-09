# StudioHub Backend Testing Strategy

## Test Suite Architecture
The backend test suite is structured around pytest and Django's `APITestCase`.

---

## Test Categories

### 1. Unit Tests
- Model validation and constraints.
- Service functions and state mutations.
- Custom permission evaluators.

### 2. Integration & API Contract Tests
- End-to-end API testing verifying that responses match the frontend schemas.
- Multi-tenant isolation verification: asserting that Organization A users cannot query or mutate Organization B resources.
- JWT token lifecycle tests (login, refresh rotation, blacklisting).

### 3. Running Backend Tests
```bash
python manage.py test apps
```
or with pytest:
```bash
pytest
```
