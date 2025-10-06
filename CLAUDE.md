# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Use bun for all commands** - This project uses bun as the preferred runtime/package manager.

### Build & Type Checking
- `bun run build` - Build the project
- `bun run typecheck` - Type check without emitting files
- **Do not run** `bun run dev` or `bun run start:dev` - these start long-running servers

### Linting
- `bun run lint` - Check code style
- `bun run lint:fix` - Auto-fix linting issues

### Testing
- Test manually with your own Raindrop.io account
- Use `RAINDROP_TOKEN` environment variable for authentication

## Architecture

### Single-File MCP Server
All code is in `src/index.ts` (~1200 lines). The file contains:

1. **Helper Functions** (lines 34-175)
   - `cleanTitle()` / `cleanTitlesInData()` - Remove quote artifacts from API responses
   - `safeJsonParse()` - Preprocess JSON for field parameters (handles both strings and arrays)
   - `filterFields()` / `filterApiResponse()` - Apply field filtering after API calls

2. **RaindropClient Class** (lines 177-369)
   - Wraps Raindrop.io REST API calls
   - All methods return data through `handleResponse()` which cleans titles
   - Methods: Collections, Raindrops, Search, Tags, Highlights, URL utilities

3. **MCP Tool Registrations** (lines 379-1186)
   - Each tool follows pattern: `server.registerTool(name, { title, description, inputSchema }, handler)`
   - All tools use Zod for input validation
   - All tools have consistent error handling

### Field Filtering System
- **Presets** defined in `FIELD_PRESETS` constant (line 23-30):
  - `minimal`, `basic`, `standard`, `media`, `organization`, `metadata`
- **Custom arrays**: e.g., `["_id", "title", "link"]`
- **Empty array** `[]` returns only metadata, no items
- Field filtering applied via `filterApiResponse()` after API calls

### Data Processing Pipeline
1. API call through `RaindropClient`
2. Response goes through `handleResponse()` → `cleanTitlesInData()`
3. Field filtering applied via `filterApiResponse()` if `fields` parameter provided
4. Return JSON string to MCP client

## Important Patterns

### Adding New Tools
1. Use `server.registerTool()` pattern
2. Define input schema with Zod (use `z.preprocess(safeJsonParse, ...)` for JSON arrays)
3. Wrap in try/catch with consistent error format
4. Apply field filtering if tool returns raindrop/collection data
5. Support `minimal: true` for create/update/delete operations

### JSON Preprocessing
Use `safeJsonParse` in `z.preprocess()` for parameters that accept both preset strings and JSON arrays:
```typescript
fields: z.preprocess(
  safeJsonParse,
  z.union([
    z.enum(["minimal", "basic", "standard"]),
    z.array(z.string())
  ])
).optional()
```

### Security
- Never commit `RAINDROP_TOKEN` or any API tokens
- Token must be provided via environment variable
- Server exits if `RAINDROP_TOKEN` not set

## Special Collection IDs
- `0` - All bookmarks (except Trash)
- `-1` - Unsorted bookmarks
- `-99` - Trash

## Commit Conventions
Follow conventional commits (enforced by commitlint):
- `feat:` - new features
- `fix:` - bug fixes
- `docs:` - documentation
- `chore:` - maintenance tasks
- `security:` - security improvements

Semantic release is configured and will auto-publish to npm on merge to master.

## Code Style (ESLint)
- Use double quotes
- Always use semicolons
- Prefix unused variables with `_`
- No console logs in production code (console.error is OK)
