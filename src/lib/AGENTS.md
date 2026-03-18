# Lib - Agent Knowledge

**Feature:** Core Logic & Infrastructure  
**Scope:** Business logic, data layer, utilities, sync

---

## Structure

```
lib/
├── core/          # Database, config, storage utilities
├── stores/        # Zustand stores (global state)
├── brewing/       # Brewing business logic
├── equipment/     # Equipment logic
├── grinder/       # Grinder utilities
├── sync/          # Sync base classes
├── webdav/        # WebDAV sync implementation
├── s3/            # S3 sync implementation
├── supabase/      # Supabase realtime sync
├── types/         # Domain-specific types
├── hooks/         # Shared React hooks
├── utils/         # Utility functions
├── ui/            # UI utilities
├── app/           # Capacitor/native app utilities
├── audio/         # Sound playback
├── navigation/    # Routing/navigation
├── api/           # API clients
└── managers/      # Business managers
```

---

## Where to Look

| Task                | Location                  | Notes                        |
| ------------------- | ------------------------- | ---------------------------- |
| Database schema     | `core/db.ts`              | Dexie tables + migrations    |
| Add store           | `stores/`                 | Follow Zustand pattern       |
| Sync feature        | `sync/`, `webdav/`, `s3/` | Base class + implementations |
| Brewing logic       | `brewing/`                | Stage utils, parameters      |
| Native capabilities | `app/`                    | Capacitor bridge             |

---

## Key Files

### Database (`core/db.ts`)

- `BrewGuideDB` class - Dexie database definition
- `dbUtils` - Database utilities, migration helpers
- **Versions**: v1→v5 schema evolution documented
- **Migration**: Automatic from localStorage → IndexedDB

### Stores (`stores/`)

All Zustand stores with persistence:

- `coffeeBeanStore.ts` - Bean CRUD + filtering
- `brewingNoteStore.ts` - Note CRUD
- `equipmentStore.ts` - Equipment configs
- `grinderStore.ts` - Grinder settings
- `settingsStore.ts` - App settings
- `index.ts` - Store exports

### Sync Architecture

```
sync/
├── BaseSyncManager.ts    # Abstract base class
├── SyncManager.ts        # Main sync coordinator
└── types.ts              # Sync type definitions

webdav/                   # WebDAV implementation
├── webDAVClient.ts
├── syncManager.ts
└── ...

s3/                       # S3 implementation
├── s3Client.ts
├── syncManagerV2.ts
└── ...
```

---

## Conventions

### Store Pattern (Zustand)

```typescript
// stores/exampleStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ExampleState {
  data: Data[];
  add: (item: Data) => void;
}

export const useExampleStore = create<ExampleState>()(
  persist(
    set => ({
      data: [],
      add: item => set(state => ({ data: [...state.data, item] })),
    }),
    { name: 'example-storage' }
  )
);
```

### Database Pattern

- Tables defined in `db.ts` with versioned schema
- Use `db.tableName` for queries
- Migrations handle schema changes

### Utility Functions

- Pure functions in `utils/`
- React hooks in `hooks/`
- Feature-specific in feature dirs

---

## Anti-Patterns

- **Don't** import stores in server components
- **Don't** modify db schema without version bump
- **Don't** use localStorage - always use `dbUtils`
- **Don't** skip error boundaries for async operations
- **Don't** mix sync logic - follow BaseSyncManager pattern
