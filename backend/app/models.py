# backend/models.py
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Table, Column, Integer, String, DateTime, ForeignKey, DECIMAL, Boolean
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# -------------------------
# Auth: users
# -------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="uploader", nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)


# -------------------------
# Lookup tables (simple)
# -------------------------

class RingType(Base):
    __tablename__ = "ring_type"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ring_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    rings: Mapped[List["Rings"]] = relationship(
        secondary="rings_ring_type",
        back_populates="ring_types",
        lazy="selectin",
    )


class Bands(Base):
    __tablename__ = "bands"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    band_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    rings: Mapped[List["Rings"]] = relationship(
        secondary="rings_bands",
        back_populates="bands",
        lazy="selectin",
    )


class HeadSetting(Base):
    __tablename__ = "head_setting"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    head_setting_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    rings: Mapped[List["Rings"]] = relationship(
        secondary="rings_head_setting",
        back_populates="head_settings",
        lazy="selectin",
    )


class ShankType(Base):
    __tablename__ = "shank_type"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    shank_type_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    rings: Mapped[List["Rings"]] = relationship(
        secondary="rings_shank_type",
        back_populates="shank_types",
        lazy="selectin",
    )


class Profiles(Base):
    __tablename__ = "profiles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profiles_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    rings: Mapped[List["Rings"]] = relationship(
        secondary="rings_profiles",
        back_populates="profiles",
        lazy="selectin",
    )


class HeadStoneSetting(Base):
    __tablename__ = "head_stone_setting"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)


class ShankBandsStoneSetting(Base):
    __tablename__ = "shank_bands_stone_setting"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)


class ShankStoneSetting(Base):
    __tablename__ = "shank_stone_setting"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)


class StoneShape(Base):
    __tablename__ = "stone_shape"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stone_shape_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)


class Directions(Base):
    __tablename__ = "directions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    directions_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)


class TexturesDetails(Base):
    __tablename__ = "textures_details"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    textures_details_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    rings_head: Mapped[List["Rings"]] = relationship(
        secondary="rings_head_textures_details",
        back_populates="head_textures",
        lazy="selectin",
    )
    rings_shank: Mapped[List["Rings"]] = relationship(
        secondary="rings_shank_textures_details",
        back_populates="shank_textures",
        lazy="selectin",
    )


class FingerSizes(Base):
    __tablename__ = "finger_sizes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    finger_sizes_name: Mapped[float] = mapped_column(DECIMAL(4, 2), nullable=False, unique=True)

    rings: Mapped[List["Rings"]] = relationship(back_populates="finger_size", lazy="selectin")


# -------------------------
# Pivot tables (many-to-many)
# -------------------------

