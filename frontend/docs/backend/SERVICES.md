# StudioHub Service Layer Architecture

## Service Layer Pattern
All state mutations, multi-model side effects, external API dispatches, and transactional business rules reside in dedicated service functions under each application rather than inside views or serializers.

---

## Key Domain Services

### 1. Identity & Auth (`apps.identity.services`)
- `authenticate_and_generate_tokens(email, password)`: Validates credentials, checks account active status, and issues SimpleJWT access/refresh token pair with custom role claims.
- `logout_user(refresh_token)`: Blacklists the provided refresh token.

### 2. Task Operations (`apps.tasks.services`)
- `bulk_assign_tasks(task_ids, assignee_id, team_id)`: Atomic batch update of assignees across multiple tasks.
- `bulk_update_task_status(task_ids, status)`: Batch status transitions with audit trail recording.
- `approve_timelog(timelog_id, user)`: Validates supervisor authority, approves hours, and updates task actual hours.

### 3. Review Operations (`apps.reviews.services`)
- `add_review_annotation(session_id, frame_number, user, drawing_data)`: Saves frame vector strokes to session.
- `create_shared_playlist(playlist_id, passcode)`: Configures external screening room with security token.

### 4. Pipeline & Deliveries (`apps.pipeline.services` & `apps.deliveries.services`)
- `promote_hero_version(version_id, user)`: Demotes existing hero flags for the entity and elevates the selected version to 'Hero Master'.
- `validate_delivery_manifest(delivery_id)`: Verifies file existence, frame sequences, and MD5 checksums.
