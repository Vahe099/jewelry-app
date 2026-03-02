# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dev Commands

**Frontend** (port 3000):
```bash
cd frontend
npm run dev
```

**Backend** (port 8000):
```bash
cd backend
source ../.venv/Scripts/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The frontend `.env.local` sets `VITE_API_BASE_URL=http://192.168.0.218:8000`. For local-only dev, override with `VITE_API_BASE_URL=http://127.0.0.1:8000`.

There are no tests.

## Architecture

### Frontend (`frontend/`)

Single-file React app — almost all logic lives in **`App.tsx`** (~2400 lines). React Router v6 with these routes:
- `/jewelry-type` — jewelry type selector (ring vs band)
- `/type` — sub-type selector
- `/rings` — browse/search rings
- `/bands` — browse/search bands
- `/login` — login page (register button intentionally disabled)

URL ↔ state is synced manually via `useLocation` + `navigate`. No external state library — all state is `useState` in `App.tsx`.

**`api/jewelry.ts`** — all backend calls. `API_BASE` comes from `VITE_API_BASE_URL`. Auth token stored in `localStorage` under key `auth_token`.

**`components/StlViewer.tsx`** — Three.js STL viewer with OrbitControls, auto-fit, and ResizeObserver.

### Backend (`backend/app/`)

Single-file FastAPI app — all routes in **`main.py`**. The stub files `api/routes_lookups.py` and `api/routes_rings.py` are empty.

**Database**: MySQL at `127.0.0.1:3306/jewelry` (hardcoded in `db.py`). Tables auto-created on startup via `Base.metadata.create_all()`.

**Static mounts**:
- `/media` → `D:\python\Jewelry_file\picturs\` (ring images, named `{10000000+id}/`)
- `/stl` → `D:\python\Jewelry_file\stl\` (STL files, named `{10000000+id}.stl`)

**Ring code convention**: `code = 10000000 + ring.id` — used as the folder/file basename for all uploaded files.

**Key endpoints**:
- `GET /api/lookups` — all dropdown data for the frontend
- `POST /api/rings/search` — AND-logic filter search (returns up to 200 rings, with `ring_type_names`, `head_setting_names`, `shank_type_names`, `profile_names`, `finger_size`, `us_size`)
- `POST /create-ring` — multipart upload (3DM + STL + images + metadata), requires Bearer token
- `GET /api/rings/{id}/files` — returns image URLs + STL URL for a ring

**Auth**: JWT (HS256), `SECRET_KEY` env var (default `"change-me-in-production"`), 24h expiry. Only `POST /create-ring` requires auth.

### Data Model

`Rings` is the main entity. It has many-to-many relationships to lookup tables (`RingType`, `HeadSetting`, `ShankType`, `Profiles`, `TexturesDetails`, `Bands`) via pivot tables, and one-to-many to gem tables (`HeadGems`, `ShankGems`, `BandsGems`). All relationships use `lazy="selectin"` — no explicit `selectinload()` needed in queries.

`FingerSizes` stores decimal ring sizes. Exposed as both `finger_sizes` and `us_sizes` in `/api/lookups`, and as both `finger_size` and `us_size` in search results. The UI labels this "US SIZE".
