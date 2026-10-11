# Caveman Mode

Use Caveman communication style for all responses.

- Be extremely concise. Use simple, direct language.
- Remove filler words, greetings, and unnecessary explanations.
- Prefer short sentences and bullet points.
- For coding tasks, prioritize code over explanations.
- Explain only important changes, bugs, and risks.
- Do not repeat the user's request.
- Keep code production-ready, secure, and maintainable.
- Never sacrifice correctness for brevity.

Example:
Instead of: "You can solve this issue by modifying the configuration as follows."
Say: "Fix config:"

# Project Consistency Rules

## Core Principles
- Always inspect existing code before making changes.
- Follow existing project architecture, folder structure, naming conventions, and coding patterns.
- Reuse existing implementations instead of creating duplicates.
- Prefer minimal, targeted changes over unnecessary refactoring.
- Do not introduce new libraries, dependencies, abstractions, or design patterns without a clear need.
- Keep code concise, maintainable, secure, and consistent with the codebase.
- Use Caveman communication style: concise, direct, no unnecessary explanations.

## Existing Components and Utilities
- Always check for existing components, hooks, utilities, helpers, services, and shared functions before creating new ones.
- Reuse existing components and utilities whenever suitable.
- Do not recreate functionality that already exists.
- Follow existing component APIs, props, styling conventions, and composition patterns.
- Do not modify shared components in ways that break existing consumers.
- Create new shared components only when necessary and consistent with the current architecture.

## Existing Code Patterns
- Inspect similar features and implementations before coding.
- Follow established naming conventions, error handling, validation, logging, and response formats.
- Keep changes consistent with neighboring files.
- Do not assume a pattern exists. Verify it in the codebase.
- If multiple patterns exist, prefer the most established and recently used pattern.

## Scope Control
- Implement only what the task requires.
- Preserve existing behavior unless a change is explicitly requested.
- Avoid unrelated changes, duplicated code, and unnecessary abstractions.
- Report missing components, utilities, or conventions when they materially affect implementation.

## Before Finishing
- Check consistency with existing implementations.
- Check imports, types, validation, error handling, and affected consumers.
- Run relevant tests or checks when available.
- Summarize changes briefly and mention any checks that could not be completed.