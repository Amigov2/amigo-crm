# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Amigo CRM — a French-language B2B CRM built as a React SPA for managing prospects across four business projects: makeup school partnerships (Carnaval Gall), wine suppliers, wine clients (Brazilian market), and 3D printing services (Rio). Three authorized users: Anthony, Harold, Jade.

## Tech Stack

- **Frontend:** React 18 (JSX), Vite bundler, inline CSS (no CSS framework)
- **Backend:** Supabase (PostgreSQL, key-value `amigo_data` table)
- **Auth:** Google OAuth 2.0 via Supabase Auth (whitelisted emails only)
- **APIs:** Gmail API v1 (read/send), Google Calendar API, exchangerate-api.com
- **Dependencies:** Only `@supabase/supabase-js` — intentionally minimal

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Vite dev server
npm run build      # Production build
npm run preview    # Preview production build
node seed-v2.js    # Seed database with sample data
```

## Architecture

**Monolithic single-file SPA:** The entire application lives in `src/App.jsx` (~2700 lines). There is no routing library, state management library, or component library.

**Entry flow:** `index.html` → `src/main.jsx` → `src/App.jsx` (default export: `AmigoCRM`)

**State management:** All state lives in the root `AmigoCRM` component via React hooks (`useState`, `useEffect`, `useCallback`, `useRef`). Props are drilled to child components.

**Data persistence:** Supabase `amigo_data` table stores serialized JSON by key. Full objects are written/read as key-value pairs. Polling-based sync every 3-5 seconds (not WebSocket).

**Data model keys:** `makeup`, `vin`, `vinClients`, `print3d` (prospect arrays), `orders`, `activity`, `prospectEmails`.

**UI patterns:**
- Views/tabs: Kanban, Tableau (table), Email, Carte (wine map), Activité, Calendrier
- Modals via `ModalWrap` component with controlled state from parent
- Dark theme with project-specific accent colors; theme switcher (dark/dim/warm/light) persisted in localStorage

## Key Components (defined outside AmigoCRM in App.jsx)

`StatCard`, `KanbanCard`, `ModalWrap`, `Field`, `AddProspectModal`, `AddOrderModal`, `WineFinancePanel`, `ProspectModal`, `AddEventModal`, `EmailModal`, `DocsTab`, `CarteVin`

## Project-Specific Logic

Each of the four projects (`makeup`, `vin`, `vinClients`, `print3d`) has its own status pipeline, tags, and fields defined in the `PROJECTS` config object. Wine projects have additional fields (cépage, appellation, millésime, bio, incoterm, pricing tiers) and a Brazilian tax calculator (II, IPI, PIS/COFINS, ICMS). Wine clients are auto-detected by `.br` email domain or `+55` phone prefix.

## UI Language

All UI text, labels, statuses, and comments are in **French**. Maintain this convention.
