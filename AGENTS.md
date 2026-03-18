# Brew Guide - Agent Knowledge Base

**Generated:** 2026-03-18  
**Project:** Coffee brewing assistant app (v1.5.12)  
**License:** GPL-3.0

---

## Overview

Brew Guide is a cross-platform coffee brewing companion app with timing, bean inventory, and tasting notes. Supports Web/PWA, iOS, Android, macOS, and Windows.

**Core Stack:** Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + Capacitor + Tauri

---

## Structure

```
brew-guide/
├── src/
│   ├── app/              # Next.js App Router (entry: page.tsx, layout.tsx)
│   ├── components/       # UI components by feature
│   ├── lib/              # Core logic, stores, utilities
│   ├── providers/        # React Context providers
│   ├── styles/           # Global styles, fonts
│   └── types/            # TypeScript definitions
├── ios/                  # Capacitor iOS project
├── android/              # Capacitor Android project
├── src-tauri/            # Tauri desktop app
├── public/               # Static assets
└── docs/                 # Documentation (ARCHITECTURE.md)
```

---

## Where to Look

| Task               | Location                                  | Notes                         |
| ------------------ | ----------------------------------------- | ----------------------------- |
| Add new page       | `src/app/`                                | App Router convention         |
| Add component      | `src/components/{feature}/`               | Group by feature domain       |
| Add store          | `src/lib/stores/`                         | Zustand pattern, see existing |
| Database changes   | `src/lib/core/db.ts`                      | Dexie/IndexedDB schema        |
| Sync functionality | `src/lib/sync/`, `webdav/`, `s3/`         | Base class + implementations  |
| Native mobile      | `capacitor.config.ts`, `ios/`, `android/` | Capacitor 7                   |
| Desktop app        | `src-tauri/`                              | Tauri 2                       |

---

## Code Map

### Entry Points

| File                  | Purpose                      |
| --------------------- | ---------------------------- |
| `src/app/layout.tsx`  | Root layout, providers setup |
| `src/app/page.tsx`    | Main app entry               |
| `src/lib/core/db.ts`  | Database schema + migrations |
| `capacitor.config.ts` | Mobile app configuration     |

### Key Stores (Zustand)

| Store            | File                         | Purpose           |
| ---------------- | ---------------------------- | ----------------- |
| coffeeBeanStore  | `stores/coffeeBeanStore.ts`  | Bean inventory    |
| brewingNoteStore | `stores/brewingNoteStore.ts` | Brewing notes     |
| equipmentStore   | `stores/equipmentStore.ts`   | Equipment configs |
| grinderStore     | `stores/grinderStore.ts`     | Grinder settings  |
| settingsStore    | `stores/settingsStore.ts`    | App settings      |

### Database Tables (Dexie)

- `brewingNotes` - Brewing records
- `coffeeBeans` - Bean inventory
- `customEquipments` - User equipment
- `customMethods` - Brewing methods
- `grinders` - Grinder configs
- `yearlyReports` - Annual summaries
- `appSettings` - Application settings
- `pendingOperations` - Sync queue

---

## Conventions

### Component Naming

- **PascalCase** for components: `BrewingTimer.tsx`, `CoffeeBeanForm.tsx`
- **camelCase** for utilities: `formatDate.ts`, `useBrewing.ts`
- Feature prefix for grouping: `coffee-bean/`, `brewing/`, `settings/`

### File Organization

- One component per file (mostly)
- Co-locate sub-components in `components/` subdirs
- Shared hooks in `hooks/` subdirs
- Styles: Tailwind classes + occasional CSS modules

### State Management

- **Zustand** for global state (stores/)
- **React Context** for providers (providers/)
- **Local state** with `useState` for UI-only state
- Database via Dexie (IndexedDB wrapper)

### TypeScript

- Strict mode enabled
- Types in `src/types/` for app-wide, `lib/types/` for module-specific
- Prefer interfaces over type aliases for objects

---

## Anti-Patterns (Avoid)

- **Don't** use `as any` - proper typing required
- **Don't** add deps without checking bundle size
- **Don't** modify db schema without migration logic in `db.ts`
- **Don't** use `localStorage` directly - use `dbUtils` or stores
- **Don't** skip error handling in async operations
- **Don't** break Capacitor native bridge patterns

---

## Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm dev --experimental-https  # HTTPS (for PWA/camera testing)

# Building
pnpm build                  # Web build (static export)
pnpm cap:build              # Mobile: build + sync
cap:ios                     # Open Xcode
cap:android                 # Open Android Studio
pnpm tauri:dev              # Desktop dev
pnpm tauri:build            # Desktop build

# Quality
pnpm lint                   # ESLint
pnpm format                 # Prettier
pnpm perf:check             # Performance analysis
```

---

## Notes

- **Offline-first:** IndexedDB primary, cloud sync secondary
- **Multi-platform:** Single codebase, platform detection via Capacitor APIs
- **PWA:** Service worker generated, manifest in `public/`
- **Performance:** Uses `react-virtuoso` for long lists, `next-pwa` for offline
- **Sync:** Supports WebDAV, S3, Supabase - configured in settings
- **Internationalization:** Chinese primary (zh-CN), English strings where present

---

## Links

- Architecture: `docs/ARCHITECTURE.md`
- README: `README.md`
- GitHub: https://github.com/chuthree/brew-guide
