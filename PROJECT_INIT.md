# Project Startup Guide

## 1. Backend

```bash
cd D:\python\Jewelry

# Activate the virtual environment (Windows Git Bash / bash shell)
source .venv/Scripts/activate

# Run the backend
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at: **http://127.0.0.1:8000**

---

## 2. Frontend

```bash
cd D:\python\Jewelry\frontend_new

# Install dependencies (first time only, or after pulling new changes)
npm install

# Start the dev server
npm run dev
```

Frontend runs at: **http://localhost:3001**
(Vite uses 3001 automatically if 3000 is taken.)

---

## 3. Environment Variables

File: `frontend_new/.env.local`

```env
VITE_API_LAN_URL=http://192.168.0.120:8000
VITE_API_ZT_URL=http://192.168.195.130:8000
```

- `VITE_API_LAN_URL` — LAN IP of the machine running the backend
- `VITE_API_ZT_URL` — ZeroTier IP (for remote access)
- For local-only dev, set both to `http://127.0.0.1:8000`

The frontend probes LAN first, then ZeroTier. Configure these to match your current network.

---

## 4. Database

**Engine:** MySQL at `127.0.0.1:3306`
**Database name:** `jewelry`
**Config file:** `backend/app/db.py`

```python
DB_URL = "mysql+mysqlconnector://root:****@127.0.0.1:3306/jewelry"
```

Tables are created automatically on backend startup via `Base.metadata.create_all()` — no manual migration needed for a fresh install.

**Required tables** (auto-created):
- `users`
- `rings`
- `ring_type`, `bands`, `head_setting`, `shank_type`, `profiles`
- `textures_details`
- `finger_sizes`
- `head_gems`, `shank_gems`, `bands_gems`
- `head_stone_setting`, `shank_stone_setting`, `shank_bands_stone_setting`
- `stone_shape`, `directions`
- All pivot tables (`rings_ring_type`, `rings_bands`, etc.)

**To connect with a MySQL client:**
```
Host:     127.0.0.1
Port:     3306
User:     root
Database: jewelry
```

---

## 5. Typical Development Workflow

1. Open a terminal → start the backend (see step 1)
2. Open a second terminal → start the frontend (see step 2)
3. Open browser → go to **http://localhost:3001**
4. Make changes → Vite hot-reloads automatically; FastAPI reloads with `--reload`

---

## 6. Git Workflow

```bash
# Check what changed
git status

# Stage all changes
git add .

# Commit with a message
git commit -m "describe what changed"

# Push to remote
git push
```

Current branch: `v2`
Main branch: `main`

To switch or merge:
```bash
git checkout main
git merge v2
git push
```
