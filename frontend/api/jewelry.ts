// API client for the Jewelry FastAPI backend.
// Set VITE_API_BASE_URL in .env.local; falls back to direct localhost for dev.
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:8000';

export interface LookupItem {
  id: number;
  name: string;
}

export interface Lookups {
  ring_types: LookupItem[];
  head_settings: LookupItem[];
  shank_types: LookupItem[];
  profiles: LookupItem[];
  textures: LookupItem[];
  bands: LookupItem[];
  finger_sizes: LookupItem[];
  head_stone_settings: LookupItem[];
  shank_bands_stone_settings: LookupItem[];
  stone_shapes: LookupItem[];
  directions: LookupItem[];
}

export interface Ring {
  id: number;
  code: number;
  finger_size: string;
  path_3dm: string;
  path_stl: string;
  pictures_folder: string;
  ring_type_names: string[];
  head_setting_names: string[];
  shank_type_names: string[];
  profile_names: string[];
  texture_names: string[];
}

export interface SearchFilters {
  selectedDetailItems: string[];
  selectedHeadItems: string[];
  selectedShankItems: string[];
  selectedProfileItems: string[];
  headTextureItems: string[];
  shankTextureItems: string[];
}

// Case-insensitive name → ID matching.
// Allows partial matches: if the frontend label starts with a DB name or vice versa.
export function matchIds(names: string[], items: LookupItem[]): number[] {
  const normalized = names.map(n => n.toLowerCase());
  return items
    .filter(item => {
      const itemName = item.name.toLowerCase();
      return normalized.some(n => n === itemName || n.startsWith(itemName) || itemName.startsWith(n));
    })
    .map(item => item.id);
}

export async function fetchLookups(): Promise<Lookups> {
  const res = await fetch(`${API_BASE}/api/lookups`);
  if (!res.ok) throw new Error(`Failed to fetch lookups: ${res.status}`);
  return res.json();
}

export async function searchRings(
  filters: SearchFilters,
  lookups: Lookups,
): Promise<{ count: number; items: Ring[] }> {
  const payload = {
    ring_type_ids:      matchIds(filters.selectedDetailItems, lookups.ring_types),
    head_setting_ids:   matchIds(filters.selectedHeadItems,   lookups.head_settings),
    shank_type_ids:     matchIds(filters.selectedShankItems,  lookups.shank_types),
    profiles_ids:       matchIds(filters.selectedProfileItems, lookups.profiles),
    head_textures_ids:  matchIds(filters.headTextureItems,    lookups.textures),
    shank_textures_ids: matchIds(filters.shankTextureItems,   lookups.textures),
    bands_ids:          matchIds(filters.selectedShankItems,  lookups.bands),
    bands_textures_ids: [],
  };

  const res = await fetch(`${API_BASE}/api/rings/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

export async function createRing(
  formData: FormData,
): Promise<{ ok: boolean; rings_id: number; code: number }> {
  const res = await fetch(`${API_BASE}/create-ring`, {
    method: 'POST',
    body: formData,
    // No Content-Type header — browser sets it with the correct multipart boundary.
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchRingImages(ringId: number): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/rings/${ringId}/images`);
  if (!res.ok) return [];
  const data: { images: string[] } = await res.json();
  return data.images.map(path => `${API_BASE}${path}`);
}
