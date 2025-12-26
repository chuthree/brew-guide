# Tech Stack & Build System

## Core Technologies

| Technology    | Version | Purpose                                |
| ------------- | ------- | -------------------------------------- |
| Next.js       | 16      | React framework with App Router        |
| React         | 19      | UI library with React Compiler enabled |
| TypeScript    | 5.x     | Type safety                            |
| Tailwind CSS  | 4       | Styling with CSS variables             |
| Zustand       | 5       | State management                       |
| Dexie         | 4       | IndexedDB wrapper for local storage    |
| Framer Motion | 12      | Animations                             |
| Capacitor     | 7       | iOS/Android native runtime             |
| Tauri         | 2       | Desktop app framework                  |

## Package Manager

**pnpm** is the required package manager.

## Key Commands

```bash
# Development
pnpm install          # Install dependencies
pnpm dev              # Start dev server (localhost:3000)
pnpm dev --experimental-https  # HTTPS dev server (for PWA/camera testing)

# Build
pnpm build            # Production build (Next.js + Service Worker)
pnpm build:next       # Next.js build only

# Code Quality
pnpm lint             # ESLint with auto-fix
pnpm format           # Prettier formatting
pnpm format:check     # Check formatting

# Mobile (Capacitor)
pnpm cap:build        # Build and sync to native projects
pnpm cap:ios          # Open Xcode
pnpm cap:android      # Open Android Studio

# Desktop (Tauri)
pnpm tauri:dev        # Tauri development
pnpm tauri:build      # Build desktop app
pnpm tauri:build:mac  # macOS universal build
```

## Build Configuration

- **Output**: Static export (`output: 'export'` in next.config.mjs)
- **PWA**: Service Worker generated via Workbox (`scripts/generate-sw.mjs`)
- **SVG**: Handled via @svgr/webpack (import as React components)

## Code Style

- **Prettier**: Single quotes, 2-space tabs, trailing commas (ES5), 80 char width
- **ESLint**: Next.js recommended + TypeScript rules
- **Path aliases**: `@/*` → `./src/*`, `@public/*` → `./public/*`

## Important Conventions

- Use `nanoid` for generating unique IDs
- Console logging: Only `console.warn` and `console.error` allowed (no `console.log`)
- Unused variables: Prefix with `_` to ignore
- React hooks deps: Enforced via ESLint
- Inline functions in JSX: Discouraged for performance
