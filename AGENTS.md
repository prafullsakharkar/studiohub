# Roo Code Startup Instructions

## Mandatory Hindsight Memory Workflow

Hindsight MCP is the persistent project-memory system.

For **every new user prompt**, task, bug fix, refactor, investigation, or continuation of existing work, follow the Hindsight workflow below.

---

## 1. Before Doing Any Work

Before modifying files, executing commands, or proposing an implementation:

### A. Understand the request

Identify:

* What the user wants
* Which project/module is affected
* Which files or components are likely involved
* Whether this is a new task or continuation of previous work

### B. Search Hindsight Memory

Use the Hindsight MCP server to search for relevant existing project knowledge.

Search using the important concepts from the user's request:

* Feature name
* Application/module name
* Model/component name
* API endpoint
* Error message
* Technology
* Previous implementation
* Architecture decision
* Performance issue
* Known bug
* Related task

Do not perform a generic memory search if a more specific search is possible.

### C. Recall Before Acting

Review the retrieved memories and determine:

* What has already been implemented
* What decisions were previously made
* What approaches failed
* What solutions worked
* What constraints exist
* Whether the current task continues previous work

Avoid repeating previously failed approaches.

---

# 2. Search the Current Repository Too

Hindsight is persistent memory, but the repository is the current source of truth.

After retrieving relevant memory:

1. Inspect the current codebase.
2. Verify that remembered information is still correct.
3. Compare memory against the current implementation.
4. Never blindly trust stale memory.

If memory conflicts with the current repository:

```text
Current repository > Hindsight memory
```

Determine why the implementation changed.

---

# 3. During the Task

While working, continuously identify important discoveries.

Potentially useful information includes:

* Architecture decisions
* Important implementation patterns
* Database relationships
* API conventions
* Performance optimizations
* Root causes of bugs
* Successful fixes
* Failed approaches
* Configuration requirements
* Testing requirements
* Deployment requirements
* Important dependencies
* Project-specific conventions

Do not store temporary information that will not help future tasks.

---

# 4. Update Hindsight When Knowledge Changes

If existing Hindsight memory is no longer correct:

1. Identify the outdated memory.
2. Update or replace it with the correct information.
3. Preserve the reason for the change when useful.
4. Do not create duplicate memories unnecessarily.

Example:

```text
OLD:
Repository endpoints use Django ORM filtering directly in ViewSets.

NEW:
Repository endpoints use a service layer. Query construction belongs in repositories/services, while ViewSets handle HTTP concerns.
```

Store the new architectural rule rather than keeping conflicting information.

---

# 5. After Completing the Task

Before finishing, determine whether the task produced durable project knowledge.

Ask:

> Would another AI agent benefit from knowing this during a future task?

If yes, store the information in Hindsight.

Good memories include:

```text
The repository API uses select_related("owner") and prefetch_related("members") because the frontend requests nested owner/member information on every repository listing.
```

```text
The authentication middleware must run before the tenant middleware because tenant resolution depends on the authenticated user's organization.
```

```text
The previous implementation used per-object serializer queries and caused N+1 database queries. Queryset annotations were introduced to eliminate them.
```

---

# 6. Existing Task / Follow-Up Task

If the user asks:

* "continue"
* "fix this"
* "why did we..."
* "as we discussed"
* "finish the previous work"
* "optimize the same thing"
* "update the implementation"

Always search Hindsight first for the previous work.

Do not assume the previous implementation from conversation context alone.

---

# 7. New Prompt Rule

Every new prompt must trigger this sequence:

```text
USER PROMPT
    ↓
Identify task
    ↓
Search Hindsight
    ↓
Recall relevant project knowledge
    ↓
Inspect current repository
    ↓
Compare memory with current code
    ↓
Plan implementation
    ↓
Modify/test code
    ↓
Identify new durable knowledge
    ↓
Update Hindsight
    ↓
Finish task
```

This workflow is mandatory.

---

# 8. Do Not Overuse Memory

Do not store:

* Passwords
* API keys
* Access tokens
* Private keys
* Database credentials
* Secrets
* Temporary terminal output
* Large source files
* Entire logs
* One-time debugging information

Store knowledge, not raw data.

---

# 9. Memory Should Be Concise

Prefer:

```text
Django repository listing uses queryset annotations to avoid N+1 queries.
```

over:

```text
During today's debugging session we discovered that when the repository endpoint was called...
```

Memory should describe the durable fact, not the conversation.

---

# 10. Final Verification

Before completing a significant task:

* Verify the implementation.
* Run appropriate tests.
* Check for regressions.
* Check whether Hindsight contains outdated information.
* Store important new knowledge.
* Do not claim success without verification.

---

## Critical Rule

Hindsight lookup must happen **before implementation**.

Hindsight update must happen **after meaningful implementation changes**.

The repository remains the source of truth.

Hindsight provides persistent context and institutional memory.
