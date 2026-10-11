---
applyTo: "backend/**/*.{js,ts}"
---

# Backend Conventions

## Endpoint Structure
- Inspect existing routes, controllers, services, repositories, and middleware before adding endpoints.
- Follow the exact architectural pattern already used by the project.
- Register new endpoints in the appropriate existing router.
- Follow existing URL naming, HTTP methods, API versioning, and resource naming conventions.
- Reuse existing authentication, authorization, validation, and error-handling middleware.
- Never create a parallel endpoint structure when an established structure exists.

## Request and Response
- Match existing request validation and response formats.
- Reuse existing response helpers and error classes.
- Follow existing HTTP status code conventions.
- Preserve established pagination, filtering, sorting, and search formats.
- Never invent a new response envelope without a clear requirement.

## Database
- Follow existing PostgreSQL query, ORM, and repository patterns.
- Reuse existing models, relationships, and database utilities.
- Use parameterized queries. Never concatenate untrusted input into SQL.
- Follow existing transaction and migration conventions.
- Avoid N+1 queries and preserve data integrity.

## Security
- Apply the project's existing authentication and authorization rules.
- Validate and sanitize inputs according to established conventions.
- Never expose secrets, sensitive data, or internal error details.
- Do not weaken existing security controls.

## Before Implementation
- Find a similar endpoint and use it as the reference.
- Identify the files that need modification before coding.
- Reuse existing patterns and change only what is necessary.
- Update API documentation and tests using existing conventions.