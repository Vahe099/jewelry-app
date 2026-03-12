# backend/main.py
from __future__ import annotations

from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Request, Form, Depends, HTTPException, UploadFile, File, Body
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, desc, func

from .db import SessionLocal, engine
from . import models
from .models import Base
from .auth import get_current_user, hash_password, verify_password, create_access_token

from uuid import uuid4
from pydantic import BaseModel
import shutil
import json
import os

# -------------------------
# File save paths
# -------------------------
BASE_SAVE = Path(r"D:\python\Jewelry_file")
SAVE_3DM = BASE_SAVE / "3dm"
SAVE_STL = BASE_SAVE / "stl"
SAVE_PICS = BASE_SAVE / "picturs"
for p in [SAVE_3DM, SAVE_STL, SAVE_PICS]:
    p.mkdir(parents=True, exist_ok=True)

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

app = FastAPI(title="Jewelry Web (FastAPI + HTML)")


@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(PROJECT_DIR / "static")), name="static")
app.mount("/media", StaticFiles(directory=str(SAVE_PICS)), name="media")
app.mount("/stl", StaticFiles(directory=str(SAVE_STL)), name="stl")
app.mount("/3dm", StaticFiles(directory=str(SAVE_3DM)), name="3dm")
templates = Jinja2Templates(directory=str(PROJECT_DIR / "templates"))


# -------------------------
# DB dependency
# -------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

DEBUG_PAGES = os.getenv("DEBUG_PAGES", "1") == "1"


# -------------------------
# Auth request body
# -------------------------
class AuthBody(BaseModel):
    email: str
    password: str


# -------------------------
# Auth endpoints
# -------------------------
@app.post("/api/auth/register")
def auth_register(body: AuthBody, db: Session = Depends(get_db)):
    if db.execute(select(models.User).where(models.User.email == body.email)).scalar_one_or_none():
        raise HTTPException(400, "Email already registered")
    user = models.User(email=body.email, password_hash=hash_password(body.password), role="uploader")
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/auth/login")
def auth_login(body: AuthBody, db: Session = Depends(get_db)):
    user = db.execute(
        select(models.User).where(models.User.email == body.email)
    ).scalar_one_or_none()
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/auth/me")
def auth_me(current_user: models.User = Depends(get_current_user)):
    return {"email": current_user.email, "is_active": current_user.is_active, "role": current_user.role}


# -------------------------
# Lookups API (used by React frontend)
# -------------------------
@app.get("/api/lookups")
def get_lookups(db: Session = Depends(get_db)):
    def rows(model, name_field: str):
        return sorted(
            [{"id": r.id, "name": getattr(r, name_field)}
             for r in db.execute(select(model)).scalars().all()],
            key=lambda x: x["name"],
        )
    return {
        "ring_types":    rows(models.RingType,        "ring_name"),
        "head_settings": rows(models.HeadSetting,     "head_setting_name"),
        "shank_types":   rows(models.ShankType,       "shank_type_name"),
        "profiles":      rows(models.Profiles,        "profiles_name"),
        "textures":      rows(models.TexturesDetails, "textures_details_name"),
        "bands":         rows(models.Bands,           "band_name"),
        "finger_sizes":  rows(models.FingerSizes,     "finger_sizes_name"),
        "us_sizes":      rows(models.FingerSizes,     "finger_sizes_name"),
        "head_stone_settings":        rows(models.HeadStoneSetting,      "name"),
        "shank_stone_settings": rows(models.ShankStoneSetting, "name"),
        "shank_bands_stone_settings": rows(models.ShankBandsStoneSetting, "name"),
        "stone_shapes":               rows(models.StoneShape,             "stone_shape_name"),
        "directions":                 rows(models.Directions,             "directions_name"),
    }

# -------------------------
# Ring images + files API
# -------------------------
@app.get("/api/rings/{ring_id}/files")
def get_ring_files(ring_id: int, db: Session = Depends(get_db)):
    ring = db.execute(select(models.Rings).where(models.Rings.id == ring_id)).scalar_one_or_none()
    if not ring:
        raise HTTPException(404, "Ring not found")
    folder = Path(ring.pictures_folder) if ring.pictures_folder else None
    if folder and folder.exists():
        code = 10000000 + ring_id
        exts = {'.jpg', '.jpeg', '.png', '.webp'}
        files = sorted(f.name for f in folder.iterdir() if f.suffix.lower() in exts)
        images = [f"/media/{code}/{name}" for name in files]
    else:
        images = []
    stl_path = Path(ring.path_stl) if ring.path_stl else None
    stl = f"/stl/{stl_path.name}" if stl_path and stl_path.exists() else None
    return {"images": images, "stl": stl}

