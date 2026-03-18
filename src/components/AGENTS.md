# Components - Agent Knowledge

**Feature:** UI Components  
**Scope:** All React components organized by domain

---

## Structure

```
components/
├── brewing/          # Brewing timer, pour visualizer, stages
├── coffee-bean/      # Bean inventory (list, detail, form, stats)
├── notes/            # Brewing notes (list, detail, form)
├── equipment/        # Equipment management
├── method/           # Brewing methods
├── settings/         # App settings UI
├── common/           # Shared components (modals, forms, feedback)
├── ui/               # Base UI primitives
├── layout/           # Layout components
└── onboarding/       # First-time user flow
```

---

## Where to Look

| Task                | Location         | Notes                                      |
| ------------------- | ---------------- | ------------------------------------------ |
| Add brewing feature | `brewing/`       | Timer, stages, pour visualizer             |
| Add bean feature    | `coffee-bean/`   | Large module with many subdirs             |
| Add setting         | `settings/`      | Create component, register in Settings.tsx |
| Add modal           | `common/modals/` | Reusable modal patterns                    |
| Add form control    | `common/forms/`  | Form input components                      |
| Add UI primitive    | `ui/`            | Buttons, sliders, inputs                   |

---

## Conventions

### Component Structure

- One main component per file, exported as default
- Co-locate sub-components in same directory
- Use `index.ts` for clean exports when multiple related files

### Naming

- **PascalCase**: `CoffeeBeanList.tsx`
- **Directory**: kebab-case: `coffee-bean/`
- **Hooks**: `useCoffeeBeans.ts` in `hooks/` subdir

### Props Pattern

- Use TypeScript interfaces for props
- Prefer composition over configuration props
- Use `class-variance-authority` for variant styling

### Styling

- Tailwind CSS classes, no inline styles
- Use `cn()` utility for conditional classes
- Theme-aware via `next-themes`

---

## Special Patterns

### Coffee Bean Module (`coffee-bean/`)

Complex feature with nested structure:

- `List/` - Bean list with filters, stats view
- `Form/` - Add/edit bean forms
- `Detail/` - Bean detail view
- `StatsView/` - Charts, yearly review, origin map

### Settings Pattern (`settings/`)

Each setting is a component:

1. Create `{Feature}Settings.tsx`
2. Import in `Settings.tsx`
3. Add to settings navigation

### Brewing Timer (`brewing/`)

- `BrewingTimer.tsx` - Main orchestrator
- `Timer/` - Timer display components
- `stages/` - Stage control components

---

## Anti-Patterns

- **Don't** import from sibling feature modules directly - use stores/hooks
- **Don't** use `window` or `document` without Capacitor checks
- **Don't** bypass Zustand for shared state
- **Don't** create one-off styles - extend Tailwind config
