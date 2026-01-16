# AGENTS.md - Brew Guide

This document provides instructions for AI coding agents working in this repository.

## Project Overview

Brew Guide is a coffee brewing assistant app built with a local-first architecture.
It's a utility app for personal use, not a real-time collaboration tool.

**Tech Stack:** Next.js 15 + React 19 + Tailwind CSS 4 + TypeScript
**Platforms:** Web/PWA, iOS/Android (Capacitor), Desktop (Tauri)
**Data:** Dexie.js (IndexedDB) + Zustand, with optional cloud sync (WebDAV/S3/Supabase)

## Build/Lint/Test Commands

Package manager: **pnpm** (required)

| Command            | Description                                 |
| ------------------ | ------------------------------------------- |
| `pnpm dev`         | Start development server (localhost:3000)   |
| `pnpm build`       | Production build (ALWAYS run before commit) |
| `pnpm lint`        | Run ESLint with auto-fix                    |
| `pnpm format`      | Format code with Prettier                   |
| `pnpm cap:build`   | Build and sync with Capacitor (mobile)      |
| `pnpm cap:ios`     | Open Xcode for iOS                          |
| `pnpm cap:android` | Open Android Studio                         |
| `pnpm tauri:dev`   | Tauri desktop development                   |

**Server (in `/server`):** `pnpm dev` (port 3100) | `pnpm start`

**Testing:** No test framework configured. Server has `./test-server.sh` script.

## Project Structure

```
src/
├── app/              # Next.js App Router (pages)
├── components/       # UI components by feature
│   ├── brewing/      # Timer, visualizer, stages
│   ├── coffee-bean/  # Bean management
│   ├── notes/        # Brewing notes
│   ├── equipment/    # Equipment management
│   ├── common/       # Shared components
│   └── ui/           # Base UI components
├── lib/
│   ├── core/         # db.ts, config.ts (foundational)
│   ├── stores/       # Zustand stores (state management)
│   ├── hooks/        # Custom React hooks
│   ├── utils/        # Utility functions
│   ├── sync/         # Base sync logic
│   ├── webdav/       # WebDAV sync backend
│   ├── s3/           # S3 sync backend
│   └── supabase/     # Supabase sync + realtime
├── providers/        # React Context providers
└── types/            # TypeScript definitions
server/               # Separate Express.js backend (own package.json)
```

## Code Style Guidelines

### Formatting (Prettier)

- Semicolons required, single quotes, 2-space tabs
- Trailing commas (ES5), print width 80, avoid arrow parens

### TypeScript

- Strict mode enabled
- Path aliases: `@/*` -> `./src/*`, `@public/*` -> `./public/*`
- Prefer `unknown` over `any`

### Import Order

1. React/Next.js imports
2. Third-party libraries
3. Path-aliased imports (`@/...`)
4. Relative imports

### Naming Conventions

| Type       | Convention        | Example                       |
| ---------- | ----------------- | ----------------------------- |
| Components | PascalCase        | `LightToast.tsx`, `BeanCard`  |
| Hooks      | camelCase + `use` | `useBrewingState`, `useBeans` |
| Utilities  | camelCase         | `beanRatingUtils.ts`          |
| Types      | PascalCase        | `CoffeeBean`, `BrewingNote`   |
| Constants  | SCREAMING_SNAKE   | `TOAST_DURATION`, `MAX_ITEMS` |

### Component Pattern

```typescript
'use client';

import { useState } from 'react';

interface Props {
  title: string;
  onClose?: () => void;
}

export function MyComponent({ title, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  // ...
}
```

### ESLint Rules (Key)

- `@typescript-eslint/no-unused-vars`: error (allows `_` prefix)
- `@typescript-eslint/no-explicit-any`: warn
- `react/jsx-no-bind`: warn (no inline functions in JSX)
- `no-console`: warn (allows `console.warn`, `console.error`)

## Data Architecture

```
Component → Zustand Store → Dexie (IndexedDB) → [Optional] Cloud Sync
                ↑
          Read from here
```

### Key Patterns

- **Soft Delete**: Use `deleted_at` field, never physically delete
- **Last-Write-Wins**: Simple conflict resolution by timestamp
- **Store Pattern**: Store action -> Update IndexedDB -> Update Zustand state

## Critical Rules

1. **Always persist to Dexie** - Zustand is for UI state, Dexie is source of truth
2. **Build must pass** - Run `pnpm build` before considering work complete
3. **Mobile safe areas** - Use `safe-area-inset-*` for Capacitor builds
4. **Server is separate** - `server/` is its own project, never import into `src/`
5. **Read before write** - Understand existing patterns before modifying

## AI Collaboration Principles

### No Over-Engineering

This is a simple utility app. Before adding abstractions, ask:

- Does this solve a real problem today?
- Can this be done with 50 lines instead of 500?
- Will a junior developer understand this in 6 months?

### Incremental Changes

- One logical change per edit
- Run `pnpm build` after significant changes
- Don't refactor unrelated code while fixing a bug

### Comments Should Add Value

**Bad:** `// Check if bean exists` before `if (bean) { ... }`

**Good:**

```typescript
// Soft delete: set deleted_at instead of removing from DB.
// This preserves sync history and allows undo.
await db.coffeeBeans.update(id, { deleted_at: Date.now() });
```

## Common Tasks

### Adding a field to CoffeeBean

1. Update type in `src/types/app.d.ts`
2. Update form in `src/components/coffee-bean/Form/`
3. Update detail view in `src/components/coffee-bean/Detail/`
4. If synced, check `syncOperations.ts` field mappings

### Adding a new setting

1. Add to `AppSettings` type in `src/lib/core/db.ts`
2. Create UI in `src/components/settings/`
3. Use `db.settings.get/put` for persistence

## Documentation References

- Next.js: https://nextjs.org/docs
- Supabase Realtime: https://supabase.com/docs/guides/realtime
- Dexie: https://dexie.org/docs
- Capacitor: https://capacitorjs.com/docs
