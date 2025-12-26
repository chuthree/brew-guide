# Project Structure

```
brew-guide/
├── src/                    # Main application source
│   ├── app/                # Next.js App Router pages
│   ├── components/         # React components
│   ├── lib/                # Core logic, utilities, stores
│   ├── providers/          # React Context providers
│   ├── styles/             # Global CSS and fonts
│   └── types/              # TypeScript declarations
├── server/                 # Backend API server (Express)
├── public/                 # Static assets
├── ios/                    # Capacitor iOS project
├── android/                # Capacitor Android project
├── src-tauri/              # Tauri desktop app (Rust)
├── docs/                   # Documentation
└── scripts/                # Build scripts
```

## Source Code Organization (`src/`)

### `src/components/`

| Directory      | Purpose                                     |
| -------------- | ------------------------------------------- |
| `brewing/`     | Timer, pour visualizer, stage controls      |
| `coffee-bean/` | Bean list, detail, forms, ratings, sharing  |
| `notes/`       | Brewing notes CRUD and sharing              |
| `equipment/`   | Equipment management                        |
| `method/`      | Brewing method selection                    |
| `settings/`    | Settings UI components                      |
| `common/`      | Shared components (modals, forms, feedback) |
| `ui/`          | Base UI primitives                          |
| `layout/`      | Page layout components                      |
| `onboarding/`  | New user onboarding flow                    |

### `src/lib/`

| Directory     | Purpose                                            |
| ------------- | -------------------------------------------------- |
| `core/`       | Database (`db.ts`), config, storage utilities      |
| `stores/`     | Zustand stores (beans, notes, equipment, settings) |
| `hooks/`      | Custom React hooks                                 |
| `utils/`      | Utility functions                                  |
| `sync/`       | Sync base classes and interfaces                   |
| `webdav/`     | WebDAV sync implementation                         |
| `s3/`         | S3-compatible sync implementation                  |
| `supabase/`   | Supabase realtime sync                             |
| `api/`        | API client functions                               |
| `brewing/`    | Brewing business logic                             |
| `equipment/`  | Equipment utilities                                |
| `grinder/`    | Grinder scale logic                                |
| `audio/`      | Sound playback                                     |
| `navigation/` | Routing and modal history                          |
| `ui/`         | UI utilities (haptics)                             |

### `src/providers/`

- `StorageProvider.tsx` - IndexedDB initialization and data migration
- `CapacitorProvider.tsx` - Native capabilities initialization
- `ModalHistoryProvider.tsx` - Back button modal handling
- `DataLayerProvider.tsx` - Data layer context

## Data Architecture

### Local Database (Dexie/IndexedDB)

Tables: `brewingNotes`, `coffeeBeans`, `customEquipments`, `customMethods`, `settings`

### State Management (Zustand)

- `coffeeBeanStore.ts` - Coffee bean CRUD
- `brewingNoteStore.ts` - Brewing notes CRUD
- `equipmentStore.ts` - Equipment configuration
- `grinderStore.ts` - Grinder settings
- `settingsStore.ts` - App settings
- `customMethodStore.ts` - Custom brewing methods
- `customEquipmentStore.ts` - Custom equipment

## Key Entry Points

- `src/app/page.tsx` - Main app page
- `src/app/layout.tsx` - Root layout with providers
- `src/lib/core/config.ts` - Global configuration
- `src/lib/core/db.ts` - Database schema and utilities