@app.get("/api/rings/{ring_id}/images")
def get_ring_images(ring_id: int, db: Session = Depends(get_db)):
    ring = db.execute(select(models.Rings).where(models.Rings.id == ring_id)).scalar_one_or_none()
    if not ring:
        raise HTTPException(404, "Ring not found")
    folder = Path(ring.pictures_folder) if ring.pictures_folder else None
    if not folder or not folder.exists():
        return {"images": []}
    code = 10000000 + ring_id
    exts = {'.jpg', '.jpeg', '.png', '.webp'}
    files = sorted(f.name for f in folder.iterdir() if f.suffix.lower() in exts)
    return {"images": [f"/media/{code}/{name}" for name in files]}

# -------------------------
# Helpers: fetch lookup lists for dropdowns
# -------------------------
def fetch_lookup(db: Session, model, id_field="id", name_field=None):
    if name_field is None:
        # Auto-detect common name fields
        for f in [
            "ring_name",
            "head_setting_name",
            "shank_type_name",
            "profiles_name",
            "textures_details_name",
            "name",
            "stone_shape_name",
            "directions_name",
            "finger_sizes_name",
            "band_name",
        ]:
            if hasattr(model, f):
                name_field = f
                break

    if name_field is None:
        raise HTTPException(500, f"Cannot auto-detect name field for model: {model}")

    rows = db.execute(select(model)).scalars().all()
    out = [{"id": getattr(r, id_field), "name": str(getattr(r, name_field))} for r in rows]
    out.sort(key=lambda x: x["name"])
    return out

# -------------------------
# Create page
# -------------------------
@app.get("/", response_class=HTMLResponse)
def create_ring_page(request: Request, db: Session = Depends(get_db)):
    ring_types = fetch_lookup(db, models.RingType, name_field="ring_name")
    bands = fetch_lookup(db, models.Bands, name_field="band_name")

    finger_sizes = (
        db.execute(
            select(models.FingerSizes)
            .order_by(models.FingerSizes.finger_sizes_name.asc())
        )
        .scalars()
        .all()
    )
    finger_sizes = [{"id": fs.id, "name": fs.finger_sizes_name} for fs in finger_sizes]

    head_settings = fetch_lookup(db, models.HeadSetting, name_field="head_setting_name")
    shank_types = fetch_lookup(db, models.ShankType, name_field="shank_type_name")
    profiles = fetch_lookup(db, models.Profiles, name_field="profiles_name")
    textures = fetch_lookup(db, models.TexturesDetails, name_field="textures_details_name")

    head_stone_settings = fetch_lookup(db, models.HeadStoneSetting, name_field="name")
    shank_bands_stone_settings = fetch_lookup(db, models.ShankBandsStoneSetting, name_field="name")

    stone_shapes = fetch_lookup(db, models.StoneShape, name_field="stone_shape_name")
    directions = fetch_lookup(db, models.Directions, name_field="directions_name")

    return templates.TemplateResponse(
        "create_ring.html",
        {
            "request": request,
            "ring_types": ring_types,
            "bands": bands,
            "finger_sizes": finger_sizes,
            "head_settings": head_settings,
            "shank_types": shank_types,
            "profiles": profiles,
            "textures": textures,
            "head_stone_settings": head_stone_settings,
            "shank_bands_stone_settings": shank_bands_stone_settings,
            "stone_shapes": stone_shapes,
            "directions": directions,
        },
    )