rings_ring_type = Table(
    "rings_ring_type",
    Base.metadata,
    Column("rings_id", ForeignKey("rings.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True),
    Column("ring_type_id", ForeignKey("ring_type.id", ondelete="RESTRICT", onupdate="CASCADE"), primary_key=True),
)

rings_head_setting = Table(
    "rings_head_setting",
    Base.metadata,
    Column("rings_id", ForeignKey("rings.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True),
    Column("head_setting_id", ForeignKey("head_setting.id", ondelete="RESTRICT", onupdate="CASCADE"), primary_key=True),
)

rings_shank_type = Table(
    "rings_shank_type",
    Base.metadata,
    Column("rings_id", ForeignKey("rings.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True),
    Column("shank_type_id", ForeignKey("shank_type.id", ondelete="RESTRICT", onupdate="CASCADE"), primary_key=True),
)

rings_profiles = Table(
    "rings_profiles",
    Base.metadata,
    Column("rings_id", ForeignKey("rings.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True),
    Column("profiles_id", ForeignKey("profiles.id", ondelete="RESTRICT", onupdate="CASCADE"), primary_key=True),
)

rings_head_textures_details = Table(
    "rings_head_textures_details",
    Base.metadata,
    Column("rings_id", ForeignKey("rings.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True),
    Column("textures_details_id", ForeignKey("textures_details.id", ondelete="RESTRICT", onupdate="CASCADE"), primary_key=True),
)

rings_shank_textures_details = Table(
    "rings_shank_textures_details",
    Base.metadata,
    Column("rings_id", ForeignKey("rings.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True),
    Column("textures_details_id", ForeignKey("textures_details.id", ondelete="RESTRICT", onupdate="CASCADE"), primary_key=True),
)

rings_bands = Table(
    "rings_bands",
    Base.metadata,
    Column("rings_id", ForeignKey("rings.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True),
    Column("bands_id", ForeignKey("bands.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True),
)

rings_bands_textures_details = Table(
    "rings_bands_textures_details",
    Base.metadata,
    Column("rings_id", ForeignKey("rings.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True),
    Column("textures_details_id", ForeignKey("textures_details.id", ondelete="RESTRICT", onupdate="CASCADE"), primary_key=True),
)


# -------------------------
# Main entity: Rings
# -------------------------

class Rings(Base):
    __tablename__ = "rings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    path_3dm: Mapped[str] = mapped_column(String(1024), nullable=False)
    path_stl: Mapped[str] = mapped_column(String(1024), nullable=False)
    pictures_folder: Mapped[str] = mapped_column(String(1024), nullable=False)

    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)

    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )

    finger_size_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("finger_sizes.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True
    )
    finger_size: Mapped[Optional[FingerSizes]] = relationship(back_populates="rings", lazy="selectin")

    # many-to-many
    ring_types: Mapped[List[RingType]] = relationship(
        secondary="rings_ring_type",
        back_populates="rings",
        lazy="selectin",
    )
    bands: Mapped[List[Bands]] = relationship(
        secondary="rings_bands",
        back_populates="rings",
        lazy="selectin",
    )
    head_settings: Mapped[List[HeadSetting]] = relationship(
        secondary="rings_head_setting",
        back_populates="rings",
        lazy="selectin",
    )
    shank_types: Mapped[List[ShankType]] = relationship(
        secondary="rings_shank_type",
        back_populates="rings",
        lazy="selectin",
    )
    profiles: Mapped[List[Profiles]] = relationship(
        secondary="rings_profiles",
        back_populates="rings",
        lazy="selectin",
    )
    head_textures: Mapped[List[TexturesDetails]] = relationship(
        secondary="rings_head_textures_details",
        back_populates="rings_head",
        lazy="selectin",
    )
    shank_textures: Mapped[List[TexturesDetails]] = relationship(
        secondary="rings_shank_textures_details",
        back_populates="rings_shank",
        lazy="selectin",
    )
    bands_textures: Mapped[List[TexturesDetails]] = relationship(
        secondary="rings_bands_textures_details",
        lazy="selectin",
    )

    # one-to-many (child entity tables)
    head_gems: Mapped[List["HeadGems"]] = relationship(
        back_populates="ring",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    shank_gems: Mapped[List["ShankGems"]] = relationship(
        back_populates="ring",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    bands_gems: Mapped[List["BandsGems"]] = relationship(
        back_populates="ring",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


# -------------------------
# Child entities: HeadGems, ShankGems, BandsGems
# -------------------------

class HeadGems(Base):
    __tablename__ = "head_gems"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    rings_id: Mapped[int] = mapped_column(
        ForeignKey("rings.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False
    )
    ring: Mapped[Rings] = relationship(back_populates="head_gems", lazy="selectin")

    head_stone_setting_id: Mapped[int] = mapped_column(
        ForeignKey("head_stone_setting.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False
    )
    stone_shape_id: Mapped[int] = mapped_column(
        ForeignKey("stone_shape.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False
    )
    directions_id: Mapped[int] = mapped_column(
        ForeignKey("directions.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False
    )

    stone_size: Mapped[str] = mapped_column(String(32), nullable=False)
    stone_count: Mapped[int] = mapped_column(Integer, nullable=False)

    head_stone_setting: Mapped[HeadStoneSetting] = relationship(lazy="selectin")
    stone_shape: Mapped[StoneShape] = relationship(lazy="selectin")
    directions: Mapped[Directions] = relationship(lazy="selectin")


class ShankGems(Base):
    __tablename__ = "shank_gems"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    rings_id: Mapped[int] = mapped_column(
        ForeignKey("rings.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False
    )
    ring: Mapped[Rings] = relationship(back_populates="shank_gems", lazy="selectin")

    shank_stone_setting_id: Mapped[int] = mapped_column(
        ForeignKey("shank_stone_setting.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False
    )
    stone_shape_id: Mapped[int] = mapped_column(
        ForeignKey("stone_shape.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False
    )
    directions_id: Mapped[int] = mapped_column(
        ForeignKey("directions.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False
    )

    stone_size: Mapped[str] = mapped_column(String(32), nullable=False)
    stone_count: Mapped[int] = mapped_column(Integer, nullable=False)

    shank_stone_setting: Mapped[ShankStoneSetting] = relationship(lazy="selectin")
    stone_shape: Mapped[StoneShape] = relationship(lazy="selectin")
    directions: Mapped[Directions] = relationship(lazy="selectin")


class BandsGems(Base):
    __tablename__ = "bands_gems"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    rings_id: Mapped[int] = mapped_column(
        ForeignKey("rings.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False
    )
    ring: Mapped["Rings"] = relationship(back_populates="bands_gems", lazy="selectin")

    shank_bands_stone_setting_id: Mapped[int] = mapped_column(
        ForeignKey("shank_bands_stone_setting.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False
    )
    stone_shape_id: Mapped[int] = mapped_column(
        ForeignKey("stone_shape.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False
    )
    directions_id: Mapped[int] = mapped_column(
        ForeignKey("directions.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False
    )

    stone_size: Mapped[str] = mapped_column(String(32), nullable=False)
    stone_count: Mapped[int] = mapped_column(Integer, nullable=False)

    shank_bands_stone_setting: Mapped[ShankBandsStoneSetting] = relationship(lazy="selectin")
    stone_shape: Mapped[StoneShape] = relationship(lazy="selectin")
    directions: Mapped[Directions] = relationship(lazy="selectin")
