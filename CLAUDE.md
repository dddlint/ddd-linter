# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Test Commands
- Run all tests: `npm test`
- Run a single test: `npm test -- -t "test name pattern"`
- Lint code: `npm run lint`
- Type check: `npm run typecheck`
- Build: `npm run build`

## Code Style Guidelines
- Use TypeScript for type safety
- Follow ESLint and Prettier configuration
- Imports: group imports by external/internal/relative
- Naming: camelCase for variables/functions, PascalCase for classes/interfaces
- Domain concepts should follow glossary terms exactly
- Error handling: use Result type pattern when appropriate
- Prefer functional programming patterns
- Document public APIs with JSDoc comments
- Use meaningful variable names reflecting domain concepts