# -------------------------
# Debug page
# -------------------------
@app.get("/rings-debug", response_class=HTMLResponse)
def rings_debug(request: Request, db: Session = Depends(get_db), limit: int = 20):
    if not DEBUG_PAGES:
        raise HTTPException(status_code=404)

    rings = db.execute(
        select(models.Rings)
        .options(
            selectinload(models.Rings.ring_types),
            selectinload(models.Rings.head_settings),
            selectinload(models.Rings.shank_types),
            selectinload(models.Rings.profiles),
            selectinload(models.Rings.head_textures),
            selectinload(models.Rings.shank_textures),
            selectinload(models.Rings.head_gems),
            selectinload(models.Rings.shank_gems),
            selectinload(models.Rings.bands),
            selectinload(models.Rings.bands_textures),
        )
        .order_by(desc(models.Rings.id))
        .limit(limit)
    ).scalars().all()

    def table_kv(rows):
        html = ["<table class='t'>"]
        for k, v in rows:
            html.append(f"<tr><th>{k}</th><td>{v}</td></tr>")
        html.append("</table>")
        return "".join(html)

    def table_simple(headers, body_rows):
        html = ["<table class='t'><tr>"]
        for h in headers:
            html.append(f"<th>{h}</th>")
        html.append("</tr>")
        for row in body_rows:
            html.append("<tr>")
            for cell in row:
                html.append(f"<td>{cell}</td>")
            html.append("</tr>")
        html.append("</table>")
        return "".join(html)

    page = []
    page.append("""
    <style>
      body { font-family: Arial; padding: 16px; }
      .card { border:1px solid #ddd; border-radius:10px; padding:12px; margin: 12px 0; }
      .sub { margin-top:10px; padding:10px; border:1px dashed #ccc; border-radius:10px; background:#fafafa; }
      .t { border-collapse: collapse; width: 100%; }
      .t th, .t td { border:1px solid #ddd; padding:8px; vertical-align: top; }
      .t th { background:#f2f2f2; text-align:left; width:220px; }
      .pill { display:inline-block; padding:3px 8px; border-radius:999px; background:#e9f2ff; margin:2px; }
      .muted { color:#666; font-size: 13px; }
      details summary { cursor:pointer; font-weight:700; }
      .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    </style>
    """)

    page.append("<h2>Rings Debug</h2>")
    page.append("<div style='margin-bottom:12px;'><a href='/'>← Back</a></div>")
    page.append(f"<div class='muted'>Showing last <b>{limit}</b> rings. Change with ?limit=50</div>")

    for r in rings:
        # Pivot raw rows
        rrt = db.execute(
            select(models.rings_ring_type.c.rings_id, models.rings_ring_type.c.ring_type_id)
            .where(models.rings_ring_type.c.rings_id == r.id)
        ).all()

        rhs = db.execute(
            select(models.rings_head_setting.c.rings_id, models.rings_head_setting.c.head_setting_id)
            .where(models.rings_head_setting.c.rings_id == r.id)
        ).all()

        rst = db.execute(
            select(models.rings_shank_type.c.rings_id, models.rings_shank_type.c.shank_type_id)
            .where(models.rings_shank_type.c.rings_id == r.id)
        ).all()

        rp = db.execute(
            select(models.rings_profiles.c.rings_id, models.rings_profiles.c.profiles_id)
            .where(models.rings_profiles.c.rings_id == r.id)
        ).all()

        rht = db.execute(
            select(models.rings_head_textures_details.c.rings_id, models.rings_head_textures_details.c.textures_details_id)
            .where(models.rings_head_textures_details.c.rings_id == r.id)
        ).all()

        rstx = db.execute(
            select(models.rings_shank_textures_details.c.rings_id, models.rings_shank_textures_details.c.textures_details_id)
            .where(models.rings_shank_textures_details.c.rings_id == r.id)
        ).all()

        types_pretty = " ".join([f"<span class='pill'>{x.ring_name}</span>" for x in r.ring_types]) or "<span class='muted'>None</span>"
        head_settings_pretty = " ".join([f"<span class='pill'>{x.head_setting_name}</span>" for x in r.head_settings]) or "<span class='muted'>None</span>"
        shank_types_pretty = " ".join([f"<span class='pill'>{x.shank_type_name}</span>" for x in r.shank_types]) or "<span class='muted'>None</span>"
        profiles_pretty = " ".join([f"<span class='pill'>{x.profiles_name}</span>" for x in r.profiles]) or "<span class='muted'>None</span>"
        head_textures_pretty = " ".join([f"<span class='pill'>{x.textures_details_name}</span>" for x in r.head_textures]) or "<span class='muted'>None</span>"
        shank_textures_pretty = " ".join([f"<span class='pill'>{x.textures_details_name}</span>" for x in r.shank_textures]) or "<span class='muted'>None</span>"

        head_gems_rows = [
            [g.id, g.head_stone_setting_id, g.stone_shape_id, g.directions_id, g.stone_size, g.stone_count]
            for g in r.head_gems
        ]
        shank_gems_rows = [
            [g.id, g.shank_stone_setting_id, g.stone_shape_id, g.directions_id, g.stone_size, g.stone_count]
            for g in r.shank_gems
        ]
        bands_gems_rows = []

        page.append("<div class='card'>")
        page.append(f"<h3>Ring ID: {r.id}</h3>")

        page.append("<div class='sub'><details open><summary>rings</summary>")
        page.append(table_kv([
            ("id", r.id),
            ("finger_size_id", r.finger_size_id),
            ("path_3dm", r.path_3dm),
            ("path_stl", r.path_stl),
            ("pictures_folder", r.pictures_folder),
            ("created_at", r.created_at),
        ]))
        page.append("</details></div>")

        page.append("<div class='sub'><details open><summary>Relations (pretty)</summary>")
        page.append("<div class='grid2'>")
        page.append(f"<div><b>ring_type</b><br>{types_pretty}</div>")
        page.append(f"<div><b>head_setting</b><br>{head_settings_pretty}</div>")
        page.append(f"<div><b>shank_type</b><br>{shank_types_pretty}</div>")
        page.append(f"<div><b>profiles</b><br>{profiles_pretty}</div>")
        page.append(f"<div><b>head_textures_details</b><br>{head_textures_pretty}</div>")
        page.append(f"<div><b>shank_textures_details</b><br>{shank_textures_pretty}</div>")
        page.append("</div>")
        page.append("</details></div>")

        page.append("<div class='sub'><details><summary>Pivot tables (raw rows)</summary>")
        page.append("<h4>rings_ring_type</h4>")
        page.append(table_simple(["rings_id", "ring_type_id"], rrt or [["-", "-"]]))

        page.append("<h4>rings_head_setting</h4>")
        page.append(table_simple(["rings_id", "head_setting_id"], rhs or [["-", "-"]]))

        page.append("<h4>rings_shank_type</h4>")
        page.append(table_simple(["rings_id", "shank_type_id"], rst or [["-", "-"]]))

        page.append("<h4>rings_profiles</h4>")
        page.append(table_simple(["rings_id", "profiles_id"], rp or [["-", "-"]]))

        page.append("<h4>rings_head_textures_details</h4>")
        page.append(table_simple(["rings_id", "textures_details_id"], rht or [["-", "-"]]))

        page.append("<h4>rings_shank_textures_details</h4>")
        page.append(table_simple(["rings_id", "textures_details_id"], rstx or [["-", "-"]]))
        page.append("</details></div>")

        page.append("<div class='sub'><details open><summary>head_gems</summary>")
        page.append(table_simple(
            ["id", "head_stone_setting_id", "stone_shape_id", "directions_id", "stone_size", "stone_count"],
            head_gems_rows or [["-", "-", "-", "-", "-", "-"]],
        ))
        page.append("</details></div>")

        page.append("<div class='sub'><details open><summary>shank_gems</summary>")
        page.append(table_simple(
            ["id", "shank_stone_setting_id", "stone_shape_id", "directions_id", "stone_size", "stone_count"],
            shank_gems_rows or [["-", "-", "-", "-", "-", "-"]],
        ))
        page.append("</details></div>")

        page.append("<div class='sub'><details open><summary>bands_gems</summary>")
        page.append(table_simple(
            ["id", "shank_stone_setting_id", "stone_shape_id", "directions_id", "stone_size", "stone_count"],
            bands_gems_rows or [["-", "-", "-", "-", "-", "-"]],
        ))
        page.append("</details></div>")

        page.append("</div>")  # card end

    return HTMLResponse("".join(page))

