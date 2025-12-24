# Brew Guide AI Instructions

This is a coffee brewing assistant app. **It's a utility app for personal use, not a real-time collaboration tool.**

## Tech Stack

- Next.js 15 + React 19 + Tailwind CSS 4 + Capacitor
- Local-First: Dexie.js (IndexedDB) + Zustand
- Sync: WebDAV / S3 / Supabase (optional)

---

## AI Collaboration Principles

### 1. No Over-Engineering

This is a simple tool app. Before adding any abstraction, ask:

- Does this solve a real problem the user has today?
- Can this be done with 50 lines instead of 500?
- Will a junior developer understand this in 6 months?

**Bad**: Abstract factory pattern for creating coffee beans.  
**Good**: A simple function that saves to IndexedDB.

### 2. Read Before Write

Before modifying any module:

1. Read the existing code thoroughly (use grep/read_file)
2. Understand the current patterns and conventions
3. Check `docs/ARCHITECTURE.md` for context
4. If touching sync logic, read `src/lib/supabase/syncOperations.ts` header comments

### 3. Incremental Changes

- One logical change per edit
- Run `pnpm build` after significant changes to verify
- Don't refactor unrelated code while fixing a bug

### 4. Comments Should Add Value

**Bad comments** (state the obvious):

```typescript
// Check if bean exists
if (bean) { ... }

// Loop through beans
beans.forEach(bean => { ... })
```

**Good comments** (explain why, not what):

```typescript
// Soft delete: set deleted_at instead of removing from DB.
// This preserves sync history and allows undo.
await db.coffeeBeans.update(id, { deleted_at: Date.now() });
```

### 5. Consult Official Documentation

For framework-specific questions, check docs first:

- Next.js: https://nextjs.org/docs
- Supabase Realtime: https://supabase.com/docs/guides/realtime
- Dexie: https://dexie.org/docs
- Capacitor: https://capacitorjs.com/docs

Don't guess. Look it up.

---

## Architecture Overview

```
src/
├── app/              # Next.js pages
├── components/       # UI components
├── lib/
│   ├── core/         # db.ts, config.ts (foundational)
│   ├── stores/       # Zustand stores (state management)
│   ├── sync/         # Base sync logic (WebDAV, S3)
│   ├── supabase/     # Supabase sync (optional feature)
│   └── ...
├── providers/        # React context providers
└── types/            # TypeScript definitions
```

## Data Flow (Local-First)

```
Component → Zustand Store → Dexie (IndexedDB) → [Optional] Cloud Sync
                ↑
          Read from here
```

- **Read**: Components read from Zustand stores
- **Write**: Store action → Update IndexedDB → Update Zustand state
- **Sync**: Background process, not in critical path

## Module Boundaries

| Module                               | Responsibility            | Does NOT handle                  |
| ------------------------------------ | ------------------------- | -------------------------------- |
| `src/lib/core/db.ts`                 | IndexedDB schema & access | Business logic                   |
| `src/lib/stores/`                    | UI state, CRUD operations | Direct DB access from components |
| `src/lib/supabase/syncOperations.ts` | Supabase CRUD             | Realtime subscriptions           |
| `src/lib/supabase/realtime/`         | Realtime sync             | Direct store updates             |
| `src/providers/StorageProvider.tsx`  | Init sync on app start    | Sync implementation details      |

---

## Sync Architecture

The app supports multiple sync backends:

1. **WebDAV** (`src/lib/webdav/`) - File-based sync
2. **S3** (`src/lib/s3/`) - File-based sync
3. **Supabase** (`src/lib/supabase/`) - Database sync with optional realtime

**Note**: For a utility app, manual or on-launch sync is sufficient. Realtime sync adds complexity with limited benefit.

### Sync Design Decisions

- **Soft Delete**: Records have `deleted_at` field, never physically deleted
- **Last-Write-Wins**: Simple conflict resolution by timestamp
- **Cloud-Authoritative**: When in doubt, cloud data wins

---

## Common Tasks

### Adding a new field to CoffeeBean

1. Update type in `src/types/app.d.ts`
2. Update form in `src/components/coffee-bean/Form/`
3. Update detail view in `src/components/coffee-bean/Detail/`
4. If synced field, check `syncOperations.ts` field mappings

### Adding a new setting

1. Add to `AppSettings` type in `src/lib/core/db.ts`
2. Create UI component in `src/components/settings/`
3. Use `db.settings.get/put` for persistence

### Modifying sync behavior

1. Read existing code in `src/lib/supabase/syncOperations.ts` first
2. Understand the `upsertRecords` / `markRecordsAsDeleted` pattern
3. Make minimal changes, test thoroughly

---

## Developer Workflow

- **Web Dev**: `pnpm dev` (localhost:3000)
- **Build**: `pnpm build` (always verify before commit)
- **Mobile**: `pnpm cap:build` then `pnpm cap:ios` / `pnpm cap:android`
- **Server**: `cd server && pnpm dev` (port 3100)

---

## Critical Rules

1. **Always persist to Dexie** - Zustand is for UI state, Dexie is source of truth
2. **Mobile safe areas** - Use `safe-area-inset-*` for Capacitor builds
3. **Server is separate** - `server/` is its own project, never import into `src/`
4. **Build must pass** - Run `pnpm build` before considering work complete
