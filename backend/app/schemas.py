# backend/schemas.py
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# -------------------------
# Basic lookup schemas
# -------------------------

class LookupItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


# -------------------------
# Gems schemas
# -------------------------

class HeadGemCreate(BaseModel):
    head_stone_setting_id: int
    stone_shape_id: int
    directions_id: int
    stone_size: str = Field(min_length=1, max_length=32)
    stone_count: int = Field(default=1, ge=1)


class ShankBandGemCreate(BaseModel):
    shank_bands_stone_setting_id: int
    stone_shape_id: int
    directions_id: int
    stone_size: str = Field(min_length=1, max_length=32)
    stone_count: int = Field(default=1, ge=1)



class HeadGemRead(HeadGemCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ShankBandGemRead(ShankBandGemCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int

# -------------------------
# Rings schemas
# -------------------------

class RingCreate(BaseModel):
    path_3dm: str = Field(min_length=1, max_length=1024)
    path_stl: str = Field(min_length=1, max_length=1024)
    pictures_folder: str = Field(min_length=1, max_length=1024)

    finger_size_id: int

    ring_type_ids: List[int] = []
    head_setting_ids: List[int] = []
    shank_type_ids: List[int] = []
    profiles_ids: List[int] = []
    head_textures_ids: List[int] = []
    shank_textures_ids: List[int] = []

    bands_ids: List[int] = []
    bands_textures_ids: List[int] = []

    head_gems: List[HeadGemCreate] = []
    shank_gems: List[ShankBandGemCreate] = []
    bands_gems: List[ShankBandGemCreate] = []


class RingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    path_3dm: str
    path_stl: str
    pictures_folder: str
    finger_size_id: int
    created_at: Optional[datetime] = None

    # nested (optional)
    ring_type_ids: List[int] = []
    head_setting_ids: List[int] = []
    shank_type_ids: List[int] = []
    profiles_ids: List[int] = []
    head_textures_ids: List[int] = []
    shank_textures_ids: List[int] = []

    bands_ids: List[int] = []
    bands_textures_ids: List[int] = []

    head_gems: List[HeadGemRead] = []
    shank_gems: List[ShankBandGemRead] = []
    bands_gems: List[ShankBandGemRead] = []