# -------------------------
# Simple list page
# -------------------------
@app.get("/rings", response_class=HTMLResponse)
def rings_list(request: Request, db: Session = Depends(get_db)):
    if not DEBUG_PAGES:
        raise HTTPException(status_code=404)

    rings = db.execute(select(models.Rings).order_by(models.Rings.id.desc())).scalars().all()

    html = []
    html.append("<h2>Rings (DB)</h2>")
    html.append("<div style='margin-bottom:12px;'><a href='/'>← Back to create</a></div>")
    html.append("<table border='1' cellpadding='8' cellspacing='0' style='border-collapse:collapse;width:100%'>")
    html.append("<tr>"
                "<th>ID</th>"
                "<th>finger_size_id</th>"
                "<th>path_3dm</th>"
                "<th>path_stl</th>"
                "<th>pictures_folder</th>"
                "<th>created_at</th>"
                "</tr>")

    for r in rings:
        html.append(
            "<tr>"
            f"<td>{r.id}</td>"
            f"<td>{r.finger_size_id}</td>"
            f"<td style='max-width:260px;word-break:break-all;'>{r.path_3dm}</td>"
            f"<td style='max-width:260px;word-break:break-all;'>{r.path_stl}</td>"
            f"<td style='max-width:260px;word-break:break-all;'>{r.pictures_folder}</td>"
            f"<td>{r.created_at}</td>"
            "</tr>"
        )

    html.append("</table>")
    return HTMLResponse("".join(html))

