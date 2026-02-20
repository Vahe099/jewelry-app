// API client for the Jewelry FastAPI backend.
// All requests go through the Vite dev-server proxy (/api → http://localhost:8000).

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
function matchIds(names: string[], items: LookupItem[]): number[] {
  const normalized = names.map(n => n.toLowerCase());
  return items
    .filter(item => {
      const itemName = item.name.toLowerCase();
      return normalized.some(n => n === itemName || n.startsWith(itemName) || itemName.startsWith(n));
    })
    .map(item => item.id);
}

export async function fetchLookups(): Promise<Lookups> {
  const res = await fetch('/api/lookups');
  if (!res.ok) throw new Error(`Failed to fetch lookups: ${res.status}`);
  return res.json();
}

export async function searchRings(
  filters: SearchFilters,
  lookups: Lookups,
): Promise<{ count: number; items: Ring[] }> {
  const payload = {
    ring_type_ids:      matchIds(filters.selectedDetailItems, lookups.ring_types),
    head_setting_ids:   matchIds(filters.selectedHeadItems, lookups.head_settings),
    shank_type_ids:     matchIds(filters.selectedShankItems, lookups.shank_types),
    profiles_ids:       matchIds(filters.selectedProfileItems, lookups.profiles),
    head_textures_ids:  matchIds(filters.headTextureItems, lookups.textures),
    shank_textures_ids: matchIds(filters.shankTextureItems, lookups.textures),
    bands_ids:          matchIds(filters.selectedShankItems, lookups.bands),
    bands_textures_ids: [],
  };

  const res = await fetch('/api/rings/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}
