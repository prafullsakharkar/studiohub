# Local AI Coding Rules

## Model

Use the configured local llama.cpp models only.

Never use:
- Claude
- Anthropic API
- OpenAI API
- cloud LLM providers

## Memory

Before starting substantial work:

1. Search project memory.
2. Check previous decisions.
3. Check known bugs and solutions.
4. Check relevant architecture decisions.

After completing substantial work:

1. Record important architectural decisions.
2. Record discovered bugs and fixes.
3. Record reusable implementation patterns.
4. Record failed approaches that should not be repeated.

## Codebase

Use Serena for:

- symbol discovery
- references
- definitions
- structural code navigation
- large refactoring
- dependency analysis

Do not blindly scan the entire repository.

## Frontend

Use Playwright for:

- UI validation
- browser errors
- console errors
- network errors
- interaction testing
- regression testing

## Documentation

Use Context7 when current library/framework documentation is required.

## Context

Use Headroom when tool output, logs, source files, or context become excessively large.

## Implementation

Before modifying code:

1. Inspect relevant files.
2. Search for existing implementation.
3. Search memory.
4. Understand dependencies.
5. Make the smallest correct change.

After modifying code:

1. Run relevant tests.
2. Run lint/type checks.
3. Test affected API endpoints.
4. Test affected UI using Playwright when applicable.

## Error Handling

Never repeatedly execute the same failed command.

After two identical failures:

1. Stop.
2. Diagnose the root cause.
3. Try a different approach.

## Completion

Do not claim a task is complete until:

- implementation exists
- tests pass
- errors are resolved
- affected functionality has been verified