# -------------------------
# Create ring submit
# -------------------------
@app.post("/create-ring")
def create_ring_submit(
    file_3dm: Optional[UploadFile] = File(default=None),
    file_stl: Optional[UploadFile] = File(default=None),
    pictures: List[UploadFile] = File(default=[]),

    finger_size_id: Optional[int] = Form(default=None),

    ring_type_ids: List[int] = Form(default=[]),
    head_setting_ids: List[int] = Form(default=[]),
    shank_type_ids: List[int] = Form(default=[]),
    profiles_ids: List[int] = Form(default=[]),
    head_textures_ids: List[int] = Form(default=[]),
    shank_textures_ids: List[int] = Form(default=[]),

    bands_ids: List[int] = Form(default=[]),
    bands_textures_ids: List[int] = Form(default=[]),

    head_gems_json: str = Form(default="[]"),
    shank_gems_json: str = Form(default="[]"),
    band_gems_json: str = Form(default="[]"),

    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    head_gems: List[Dict[str, Any]] = json.loads(head_gems_json or "[]")
    shank_gems: List[Dict[str, Any]] = json.loads(shank_gems_json or "[]")
    band_gems: List[Dict[str, Any]] = json.loads(band_gems_json or "[]")

    def _safe_int(val) -> Optional[int]:
        try:
            return int(val) if val is not None else None
        except (TypeError, ValueError):
            return None

    # Validate required fields before touching any files or DB
    _missing: list[str] = []
    if head_gems:
        g0 = head_gems[0]
        if not _safe_int(g0.get("head_stone_setting_id")): _missing.append("MAIN GEM → SETTINGS")
        if not _safe_int(g0.get("stone_shape_id")):        _missing.append("MAIN GEM → SHAPE")
        if not _safe_int(g0.get("directions_id")):          _missing.append("MAIN GEM → DIRECTION")
        if not str(g0.get("stone_size", "")).strip():       _missing.append("MAIN GEM → SIZE")
        try:
            if int(g0.get("stone_count", 0)) <= 0:          _missing.append("MAIN GEM → COUNT")
        except (TypeError, ValueError):                     _missing.append("MAIN GEM → COUNT")
    if shank_gems:
        g = shank_gems[0]
        _s_touched = any([_safe_int(g.get("shank_stone_setting_id")),
                          _safe_int(g.get("stone_shape_id")),
                          _safe_int(g.get("directions_id")),
                          str(g.get("stone_size", "")).strip()])
        if _s_touched:
            if not _safe_int(g.get("shank_stone_setting_id")): _missing.append("SHANK GEMS → SETTINGS")
            if not _safe_int(g.get("stone_shape_id")):         _missing.append("SHANK GEMS → SHAPE")
            if not _safe_int(g.get("directions_id")):          _missing.append("SHANK GEMS → DIRECTION")
            if not str(g.get("stone_size", "")).strip():       _missing.append("SHANK GEMS → SIZE")
    if _missing:
        raise HTTPException(422, detail={"message": "Missing required fields", "missing": _missing})

    def safe_ext(filename: str) -> str:
        return Path(filename or "").suffix.lower()

    tmp_root = BASE_SAVE / "tmp"
    tmp_root.mkdir(parents=True, exist_ok=True)
    tmp_dir = tmp_root / str(uuid4())
    tmp_dir.mkdir(parents=True, exist_ok=True)

    tmp_3dm = tmp_dir / "file.3dm"
    tmp_stl = tmp_dir / "file.stl"
    tmp_pics = tmp_dir / "pics"
    tmp_pics.mkdir(parents=True, exist_ok=True)

    final_3dm = None
    final_stl = None
    final_pics_folder = None

    try:
        if file_3dm is not None:
            if safe_ext(file_3dm.filename) != ".3dm":
                raise HTTPException(400, "3DM file must have .3dm extension")
            with open(tmp_3dm, "wb") as f:
                shutil.copyfileobj(file_3dm.file, f)
        if file_stl is not None:
            if safe_ext(file_stl.filename) != ".stl":
                raise HTTPException(400, "STL file must have .stl extension")
            with open(tmp_stl, "wb") as f:
                shutil.copyfileobj(file_stl.file, f)

        for i, pic in enumerate(pictures or [], start=1):
            extp = safe_ext(pic.filename)
            if extp not in [".jpg", ".jpeg", ".png", ".webp"]:
                continue
            p = tmp_pics / f"pic_{i:02d}{extp}"
            with open(p, "wb") as f:
                shutil.copyfileobj(pic.file, f)

        ring = models.Rings(
            path_3dm="PENDING",
            path_stl="PENDING",
            pictures_folder="PENDING",
            finger_size_id=finger_size_id or None,
            user_id=current_user.id,
        )
        db.add(ring)
        db.flush()

        rings_id = ring.id
        new_base = 10000000 + rings_id

        if file_3dm is not None:
            final_3dm = SAVE_3DM / f"{new_base}.3dm"
            shutil.move(str(tmp_3dm), str(final_3dm))
        if file_stl is not None:
            final_stl = SAVE_STL / f"{new_base}.stl"
            shutil.move(str(tmp_stl), str(final_stl))
        final_pics_folder = SAVE_PICS / str(new_base)
        final_pics_folder.mkdir(parents=True, exist_ok=True)

        for i, p in enumerate(sorted(tmp_pics.glob("*")), start=1):
            extp = p.suffix.lower()
            dst = final_pics_folder / f"{new_base}_{i:02d}{extp}"
            shutil.move(str(p), str(dst))

        ring.path_3dm = str(final_3dm) if final_3dm else ""
        ring.path_stl = str(final_stl) if final_stl else ""
        ring.pictures_folder = str(final_pics_folder)


        if ring_type_ids:
            ring.ring_types = db.execute(
                select(models.RingType).where(models.RingType.id.in_(ring_type_ids))
            ).scalars().all()

        if head_setting_ids:
            ring.head_settings = db.execute(
                select(models.HeadSetting).where(models.HeadSetting.id.in_(head_setting_ids))
            ).scalars().all()

        if shank_type_ids:
            ring.shank_types = db.execute(
                select(models.ShankType).where(models.ShankType.id.in_(shank_type_ids))
            ).scalars().all()

        if profiles_ids:
            ring.profiles = db.execute(
                select(models.Profiles).where(models.Profiles.id.in_(profiles_ids))
            ).scalars().all()

        if head_textures_ids:
            ring.head_textures = db.execute(
                select(models.TexturesDetails).where(models.TexturesDetails.id.in_(head_textures_ids))
            ).scalars().all()

        if shank_textures_ids:
            ring.shank_textures = db.execute(
                select(models.TexturesDetails).where(models.TexturesDetails.id.in_(head_textures_ids))
            ).scalars().all()

        if bands_ids:
            ring.bands = db.execute(
                select(models.Bands).where(models.Bands.id.in_(bands_ids))
            ).scalars().all()

        if bands_textures_ids:
            ring.bands_textures = db.execute(
                select(models.TexturesDetails).where(models.TexturesDetails.id.in_(bands_textures_ids))
            ).scalars().all()

        def norm_cnt(g: dict) -> int:
            raw = g.get("stone_count", 1)
            try:
                c = int(raw)
            except Exception:
                c = 1
            return 1 if c <= 0 else c

        for g in head_gems:
            sid = _safe_int(g.get("head_stone_setting_id"))
            shid = _safe_int(g.get("stone_shape_id"))
            did = _safe_int(g.get("directions_id"))
            if not sid or not shid or not did:
                continue
            db.add(models.HeadGems(
                rings_id=rings_id,
                head_stone_setting_id=sid,
                stone_shape_id=shid,
                directions_id=did,
                stone_size=str(g.get("stone_size", "")),
                stone_count=norm_cnt(g),
            ))

        for g in shank_gems:
            sid = _safe_int(g.get("shank_stone_setting_id"))
            shid = _safe_int(g.get("stone_shape_id"))
            did = _safe_int(g.get("directions_id"))
            if not sid or not shid or not did:
                continue
            db.add(models.ShankGems(
                rings_id=rings_id,
                shank_stone_setting_id=sid,
                stone_shape_id=shid,
                directions_id=did,
                stone_size=str(g.get("stone_size", "")),
                stone_count=norm_cnt(g),
            ))

        for g in band_gems:
            sid = _safe_int(g.get("shank_bands_stone_setting_id"))
            shid = _safe_int(g.get("stone_shape_id"))
            did = _safe_int(g.get("directions_id"))
            if not sid or not shid or not did:
                continue
            db.add(models.BandsGems(
                rings_id=rings_id,
                shank_bands_stone_setting_id=sid,
                stone_shape_id=shid,
                directions_id=did,
                stone_size=str(g.get("stone_size", "")),
                stone_count=norm_cnt(g),
            ))

        db.commit()
        return JSONResponse({"ok": True, "rings_id": rings_id, "code": new_base})

    except HTTPException:
        db.rollback()
        try:
            if final_3dm and Path(final_3dm).exists():
                Path(final_3dm).unlink(missing_ok=True)
            if final_stl and Path(final_stl).exists():
                Path(final_stl).unlink(missing_ok=True)
            if final_pics_folder and Path(final_pics_folder).exists():
                shutil.rmtree(final_pics_folder, ignore_errors=True)
        except Exception:
            pass
        raise

    except Exception as e:
        db.rollback()
        try:
            if final_3dm and Path(final_3dm).exists():
                Path(final_3dm).unlink(missing_ok=True)
            if final_stl and Path(final_stl).exists():
                Path(final_stl).unlink(missing_ok=True)
            if final_pics_folder and Path(final_pics_folder).exists():
                shutil.rmtree(final_pics_folder, ignore_errors=True)
        except Exception:
            pass
        raise HTTPException(500, f"Upload failed: {str(e)}")

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

# -------------------------
# Live search API (AND logic)
# Uses subqueries to avoid join multiplication issues.
# -------------------------
@app.post("/api/rings/search")
def rings_search(payload: dict = Body(...), db: Session = Depends(get_db)):
    ring_type_ids = [int(x) for x in (payload.get("ring_type_ids", []) or []) if x]
    head_setting_ids = [int(x) for x in (payload.get("head_setting_ids", []) or []) if x]
    shank_type_ids = [int(x) for x in (payload.get("shank_type_ids", []) or []) if x]
    profiles_ids = [int(x) for x in (payload.get("profiles_ids", []) or []) if x]
    head_textures_ids = [int(x) for x in (payload.get("head_textures_ids", []) or []) if x]
    shank_textures_ids = [int(x) for x in (payload.get("shank_textures_ids", []) or []) if x]
    bands_ids = [int(x) for x in (payload.get("bands_ids", []) or []) if x]
    bands_textures_ids = [int(x) for x in (payload.get("bands_textures_ids", []) or []) if x]
    type_mode = payload.get("type_mode")  # 'rings' | 'bands' | None

    q = select(models.Rings).order_by(models.Rings.id.desc())

    def require_all(pivot_table, pivot_value_col, ids: list[int]):
        if not ids:
            return None
        ids = list(set(ids))
        subq = (
            select(pivot_table.c.rings_id)
            .where(pivot_value_col.in_(ids))
            .group_by(pivot_table.c.rings_id)
            .having(func.count(func.distinct(pivot_value_col)) == len(ids))
        )
        return subq

    if hasattr(models, "rings_ring_type") and ring_type_ids:
        subq = require_all(models.rings_ring_type, models.rings_ring_type.c.ring_type_id, ring_type_ids)
        if subq is not None:
            q = q.where(models.Rings.id.in_(subq))

    if head_setting_ids:
        subq = require_all(models.rings_head_setting, models.rings_head_setting.c.head_setting_id, head_setting_ids)
        if subq is not None:
            q = q.where(models.Rings.id.in_(subq))

    if shank_type_ids:
        subq = require_all(models.rings_shank_type, models.rings_shank_type.c.shank_type_id, shank_type_ids)
        if subq is not None:
            q = q.where(models.Rings.id.in_(subq))

    if profiles_ids:
        subq = require_all(models.rings_profiles, models.rings_profiles.c.profiles_id, profiles_ids)
        if subq is not None:
            q = q.where(models.Rings.id.in_(subq))

    if head_textures_ids:
        subq = require_all(models.rings_head_textures_details, models.rings_head_textures_details.c.textures_details_id, head_textures_ids)
        if subq is not None:
            q = q.where(models.Rings.id.in_(subq))

    if shank_textures_ids:
        subq = require_all(models.rings_shank_textures_details, models.rings_shank_textures_details.c.textures_details_id, shank_textures_ids)
        if subq is not None:
            q = q.where(models.Rings.id.in_(subq))

    if hasattr(models, "rings_bands") and bands_ids:
        pivot = models.rings_bands

        if hasattr(pivot.c, "bands_id"):
            pivot_col = pivot.c.bands_id
        elif hasattr(pivot.c, "band_id"):
            pivot_col = pivot.c.band_id
        else:
            raise HTTPException(500, "rings_bands pivot must have bands_id or band_id column")

        subq = require_all(pivot, pivot_col, bands_ids)
        if subq is not None:
            q = q.where(models.Rings.id.in_(subq))

    if hasattr(models, "rings_bands_textures_details") and bands_textures_ids:
        subq = require_all(models.rings_bands_textures_details, models.rings_bands_textures_details.c.textures_details_id, bands_textures_ids)
        if subq is not None:
            q = q.where(models.Rings.id.in_(subq))

    if type_mode in ('rings', 'bands'):
        bands_subq = select(models.rings_bands.c.rings_id).where(
            models.rings_bands.c.rings_id == models.Rings.id
        )
        if type_mode == 'bands':
            q = q.where(bands_subq.exists())
        else:
            q = q.where(~bands_subq.exists())

    rows = db.execute(q.limit(200)).scalars().all()

    out = []
    for r in rows:
        out.append({
            "id": r.id,
            "finger_size_id": r.finger_size_id,
            "code": 10000000 + r.id,
            "path_3dm": r.path_3dm,
            "path_stl": r.path_stl,
            "pictures_folder": r.pictures_folder,
            "ring_type_names": [rt.ring_name for rt in r.ring_types],
            "band_names": [b.band_name for b in r.bands],
            "head_setting_names": [hs.head_setting_name for hs in r.head_settings],
            "shank_type_names": [st.shank_type_name for st in r.shank_types],
            "profile_names": [p.profiles_name for p in r.profiles],
            "head_texture_names": [t.textures_details_name for t in r.head_textures],
            "shank_texture_names": [t.textures_details_name for t in r.shank_textures],
            "head_gem": {
                "settings": r.head_gems[0].head_stone_setting.name,
                "shape": r.head_gems[0].stone_shape.stone_shape_name,
                "direction": r.head_gems[0].directions.directions_name,
                "size": r.head_gems[0].stone_size,
                "count": r.head_gems[0].stone_count,
            } if r.head_gems else None,
            "shank_gems": [
                {
                    "settings": g.shank_stone_setting.name,
                    "shape": g.stone_shape.stone_shape_name,
                    "direction": g.directions.directions_name,
                    "size": g.stone_size,
                    "count": g.stone_count,
                }
                for g in r.shank_gems
            ],
            "finger_size": str(r.finger_size.finger_sizes_name) if r.finger_size else None,
            "us_size": str(r.finger_size.finger_sizes_name) if r.finger_size else None,
        })

    return {"count": len(out), "items": out}
