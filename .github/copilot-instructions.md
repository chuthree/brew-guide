# Brew Guide AI Instructions

You are working on **Brew Guide**, a coffee brewing assistant app built with **Next.js 15**, **React 19**, **Tailwind CSS 4**, and **Capacitor**. It uses a **Local-First** architecture with **Dexie.js (IndexedDB)** and **Zustand**.

## 🏗 Architecture Overview

- **Frontend**: Next.js App Router (`src/app`).
- **State Management**: **Zustand** (`src/lib/stores`) for UI state, synced with **Dexie** (`src/lib/core/db.ts`) for persistence.
- **Data Layer**:
  - **Local**: `BrewGuideDB` (Dexie) stores `coffeeBeans`, `brewingNotes`, `settings`, etc.
  - **Sync**: Custom sync engine (`src/lib/sync`) supporting **WebDAV** and **S3**.
- **Mobile**: **Capacitor** provides native runtime. Native plugins are wrapped in `src/lib/app`.
- **Backend**: Separate Express server (`server/`) for AI recognition, reports, and feedback.

## 🧩 Key Patterns & Conventions

### 1. Data Flow (Local-First)

- **Read**: Components read from Zustand stores (e.g., `useCoffeeBeanStore`).
- **Write**: Components call Store actions -> Store calls Manager (`src/lib/managers`) -> Manager updates DB -> Store updates local state.
- **Example**: Adding a bean:
  1. Component calls `addBean(bean)`.
  2. Store calls `CoffeeBeanManager.addBean(bean)`.
  3. Manager writes to `db.coffeeBeans`.
  4. Store updates `state.beans`.

### 2. Database Schema (`src/lib/core/db.ts`)

- Always check `BrewGuideDB` class for the latest schema versions.
- When adding new tables/fields, increment version and define schema in `constructor`.

### 3. Synchronization (`src/lib/sync`)

- Logic resides in `BaseSyncManager`.
- Syncs `brew-guide-data.json` (full export) or individual files based on metadata.
- **Do not modify sync logic** without understanding the metadata/conflict resolution strategy.

### 4. Styling

- Use **Tailwind CSS 4**.
- Global styles in `src/styles`.
- Components use `clsx` and `tailwind-merge` (via `cn` utility if available, or direct import).

### 5. Mobile/Capacitor

- Check `src/providers/CapacitorProvider.tsx` for initialization.
- Use `src/lib/app` wrappers for native features (Haptics, Screen, etc.) to ensure web fallback compatibility.

## 🛠 Developer Workflow

- **Web Dev**: `pnpm dev` (starts Next.js on localhost:3000).
- **Mobile Dev**:
  - `pnpm cap:build` (Builds Next.js & syncs to native).
  - `pnpm cap:ios` / `pnpm cap:android` (Opens native IDE).
- **Server Dev**: `cd server && pnpm dev` (starts API server on port 3100).

## 📂 Key Directories

- `src/components/brewing`: Timer & visualization logic.
- `src/components/coffee-bean`: Bean management UI.
- `src/lib/core`: DB, Config, Storage utilities.
- `src/lib/stores`: Zustand stores.
- `server/`: Standalone API server (AI, Feedback).

## 🚨 Critical Rules

1. **Preserve Local-First**: Always write to Dexie (DB) for persistent data. Do not rely solely on Zustand state for persistence.
2. **Mobile Compatibility**: Ensure UI works in Safe Areas (use `safe-area-inset-*`). Test interactions for touch targets.
3. **Server Separation**: The `server/` folder is a separate project. Do not import `server/` code into `src/`.
