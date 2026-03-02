import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { fetchLookups, searchRings, createRing, matchIds, fetchRingFiles, login, register, me, getAuthToken, clearAuthToken, type Ring, type Lookups, type LookupItem } from './api/jewelry.ts';
import { Pencil, X, Moon, Sun, Search, ArrowLeft, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Maximize2, LogOut, Download } from 'lucide-react';
import JSZip from 'jszip';
import StlViewer from './components/StlViewer';

// Define constants for ring sizes and menu labels
const INTEGER_SIZE_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"];
const SUFFIX_OPTIONS = [".25", ".5", ".75"];

// The image provided by the user in the prompt
const DEFAULT_PRODUCT_IMAGE = "https://raw.githubusercontent.com/ai-studio-assets/jewelry-renders/main/emerald-ring-layout.jpg";

const menuLabels = [
  "JEWELRY TYPE", // 0
  "TYPE",          // 1 - Renamed from COLLECTION
  "TYPE",         // 2
  "TYPE",         // 3
  "Details",      // 4
  "HEAD",         // 5 
  "MAIN GEM",     // 6
  "HEAD",         // 7
  "PRONGS",       // 8
  "GEMS",         // 9 
  "",             // 10
  "SETTING",      // 11
  "SHAPE",        // 12
  "DIRECTION",    // 13
  "TYPE",         // 14
  "PROFILE",      // 15
  "SHANK",        // 16
  "",             // 17
  "SETTING",      // 18
  "TEXTURES"      // 19
];

interface ConfigData {
  selectedOptions: Record<number, string[]>;
  selectedDetailItems: string[];
  selectedHeadItems: string[];
  selectedShankItems: string[];
  selectedProfileItems: string[];
  selectedSizeItems: string[];
  mainGemsSettings: string[];
  mainGemsShapes: string[];
  mainGemsDirections: string[];
  mainGemsSize: string;
  mainGemsCount: string;
  headSecSettings: string[];
  headSecShapes: string[];
  headSecDirections: string[];
  headSecSize: string;
  headSecCount: string;
  shankSecSettings: string[];
  shankSecShapes: string[];
  shankSecDirections: string[];
  shankSecSize: string;
  shankSecCount: string;
  sizeInputBuffer: string;
  history: Record<number, string[]>[];
  redoStack: Record<number, string[]>[];
}

type ShankGemRow = { settings: string; settingId: number | null; shapes: string; directions: string; size: string; count: string };
const mkShankGem = (): ShankGemRow => ({ settings: '', settingId: null, shapes: '', directions: '', size: '', count: '' });

const initialConfig = (): ConfigData => ({
  selectedOptions: {},
  selectedDetailItems: [],
  selectedHeadItems: [],
  selectedShankItems: [],
  selectedProfileItems: [],
  selectedSizeItems: [],
  mainGemsSettings: [],
  mainGemsShapes: [],
  mainGemsDirections: [],
  mainGemsSize: "",
  mainGemsCount: "",
  headSecSettings: [],
  headSecShapes: [],
  headSecDirections: [],
  headSecSize: "",
  headSecCount: "",
  shankSecSettings: [],
  shankSecShapes: [],
  shankSecDirections: [],
  shankSecSize: "",
  shankSecCount: "",
  sizeInputBuffer: "",
  history: [],
  redoStack: []
});

const AppContent: React.FC = () => {
  const fetchIdRef = useRef(0);
  const detailsDropdownRef = useRef<HTMLDivElement>(null);
  const scrollListRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headPageRef = useRef<HTMLDivElement | null>(null);
  const shankPageRef = useRef<HTMLDivElement | null>(null);
  
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(0);
  const [menuHistory, setMenuHistory] = useState<number[]>([0]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isSerchExpanded, setIsSerchExpanded] = useState(false);
  const [targetCategoryIndex, setTargetCategoryIndex] = useState<number>(2);
  
  const [activeJewelryType, setActiveJewelryType] = useState<'ring' | 'band'>('ring');

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  // ── React Router: URL → state sync ─────────────────────────────────────
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '/') {
      navigate('/jewelry-type', { replace: true });
      return;
    }
    const arraysEqual = (a: number[], b: number[]) =>
      a.length === b.length && a.every((v, i) => v === b[i]);
    const routeMap: Record<string, { idx: number; history: number[]; target?: number; type?: 'ring' | 'band' }> = {
      '/jewelry-type': { idx: 0, history: [0]       },
      '/type':         { idx: 1, history: [0, 1]     },
      '/rings':        { idx: 4, history: [0, 1, 4], target: 2, type: 'ring' },
      '/bands':        { idx: 4, history: [0, 1, 4], target: 3, type: 'band' },
    };
    const e = routeMap[location.pathname];
    if (!e) return;
    setActiveMenuIndex(prev => prev === e.idx               ? prev : e.idx);
    setMenuHistory    (prev => arraysEqual(prev, e.history) ? prev : e.history);
    if (e.target !== undefined) setTargetCategoryIndex(prev => prev === e.target ? prev : e.target!);
    if (e.type   !== undefined) setActiveJewelryType  (prev => prev === e.type   ? prev : e.type!);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  // ───────────────────────────────────────────────────────────────────────

  const [ringStore, setRingStore] = useState<ConfigData>(initialConfig());
  const [bandStore, setBandStore] = useState<ConfigData>(initialConfig());

  const [gemBuilderType, setGemBuilderType] = useState<'main' | 'secondary'>('main');
  const [editingItemCode, setEditingItemCode] = useState<string | null>(null);

  const [selectedDetailItems, setSelectedDetailItems] = useState<string[]>([]);
  const [selectedHeadItems, setSelectedHeadItems] = useState<string[]>([]);
  const [selectedShankItems, setSelectedShankItems] = useState<string[]>([]);
  const [selectedProfileItems, setSelectedProfileItems] = useState<string[]>([]);
  const [selectedSizeItems, setSelectedSizeItems] = useState<string[]>([]);

  const [mainGemsSettings, setMainGemsSettings] = useState<string[]>([]);
  const [mainGemsShapes, setMainGemsShapes] = useState<string[]>([]);
  const [mainGemsDirections, setMainGemsDirections] = useState<string[]>([]);
  const [mainGemsSize, setMainGemsSize] = useState<string>("");
  const [mainGemsCount, setMainGemsCount] = useState<string>("");
  const [extraGemRows, setExtraGemRows] = useState<Array<{settingId: string, shapeId: string, directionId: string, size: string, count: string}>>([]);

  const [headSecSettings, setHeadSecSettings] = useState<string[]>([]);
  const [headSecShapes, setHeadSecShapes] = useState<string[]>([]);
  const [headSecDirections, setHeadSecDirections] = useState<string[]>([]);
  const [headSecSize, setHeadSecSize] = useState<string>("");
  const [headSecCount, setHeadSecCount] = useState<string>("");

  const [shankSecSettings, setShankSecSettings] = useState<string[]>([]);
  const [shankSecShapes, setShankSecShapes] = useState<string[]>([]);
  const [shankSecDirections, setShankSecDirections] = useState<string[]>([]);
  const [shankSecSize, setShankSecSize] = useState<string>("");
  const [shankSecCount, setShankSecCount] = useState<string>("");

  const [isShankSubflow, setIsShankSubflow] = useState<boolean>(false);
  const [isInteractiveMode, setIsInteractiveMode] = useState<boolean>(false);

  const [activeDropdown, setActiveDropdown] = useState<'details-size' | null>(null);
  const [sizeInputBuffer, setSizeInputBuffer] = useState<string>("");
  const [showSuffixMenu, setShowSuffixMenu] = useState<boolean>(false);

  const [selectedOptions, setSelectedOptions] = useState<Record<number, string[]>>({});
  const [history, setHistory] = useState<Record<number, string[]>[]>([]);
  const [redoStack, setRedoStack] = useState<Record<number, string[]>[]>([]);

  // Real data from the backend
  const [rings, setRings] = useState<Ring[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const validSizes = useMemo(
    () => (lookups?.finger_sizes || []).map(x => String(x.name)),
    [lookups]
  );

  // Upload state for the "ADD TO LIB" modal
  const [file3dm, setFile3dm] = useState<File | null>(null);
  const [fileStl, setFileStl] = useState<File | null>(null);
  const [picFiles, setPicFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [uploadRevision, setUploadRevision] = useState(0);
  const [headGemPickerField, setHeadGemPickerField] = useState<'settings' | 'shapes' | 'directions' | 'head_setting' | 'head_texture_details' | 'ring_type' | 'band_type' | 'shank_settings' | 'shank_shapes' | 'shank_directions' | 'shank_type' | 'shank_texture_details' | 'profile' | null>(null);
  const [shankGems, setShankGems] = useState<ShankGemRow[]>([mkShankGem()]);
  const [shankPickerRow, setShankPickerRow] = useState(0);
  const updateShankGem = (idx: number, patch: Partial<ShankGemRow>) =>
    setShankGems(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const [selectedHeadSettingIds, setSelectedHeadSettingIds] = useState<number[]>([]);
  const [selectedHeadTextureIds, setSelectedHeadTextureIds] = useState<number[]>([]);
  const [selectedRingTypeIds, setSelectedRingTypeIds] = useState<number[]>([]);
  const [selectedShankTypeIds, setSelectedShankTypeIds] = useState<number[]>([]);
  const [selectedShankTextureIds, setSelectedShankTextureIds] = useState<number[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<number[]>([]);
  const [selectedBandTypeIds, setSelectedBandTypeIds] = useState<number[]>([]);

  const listItemsCount = rings.length;
  const thumbHeight = 128; // h-32 in Tailwind is 8rem = 128px
  
  // Adjusted gaps: top is 2px, bottom is reduced to -2px to be strictly smaller and flush
  const topPadding = 2; 
  const bottomPadding = -2; 

  const [thumbTop, setThumbTop] = useState(topPadding);
  const [isDraggingThumb, setIsDraggingThumb] = useState(false);

  const [selectedListItem, setSelectedListItem] = useState<number | null>(null);
  const [infoRing, setInfoRing] = useState<any | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(DEFAULT_PRODUCT_IMAGE);
  const [ringImages, setRingImages] = useState<string[]>([]);
  const [ringStl, setRingStl] = useState<string | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'IMAGE' | 'STL' | '3DM'>('IMAGE');
  const [libraryImages, setLibraryImages] = useState<Record<number, string>>({});

  const [isLoadingRings, setIsLoadingRings] = useState<boolean>(true);
  const [showSummaryOverlay, setShowSummaryOverlay] = useState<boolean>(false);
  const [overlayPage, setOverlayPage] = useState<number>(0);
  const [isFullScreenImage, setIsFullScreenImage] = useState<boolean>(false);

  const menuData = useMemo<Record<number, string[]>>(() => {
    const names = (list: LookupItem[] | undefined) => (list || []).map(x => x.name);
    return {
      0: ["Rings", "Earrings", "Bracelets", "Necklace", "Body Jewelry", "Accessories"],
      1: ["Rings", "Bands"],
      2: names(lookups?.ring_types),
      3: names(lookups?.bands),
      5: ["HEAD", "MineGem", "GEMS", "", "Texture&Details", ""],
      7: names(lookups?.head_settings),
      8: names(lookups?.head_stone_settings),
      9: ["Secondary Settings", "Shape", "Direction", "Size", "Count"],
      11: names(lookups?.head_stone_settings),
      12: names(lookups?.stone_shapes),
      13: names(lookups?.directions),
      14: names(lookups?.shank_types),
      15: names(lookups?.profiles),
      16: ["TYPE", "", "GEMS", "", "Texture&Details", ""],
      18: names(lookups?.shank_stone_settings),
      19: names(lookups?.textures),
    };
  }, [lookups]);

  // Fetch lookup tables once on mount
  useEffect(() => {
    fetchLookups().then(setLookups).catch(console.error);
  }, []);

  // Restore user session on mount
  useEffect(() => {
    if (!getAuthToken()) return;
    me().then(data => setUserEmail(data.email)).catch(() => clearAuthToken());
  }, []);

  // Focus HEAD/SHANK page wrapper so Enter key works immediately on arrival
  useEffect(() => {
    if (activeMenuIndex === 5) headPageRef.current?.focus();
    if (activeMenuIndex === 16) shankPageRef.current?.focus();
  }, [activeMenuIndex]);

  // Restore focus after gem picker closes so Enter keeps working without manual click
  useEffect(() => {
    if (activeMenuIndex === 5 && headGemPickerField === null) {
      requestAnimationFrame(() => headPageRef.current?.focus());
    }
    if (activeMenuIndex === 16 && headGemPickerField === null) {
      requestAnimationFrame(() => shankPageRef.current?.focus());
    }
  }, [activeMenuIndex, headGemPickerField]);

  // Re-run search whenever lookups are ready or any filter changes (debounced 300 ms)
  useEffect(() => {
    if (!lookups) return;
    const reqId = ++fetchIdRef.current;
    setIsLoadingRings(true);
    const headTextureItems  = (selectedOptions[19] || []).filter(t => !selectedShankItems.includes(t));
    const shankTextureItems = (selectedOptions[19] || []).filter(t =>  selectedShankItems.includes(t));
    const timer = setTimeout(() => {
      searchRings(
        { selectedDetailItems, selectedHeadItems, selectedShankItems, selectedProfileItems, headTextureItems, shankTextureItems, type_mode: activeJewelryType === 'band' ? 'bands' : 'rings' },
        lookups,
      ).then(data => {
        if (reqId !== fetchIdRef.current) return; // stale response — discard
        setRings(data.items);
        setTotalCount(data.count);
        setIsLoadingRings(false);
        if (data.items.length === 0) {
          setSelectedListItem(null);
          setSelectedImage(null);
          setRingImages([]);
          setRingStl(null);
          setShowSummaryOverlay(false);
        }
      }).catch(e => { if (reqId === fetchIdRef.current) { console.error(e); setIsLoadingRings(false); } });
    }, 300);
    return () => clearTimeout(timer);
  }, [lookups, selectedDetailItems, selectedHeadItems, selectedShankItems, selectedProfileItems, selectedOptions, uploadRevision, activeJewelryType]);

  // Clear selection immediately when jewelry type mode switches (before search result arrives)
  useEffect(() => {
    setIsLoadingRings(true);
    setSelectedListItem(null);
    setSelectedImage(null);
    setRingImages([]);
    setRingStl(null);
    setShowSummaryOverlay(false);
  }, [activeJewelryType]);

  // Auto-select first ring when ring list loads or becomes valid
  useEffect(() => {
    if (rings.length > 0 && (selectedListItem === null || rings[selectedListItem - 1] === undefined)) {
      handleListItemClick(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rings, selectedListItem]);

  const downloadRingFilesZip = async (ring: Ring) => {
    const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:8000';
    const code = String(ring.code);
    const url3dm = `${API_BASE}/3dm/${code}.3dm`;
    const urlStl = `${API_BASE}/stl/${code}.stl`;
    try {
      const [res3dm, resStl] = await Promise.all([fetch(url3dm), fetch(urlStl)]);
      if (!res3dm.ok && !resStl.ok) { setUploadError(`Files not found for ring ${code}.`); return; }
      const zip = new JSZip();
      const folder = zip.folder(code)!;
      if (res3dm.ok) folder.file(`${code}.3dm`, await res3dm.blob());
      if (resStl.ok) folder.file(`${code}.stl`, await resStl.blob());
      if (!res3dm.ok) setUploadError(`3DM not found for ${code} — ZIP contains STL only.`);
      if (!resStl.ok) setUploadError(`STL not found for ${code} — ZIP contains 3DM only.`);
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${code}_files.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setUploadError(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCancel = () => {
    setFile3dm(null);
    setFileStl(null);
    setPicFiles([]);
    setUploadError(null);
    setSelectedRingTypeIds([]);
    setSelectedHeadSettingIds([]);
    setSelectedHeadTextureIds([]);
    setSelectedShankTypeIds([]);
    setSelectedShankTextureIds([]);
    setSelectedProfileIds([]);
    setSelectedBandTypeIds([]);
    setMainGemsSettings([]);
    setMainGemsShapes([]);
    setMainGemsDirections([]);
    setMainGemsSize("");
    setMainGemsCount("");
    setShankGems([mkShankGem()]);
    setShankPickerRow(0);
    setSelectedSizeItems([]);
    setSizeInputBuffer('');
    setHeadGemPickerField(null);
  };

  const handleSaveToLibrary = async () => {
    if (!lookups) return;
    setUploadError(null);
    if (!userEmail) {
      navigate('/login');
      return;
    }
    const formatMissing = (items: string[]): string => {
      const top: string[] = []; const mainGem: string[] = []; const shankGem: string[] = [];
      for (const m of items) {
        if (m.startsWith('MAIN GEM → ')) mainGem.push(m.slice(11));
        else if (m.startsWith('SHANK GEMS → ')) shankGem.push(m.slice(13));
        else top.push(m);
      }
      const parts: string[] = [];
      if (top.length > 0) parts.push(`Missing: ${top.join(', ')}`);
      if (mainGem.length > 0) parts.push(`MAIN GEM is incomplete: ${mainGem.join(', ')}`);
      if (shankGem.length > 0) parts.push(`SHANK GEMS incomplete: ${shankGem.join(', ')}`);
      return parts.join('. ') + '.';
    };

    const missing: string[] = [];
    if (!file3dm) missing.push('3DM FILE');
    if (!fileStl) missing.push('STL FILE');
    if (picFiles.length === 0) missing.push('IMAGES');
    const sizeEntry = lookups.finger_sizes.find(fs => String(fs.name) === (selectedSizeItems[0] || ''));
    const fsId = sizeEntry?.id ?? 0;
    if (!fsId) missing.push('US SIZE');
    const isBandMode = activeJewelryType === 'band' || activeJewelryType === 'bands';
    if (isBandMode ? selectedBandTypeIds.length === 0 : selectedRingTypeIds.length === 0) missing.push('TYPE');
    if (selectedProfileIds.length === 0) missing.push('PROFILE');
    if (!isBandMode) {
      const mainSettingId = matchIds(mainGemsSettings, lookups.head_stone_settings)[0];
      const mainShapeId   = matchIds(mainGemsShapes,    lookups.stone_shapes)[0];
      const mainDirId     = matchIds(mainGemsDirections, lookups.directions)[0];
      if (!mainSettingId) missing.push('MAIN GEM → SETTINGS');
      if (!mainShapeId)   missing.push('MAIN GEM → SHAPE');
      if (!mainDirId)     missing.push('MAIN GEM → DIRECTION');
      if (!mainGemsSize.trim()) missing.push('MAIN GEM → SIZE');
      const mainCount = parseInt(mainGemsCount, 10);
      if (!mainCount || mainCount <= 0) missing.push('MAIN GEM → COUNT');
      const shankTouched = shankGems.some(r => r.settingId !== null || r.shapes !== '' || r.directions !== '' || r.size.trim() !== '' || parseInt(r.count, 10) > 0);
      if (shankTouched) {
        shankGems.forEach((r, i) => {
          const lbl = shankGems.length > 1 ? `SHANK GEM ${i + 1}` : 'SHANK GEMS';
          if (!r.settingId) missing.push(`${lbl} → SETTINGS`);
          if (!matchIds([r.shapes],    lookups.stone_shapes)[0]) missing.push(`${lbl} → SHAPE`);
          if (!matchIds([r.directions], lookups.directions)[0])  missing.push(`${lbl} → DIRECTION`);
          if (!r.size.trim()) missing.push(`${lbl} → SIZE`);
          const c = parseInt(r.count, 10);
          if (!c || c <= 0) missing.push(`${lbl} → COUNT`);
        });
      }
    }
    if (missing.length > 0) { setUploadError(formatMissing(missing)); return; }

    const formData = new FormData();
    formData.append('file_3dm', file3dm);
    formData.append('file_stl', fileStl);
    picFiles.forEach(f => formData.append('pictures', f));
    formData.append('finger_size_id', String(fsId));

    const appendIds = (key: string, names: string[], pool: LookupItem[]) =>
      matchIds(names, pool).forEach(id => formData.append(key, String(id)));

    selectedRingTypeIds.forEach(id => formData.append('ring_type_ids', String(id)));
    selectedHeadSettingIds.forEach(id => formData.append('head_setting_ids', String(id)));
    selectedShankTypeIds.forEach(id => formData.append('shank_type_ids', String(id)));
    selectedProfileIds.forEach(id => formData.append('profiles_ids', String(id)));
    selectedHeadTextureIds.forEach(id => formData.append('head_textures_ids', String(id)));
    selectedShankTextureIds.forEach(id => formData.append('shank_textures_ids', String(id)));
    if (targetCategoryIndex !== 3) appendIds('bands_ids', selectedShankItems, lookups.bands);
    selectedBandTypeIds.forEach(id => formData.append('bands_ids', String(id)));
    const mainGem = {
      head_stone_setting_id: matchIds(mainGemsSettings, lookups.head_stone_settings)[0] ?? null,
      stone_shape_id:        matchIds(mainGemsShapes,    lookups.stone_shapes)[0]       ?? null,
      directions_id:         matchIds(mainGemsDirections, lookups.directions)[0]        ?? null,
      stone_size:  mainGemsSize || "",
      stone_count: parseInt(mainGemsCount, 10) || 1,
    };
    const headGems = [
      mainGem,
      ...extraGemRows
        .filter(r => r.settingId && r.shapeId && r.directionId)
        .map(r => ({
          head_stone_setting_id: parseInt(r.settingId, 10),
          stone_shape_id:        parseInt(r.shapeId,   10),
          directions_id:         parseInt(r.directionId, 10),
          stone_size:  r.size,
          stone_count: parseInt(r.count, 10) || 1,
        })),
    ];
    formData.append('head_gems_json', JSON.stringify(headGems));
    const shankGemsJson = shankGems.map(r => ({
      shank_stone_setting_id: r.settingId,
      stone_shape_id:         matchIds([r.shapes],    lookups.stone_shapes)[0] ?? null,
      directions_id:          matchIds([r.directions], lookups.directions)[0]  ?? null,
      stone_size:  r.size || '',
      stone_count: parseInt(r.count, 10) || 1,
    }));
    formData.append('shank_gems_json', JSON.stringify(shankGemsJson));

    setIsUploading(true);
    setUploadError(null);
    try {
      await createRing(formData);
      setFile3dm(null);
      setFileStl(null);
      setPicFiles([]);
      setUploadRevision(r => r + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('401') || msg.includes('403') || msg.includes('Not authenticated')) {
        setUploadError(null);
        navigate('/login');
      } else {
        try {
          const parsed = JSON.parse(msg);
          if (Array.isArray(parsed?.detail?.missing)) { setUploadError(formatMissing(parsed.detail.missing)); }
          else { setUploadError(msg || 'Upload failed'); }
        } catch { setUploadError(msg || 'Upload failed'); }
      }
    } finally {
      setIsUploading(false);
    }
  };

  const navigateTo = (idx: number | null) => {
    const target = idx === null ? 0 : idx;
    if (target === activeMenuIndex) return;
    setMenuHistory(prev => [...prev, target]);
    setActiveMenuIndex(target);
  };

  const closePickerAndReturnToRingSave = () => {
    setHeadGemPickerField(null);
    navigateTo(4);
  };

  const handleOldSchemeBack = () => {
    const idx = activeMenuIndex;
    let target = 0;
    if (idx === 4) target = 1;
    else if (idx === 2 || idx === 3 || idx === 5 || idx === 15 || idx === 16) target = 4;
    else if (idx === 14) target = 16;
    else if (idx === 6 || idx === 7 || idx === 8) target = 5;
    else if (idx === 9 || idx === 19) target = isShankSubflow ? 16 : 5;
    else if (idx === 11 || idx === 12 || idx === 13 || idx === 18) target = gemBuilderType === 'main' ? 6 : 9;
    else if (idx === 1) target = 0;
    navigateTo(target);
    setActiveDropdown(null); 
    setShowSuffixMenu(false);
  };

  const handleHistoryBack = () => {
    if (menuHistory.length > 1) {
      const newHistory = [...menuHistory];
      newHistory.pop();
      const prev = newHistory[newHistory.length - 1];
      setMenuHistory(newHistory);
      setActiveMenuIndex(prev);
    } else {
      setActiveMenuIndex(0);
      setMenuHistory([0]);
    }
    setActiveDropdown(null); 
    setShowSuffixMenu(false);
  };

  const prepareEditState = useCallback((item: string) => {
    if (item.startsWith("US Size: ")) return false;
    setEditingItemCode(item);
    if (item.includes('_')) {
      const isSec = item.startsWith("SEC_");
      const isMain = item.startsWith("M_");
      const parts = isSec ? item.substring(4).split('_') : (isMain ? item.substring(2).split('_') : item.split('_'));
      
      if (isSec) {
        const inShank = selectedShankItems.includes(item);
        setIsShankSubflow(inShank);
        setGemBuilderType('secondary');
        const setter = inShank ? { setSettings: setShankSecSettings, setShapes: setShankSecShapes, setDirections: setShankSecDirections, setSize: setShankSecSize, setCount: setShankSecCount } : { setSettings: setHeadSecSettings, setShapes: setHeadSecShapes, setDirections: setHeadSecDirections, setSize: setHeadSecSize, setCount: setHeadSecCount };
        if (parts[0]) { const foundSetting = menuData[18].find(s => s.substring(0, 3).toUpperCase() === parts[0]); if (foundSetting) setter.setSettings([foundSetting]); }
        if (parts[1]) { const foundShape = menuData[12].find(s => s.substring(0, 3).toUpperCase() === parts[1]); if (foundShape) setter.setShapes([foundShape]); }
        if (parts[2]) { 
           const directionMapRev: Record<string, string> = { "NS": "North-South", "SL": "Slanted", "CA": "Alternating", "EW": "Est-West", "ND": "not directed" };
           const foundDir = directionMapRev[parts[2]] || menuData[13].find(s => s.substring(0, 2).toUpperCase() === parts[2]); 
           if (foundDir) setter.setDirections([foundDir]); 
        }
        if (parts[3]) setter.setSize(parts[3]);
        if (parts[4]) setter.setCount(parts[4]);
      } else {
        setGemBuilderType('main');
        const settingMapRev: Record<string, string> = { "BZ": "Bezel", "HB": "Half bezel", "3P": "Three Prongs", "FP": "Four Prongs", "5P": "Five Prongs", "6P": "Six Prongs", "DP": "Double Prong", "BN": "Burnish", "PG": "Peg" };
        const shapeMapRev: Record<string, string> = { "RD": "Round", "AS": "Asscher", "CU": "Cushion", "EM": "Emerald", "MQ": "Marquise", "Oval": "OV", "Pear": "PR", "PS": "Princess", "RA": "Radiant", "RS": "Radiant SQ", "CS": "Cushion SQ", "HT": "heart", "BG": "Baguette", "Tapered Baguette": "TB", "hexagon": "HX", "Kite": "KT", "Trillion": "TR", "Half Moon" : "HM" };
        const directionMapRev: Record<string, string> = { "NS": "North-South", "S": "Slanted", "CA": "Alternating", "EW": "Est-West", "ND": "not directed" };
        if (parts[0]) { const s = settingMapRev[parts[0]] || menuData[11].find(o => o.substring(0, 2).toUpperCase() === parts[0]); if (s) setMainGemsSettings([s]); }
        if (parts[1]) { const s = shapeMapRev[parts[1]] || menuData[12].find(o => o.substring(0, 2).toUpperCase() === parts[1]); if (s) setMainGemsShapes([s]); }
        if (parts[2]) { const d = directionMapRev[parts[2]] || menuData[13].find(o => o.substring(0, 1).toUpperCase() === parts[2]); if (d) setMainGemsDirections([d]); }
        if (parts[3]) setMainGemsSize(parts[3]);
        if (parts[4]) setMainGemsCount(parts[4]);
      }
      return true;
    }
    return true; 
  }, [selectedShankItems]);

  const handleEditItem = (categoryIndex: number, item: string) => {
    if (prepareEditState(item)) {
      if (item.includes('_')) { navigateTo(item.startsWith("SEC_") ? 9 : 6); } else {
        if ([5, 7, 8].includes(categoryIndex)) { if (menuData[7].includes(item) || item === "Head Setting") { navigateTo(7); return; } if (menuData[8].includes(item)) { navigateTo(8); return; } navigateTo(5); return; }
        if ([14, 16].includes(categoryIndex)) { if (menuData[14].includes(item) || item === "TYPE") { navigateTo(14); return; } navigateTo(16); return; }
        if (categoryIndex === 15) { navigateTo(15); return; }
        if (categoryIndex === 19) { navigateTo(19); return; }
        if ([2, 3, 4].includes(categoryIndex)) { navigateTo(targetCategoryIndex); return; }
        navigateTo(categoryIndex);
      }
      return;
    }
    if (item === "MineGem") { setGemBuilderType('main'); setEditingItemCode(null); navigateTo(6); return; }
    if (item.startsWith("US Size: ")) { navigateTo(4); return; }
    if (item === "") { setEditingItemCode(null); navigateTo(4); return; }
    navigateTo(categoryIndex);
  };

  const renderInteractiveCode = (item: string) => {
    if (!item.includes('_')) return <span>{item}</span>;
    const isSec = item.startsWith("SEC_");
    const isMain = item.startsWith("M_");
    const parts = item.split('_');
    const pencilCursor = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxNmEzNGEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTcgM2EyLjg1IDIuODMgMCAxIDEgNCA0TDcuNSAyMC41IDIgMjJsMS41LTUuNVoiLz48cGF0aCBkPSJtMTUgNSA0IDQiLz48L3N2Zz4=") 0 24, auto';
    return (
      <span className="flex items-center">
        {parts.map((p, i) => {
          let targetIdx = -1;
          if (isSec) { if (i === 1) targetIdx = 18; if (i === 2) targetIdx = 12; if (i === 3) targetIdx = 13; if (i === 4 || i === 5) targetIdx = 9; }
          else if (isMain) { if (i === 1) targetIdx = 11; if (i === 2) targetIdx = 12; if (i === 3) targetIdx = 13; if (i === 4 || i === 5) targetIdx = 6; }
          else { if (i === 0) targetIdx = 11; if (i === 1) targetIdx = 12; if (i === 2) targetIdx = 13; if (i === 3 || i === 4) targetIdx = 6; }
          if (p === 'SEC' || p === 'M') return <span key={i}>{p}_</span>;
          return (
            <React.Fragment key={i}>
              <span onClick={(e) => { e.stopPropagation(); if (targetIdx !== -1) { prepareEditState(item); navigateTo(targetIdx); } }} className="hover:text-red-600 transition-colors duration-75" style={{ cursor: pencilCursor }}>{p}</span>
              {i < parts.length - 1 && <span>_</span>}
            </React.Fragment>
          );
        })}
      </span>
    );
  };

  const generateMainGemsCode = useCallback(() => {
    const settingMap: Record<string, string> = { "Bezel": "BZ", "Half bezel": "HB", "Three Prongs": "3P", "Four Prongs": "FP", "Five Prongs": "5P", "Six Prongs": "6P", "Double Prong": "DP", "Burnish": "BN", "Peg": "PG" };
    const shapeMap: Record<string, string> = { "Round": "RD", "Asscher": "AS", "Cushion": "CU", "Emerald": "EM", "Marquise": "MQ", "Oval": "OV", "Pear": "PR", "Princess": "PS", "Radiant": "RA", "Radiant SQ": "RS", "Cushion SQ": "CS", "heart": "HT", "Baguette": "BG", "Tapered Baguette": "TB", "hexagon": "HX", "Kite": "KT", "Trillion": "TR", "Half Moon" : "HM" };
    const directionMap: Record<string, string> = { "North-South": "NS", "Slanted": "S", "Alternating": "CA", "Est-West": "EW", "not directed": "ND" };
    const parts: string[] = ["M"]; // Always start with M_
    if (mainGemsSettings[0]) parts.push(settingMap[mainGemsSettings[0]] || mainGemsSettings[0].substring(0, 2).toUpperCase());
    if (mainGemsShapes[0]) parts.push(shapeMap[mainGemsShapes[0]] || mainGemsShapes[0].substring(0, 2).toUpperCase());
    if (mainGemsDirections[0]) parts.push(directionMap[mainGemsDirections[0]] || directionMap[mainGemsDirections[0]].substring(0, 1).toUpperCase());
    if (mainGemsSize) parts.push(mainGemsSize.toUpperCase());
    if (mainGemsCount) parts.push(mainGemsCount);
    return parts.join("_");
  }, [mainGemsSettings, mainGemsShapes, mainGemsDirections, mainGemsCount, mainGemsSize]);

  const generateSecondaryGemsCode = useCallback((settings: string[], shapes: string[], directions: string[], size: string, count: string) => {
    const parts: string[] = [];
    if (settings[0]) parts.push(settings[0].substring(0, 3).toUpperCase());
    if (shapes[0]) parts.push(shapes[0].substring(0, 3).toUpperCase());
    if (directions[0]) {
       const mapping: Record<string, string> = { "North-South": "NS", "Slanted": "SL", "Alternating": "CA", "Est-West": "EW", "not directed": "ND" };
       parts.push(mapping[directions[0]] || directions[0].substring(0, 2).toUpperCase());
    }
    if (size) parts.push(size.toUpperCase());
    if (count) parts.push(count);
    return parts.join("_");
  }, []);

  const clearMainGems = useCallback(() => {
    setMainGemsSettings([]); setMainGemsShapes([]); setMainGemsDirections([]); setMainGemsSize(""); setMainGemsCount("");
    setSelectedOptions(prev => { const next = { ...prev }; delete next[11]; delete next[12]; delete next[13]; return next; });
  }, []);

  const addGemRow = useCallback(() => setExtraGemRows(rows => [...rows, { settingId: '', shapeId: '', directionId: '', size: '', count: '' }]), []);
  const updateExtraGemRow = useCallback((idx: number, field: string, value: string) => {
    setExtraGemRows(rows => rows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }, []);

  const clearSecondaryGems = useCallback((type: 'head' | 'shank') => {
    if (type === 'head') { setHeadSecSettings([]); setHeadSecShapes([]); setHeadSecDirections([]); setHeadSecSize(""); setHeadSecCount(""); }
    else { setShankSecSettings([]); setShankSecShapes([]); setShankSecDirections([]); setShankSecSize(""); setShankSecCount(""); }
    setSelectedOptions(prev => { const next = { ...prev }; delete next[18]; delete next[12]; delete next[13]; return next; });
  }, []);

  const handleAcceptMainGems = useCallback(() => {
    const code = generateMainGemsCode();
    if (!code) return;
    if (editingItemCode) { setSelectedHeadItems(prev => prev.map(item => item === editingItemCode ? code : item)); setEditingItemCode(null); } 
    else { setSelectedHeadItems(prev => Array.from(new Set([...prev, code, "MineGem"]))); }
    clearMainGems(); navigateTo(4);
  }, [generateMainGemsCode, clearMainGems, editingItemCode]);

  const handleAcceptSecondaryGems = useCallback(() => {
    if (isShankSubflow) {
      const code = generateSecondaryGemsCode(shankSecSettings, shankSecShapes, shankSecDirections, shankSecSize, shankSecCount);
      if (!code) return;
      const finalCode = "SEC_" + code;
      if (editingItemCode) { setSelectedShankItems(prev => prev.map(item => item === editingItemCode ? finalCode : item)); setEditingItemCode(null); } 
      else { setSelectedShankItems(prev => Array.from(new Set([...prev, finalCode, "GEMS"]))); }
      clearSecondaryGems('shank'); navigateTo(4);
    } else {
      const code = generateSecondaryGemsCode(headSecSettings, headSecShapes, headSecDirections, headSecSize, headSecCount);
      if (!code) return;
      const finalCode = "SEC_" + code;
      if (editingItemCode) { setSelectedHeadItems(prev => prev.map(item => item === editingItemCode ? finalCode : item)); setEditingItemCode(null); } 
      else { setSelectedHeadItems(prev => Array.from(new Set([...prev, finalCode, "GEMS"]))); }
      clearSecondaryGems('head'); navigateTo(4);
    }
  }, [isShankSubflow, generateSecondaryGemsCode, shankSecSettings, shankSecShapes, shankSecDirections, shankSecSize, shankSecCount, headSecSettings, headSecShapes, headSecDirections, headSecSize, headSecCount, clearSecondaryGems, editingItemCode]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prevState = history[history.length - 1];
    setRedoStack(prev => [...prev, selectedOptions]); setHistory(prev => prev.slice(0, -1)); setSelectedOptions(prevState);
  }, [history, selectedOptions]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, selectedOptions]); setRedoStack(prev => prev.slice(0, -1)); setSelectedOptions(nextState);
  }, [redoStack, selectedOptions]);

  const saveCurrentToStore = useCallback(() => {
    const currentSnapshot: ConfigData = { selectedOptions, selectedDetailItems, selectedHeadItems, selectedShankItems, selectedProfileItems, selectedSizeItems, mainGemsSettings, mainGemsShapes, mainGemsDirections, mainGemsSize, mainGemsCount, headSecSettings, headSecShapes, headSecDirections, headSecSize, headSecCount, shankSecSettings, shankSecShapes, shankSecDirections, shankSecSize, shankSecCount, sizeInputBuffer, history, redoStack };
    if (activeJewelryType === 'ring') { setRingStore(currentSnapshot); } else { setBandStore(currentSnapshot); }
  }, [activeJewelryType, selectedOptions, selectedDetailItems, selectedHeadItems, selectedShankItems, selectedProfileItems, selectedSizeItems, mainGemsSettings, mainGemsShapes, mainGemsDirections, mainGemsSize, mainGemsCount, headSecSettings, headSecShapes, headSecDirections, headSecSize, headSecCount, shankSecSettings, shankSecShapes, shankSecDirections, shankSecSize, shankSecCount, sizeInputBuffer, history, redoStack]);

  const loadFromStore = (type: 'ring' | 'band') => {
    const data = type === 'ring' ? ringStore : bandStore;
    setSelectedOptions(data.selectedOptions); setSelectedDetailItems(data.selectedDetailItems); setSelectedHeadItems(data.selectedHeadItems); setSelectedShankItems(data.selectedShankItems); setSelectedProfileItems(data.selectedProfileItems); setSelectedSizeItems(data.selectedSizeItems); setMainGemsSettings(data.mainGemsSettings); setMainGemsShapes(data.mainGemsShapes); setMainGemsDirections(data.mainGemsDirections); setMainGemsSize(data.mainGemsSize); setMainGemsCount(data.mainGemsCount || ""); setHeadSecSettings(data.headSecSettings); setHeadSecShapes(data.headSecShapes); setHeadSecDirections(data.headSecDirections); setHeadSecSize(data.headSecSize); setHeadSecCount(data.headSecCount || ""); setShankSecSettings(data.shankSecSettings); setShankSecShapes(data.shankSecShapes); setShankSecDirections(data.shankSecDirections); setShankSecSize(data.shankSecSize); setShankSecCount(data.shankSecCount || ""); setSizeInputBuffer(data.sizeInputBuffer); setHistory(data.history); setRedoStack(data.redoStack);
  };

  const resetAll = useCallback(() => {
    setSelectedOptions({}); setHistory([]); setRedoStack([]); setActiveMenuIndex(0); setMenuHistory([0]); setIsDarkMode(true); setIsShiftPressed(false); setIsSerchExpanded(false); setSelectedDetailItems([]); setSelectedHeadItems([]); setSelectedShankItems([]); setSelectedProfileItems([]); setSelectedSizeItems([]); setMainGemsSize(""); setMainGemsCount(""); setMainGemsSettings([]); setMainGemsShapes([]); setMainGemsDirections([]); setHeadSecSettings([]); setHeadSecShapes([]); setHeadSecDirections([]); setHeadSecSize(""); setHeadSecCount(""); setShankSecSettings([]); setShankSecShapes([]); setShankSecDirections([]); setShankSecSize(""); setShankSecCount(""); setSizeInputBuffer(""); setActiveDropdown(null); setShowSuffixMenu(false); setIsShankSubflow(false); setGemBuilderType('main'); setIsInteractiveMode(false); setEditingItemCode(null); setRingStore(initialConfig()); setBandStore(initialConfig()); setActiveJewelryType('ring'); setShowSummaryOverlay(false); setOverlayPage(0); setIsFullScreenImage(false); setSelectedListItem(null); setSelectedImage(null); setRingImages([]); setRingStl(null); setActivePreviewTab('IMAGE');
  }, []);

  const handleNumericCountChange = (val: string, setter: (v: string) => void) => {
    const numericVal = val.replace(/[^0-9]/g, ''); if (numericVal === "") { setter(""); return; } const num = parseInt(numericVal); if (num <= 500) setter(numericVal);
  };

  // High precision high resolution scroll update with custom asymmetric gaps
  const handleScroll = useCallback(() => {
    if (scrollListRef.current && scrollTrackRef.current && !isDraggingThumb) {
      const { scrollTop, scrollHeight, clientHeight } = scrollListRef.current;
      const trackRect = scrollTrackRef.current.getBoundingClientRect();
      // Distance the top of the thumb can travel, respecting asymmetric gaps
      const availableTrack = trackRect.height - topPadding - bottomPadding - thumbHeight; 
      const scrollPercent = scrollTop / (scrollHeight - clientHeight);
      setThumbTop(topPadding + (scrollPercent * availableTrack));
    }
  }, [thumbHeight, topPadding, bottomPadding, isDraggingThumb]);

  const handleThumbMouseDown = useCallback((e: React.MouseEvent) => { 
    if (e.button !== 0) return; // Only primary button
    e.preventDefault(); 
    setIsDraggingThumb(true); 
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => { 
        const result = event.target?.result as string;
        if (selectedListItem !== null) {
          setLibraryImages(prev => ({ ...prev, [selectedListItem]: result }));
        }
        setSelectedImage(result); 
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleListItemClick = useCallback((num: number) => {
    setSelectedListItem(num);
    const ring = rings[num - 1];
    if (ring) {
      fetchRingFiles(ring.id).then(({ images, stl }) => {
        setRingImages(images);
        setRingStl(stl);
        setActivePreviewTab('IMAGE');
        setSelectedImage(images[0] ?? libraryImages[num] ?? null);
      });
    } else {
      setRingImages([]);
      setRingStl(null);
      setActivePreviewTab('IMAGE');
      setSelectedImage(libraryImages[num] ?? null);
    }
  }, [rings, libraryImages]);

  const handlePrevListItem = useCallback(() => { 
    if (selectedListItem === null) { handleListItemClick(1); } 
    else if (selectedListItem > 1) { handleListItemClick(selectedListItem - 1); } 
  }, [selectedListItem, handleListItemClick]);

  const handleNextListItem = useCallback(() => { 
    if (selectedListItem === null) { handleListItemClick(1); } 
    else if (selectedListItem < listItemsCount) { handleListItemClick(selectedListItem + 1); } 
  }, [selectedListItem, handleListItemClick, listItemsCount]);

  // Robust Scrollbar Dragging Management
  useEffect(() => {
    if (!isDraggingThumb) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (scrollTrackRef.current && scrollListRef.current) {
        const trackRect = scrollTrackRef.current.getBoundingClientRect();
        const availableTrack = trackRect.height - topPadding - bottomPadding - thumbHeight;
        
        // Calculate relative Y within the track
        let relativeY = e.clientY - trackRect.top - (thumbHeight / 2);
        
        // Constrain thumb position
        const constrainedY = Math.max(topPadding, Math.min(relativeY, availableTrack + topPadding));
        const scrollPercent = (constrainedY - topPadding) / availableTrack;
        
        const { scrollHeight, clientHeight } = scrollListRef.current;
        scrollListRef.current.scrollTop = scrollPercent * (scrollHeight - clientHeight);
        
        // Update thumb top directly for immediate visual feedback during drag
        setThumbTop(constrainedY);
      }
    };

    const handleMouseUp = () => setIsDraggingThumb(false);

    // Block standard drag events
    const preventDefault = (e: Event) => e.preventDefault();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseUp);
    document.addEventListener('dragstart', preventDefault);
    
    // Visual feedback on body
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseUp);
      document.removeEventListener('dragstart', preventDefault);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingThumb, thumbHeight, topPadding, bottomPadding]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement; 
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (e.key === 'Escape') { 
        e.preventDefault(); 
        if (isFullScreenImage) setIsFullScreenImage(false);
        else if (showSummaryOverlay) setShowSummaryOverlay(false); 
        else resetAll(); 
        return; 
      }
      if (e.key === 'Shift' && !e.repeat && !isInputFocused) setIsShiftPressed(true);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); }
      if (e.key.toLowerCase() === 'd' && !isInputFocused) { e.preventDefault(); setIsDarkMode(prev => !prev); }
      if (e.key === 'Enter') { if (activeMenuIndex === 6) { e.preventDefault(); handleAcceptMainGems(); } else if (activeMenuIndex === 9) { e.preventDefault(); handleAcceptSecondaryGems(); } }
      
      if (!isInputFocused) {
        if (e.key === 'ArrowUp') { e.preventDefault(); handlePrevListItem(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); handleNextListItem(); }
        if (showSummaryOverlay) {
          if (e.key === 'ArrowLeft') { e.preventDefault(); if (overlayPage === 1) setOverlayPage(0); }
          if (e.key === 'ArrowRight') { e.preventDefault(); if (overlayPage === 0) setOverlayPage(1); }
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(false); };
    const handleClickOutside = (event: MouseEvent) => {
      if (activeDropdown === 'details-size' && detailsDropdownRef.current && !detailsDropdownRef.current.contains(event.target as Node)) setActiveDropdown(null);
      if (showSuffixMenu && !detailsDropdownRef.current?.contains(event.target as Node)) setShowSuffixMenu(false);
    };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp); window.addEventListener('mousedown', handleClickOutside);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); window.removeEventListener('mousedown', handleClickOutside); };
  }, [handleUndo, handleRedo, resetAll, activeDropdown, showSuffixMenu, activeMenuIndex, handleAcceptMainGems, handleAcceptSecondaryGems, showSummaryOverlay, isFullScreenImage, handlePrevListItem, handleNextListItem, overlayPage]);

  useEffect(() => { saveCurrentToStore(); }, [saveCurrentToStore]);

  const toggleOption = (categoryIndex: number, option: string, isRemoval: boolean) => {
    if (!option) return;
    if (categoryIndex === 0 && option === "Rings") { navigate('/type'); return; }
    if (categoryIndex === 1) { 
      const newType = (option === "Rings") ? 'ring' : 'band'; 
      const newTarget = (option === "Rings") ? 2 : 3; 
      if (newType !== activeJewelryType) { setRings([]); setIsLoadingRings(true); setUploadError(null); setActiveJewelryType(newType); setTargetCategoryIndex(newTarget); loadFromStore(newType); }
      else setTargetCategoryIndex(newTarget);
      navigate(option === "Rings" ? '/rings' : '/bands');
      return;
    }
    if (categoryIndex === 5) { 
      if (option === "MineGem") { setGemBuilderType('main'); setEditingItemCode(null); navigateTo(6); return; } 
      if (option === "HEAD") { navigateTo(7); return; } 
      if (option === "GEMS") { setIsShankSubflow(false); setGemBuilderType('secondary'); setEditingItemCode(null); navigateTo(9); return; } 
      if (option === "Texture&Details") { setIsShankSubflow(false); navigateTo(19); return; } 
    }
    if (categoryIndex === 16) { 
      if (option === "TYPE") { navigateTo(14); return; } 
      if (option === "GEMS") { setIsShankSubflow(true); setGemBuilderType('secondary'); setEditingItemCode(null); navigateTo(9); return; } 
      if (option === "Texture&Details") { setIsShankSubflow(true); navigateTo(19); return; } 
    }
    if (editingItemCode && !isRemoval && [2, 3, 14, 15, 19, 5, 16].includes(categoryIndex) && !editingItemCode.includes('_')) {
      if (categoryIndex === 2 || categoryIndex === 3) { setSelectedDetailItems(prev => prev.map(item => item === editingItemCode ? option : item)); } 
      else if (categoryIndex === 14) { setSelectedShankItems(prev => prev.map(item => item === editingItemCode ? option : item)); } 
      else if (categoryIndex === 15) { setSelectedProfileItems(prev => prev.map(item => item === editingItemCode ? option : item)); } 
      else if (categoryIndex === 19) { 
        if (isShankSubflow) setSelectedShankItems(prev => prev.map(item => item === editingItemCode ? option : item)); 
        else setSelectedHeadItems(prev => prev.map(item => item === editingItemCode ? option : item)); 
      } else if ([5, 7, 8].includes(categoryIndex)) { setSelectedHeadItems(prev => prev.map(item => item === editingItemCode ? option : item)); } 
      else if (categoryIndex === 16) { setSelectedShankItems(prev => prev.map(item => item === editingItemCode ? option : item)); }
      setSelectedOptions(prev => { const next = { ...prev }; if (next[categoryIndex]) { next[categoryIndex] = next[categoryIndex].map(item => item === editingItemCode ? option : item); } return next; }); setEditingItemCode(null); navigateTo(4); return;
    }
    setHistory(prev => [...prev, selectedOptions]); setRedoStack([]);
    if (categoryIndex === 11 && !isRemoval) { gemBuilderType === 'main' ? setMainGemsSettings([option]) : (isShankSubflow ? setShankSecSettings([option]) : setHeadSecSettings([option])); navigateTo(gemBuilderType === 'main' ? 6 : 9); }
    else if (categoryIndex === 12 && !isRemoval) { gemBuilderType === 'main' ? setMainGemsShapes([option]) : (isShankSubflow ? setShankSecShapes([option]) : setHeadSecShapes([option])); navigateTo(gemBuilderType === 'main' ? 6 : 9); }
    else if (categoryIndex === 13 && !isRemoval) { gemBuilderType === 'main' ? setMainGemsDirections([option]) : (isShankSubflow ? setShankSecDirections([option]) : setHeadSecDirections([option])); navigateTo(gemBuilderType === 'main' ? 6 : 9); }
    else if (categoryIndex === 18 && !isRemoval) { isShankSubflow ? setShankSecSettings([option]) : setHeadSecSettings([option]); navigateTo(9); }
    else if (categoryIndex === 14 && !isRemoval) { setSelectedShankItems(prev => prev.includes(option) ? prev : [...prev, option]); navigateTo(4); }
    else if (categoryIndex === 15 && !isRemoval) { setSelectedProfileItems(prev => prev.includes(option) ? prev : [...prev, option]); navigateTo(4); }
    else if (categoryIndex === 19) { if (isShankSubflow) setSelectedShankItems(prev => prev.includes(option) ? prev : [...prev, option]); else setSelectedHeadItems(prev => prev.includes(option) ? prev : [...prev, option]); navigateTo(4); }
    else if ([2, 3].includes(categoryIndex) && !isRemoval) { setSelectedDetailItems(prev => prev.includes(option) ? prev : [...prev, option]); navigateTo(4); }
    else if ([5, 7, 8].includes(categoryIndex) && !isRemoval) { setSelectedHeadItems(prev => prev.includes(option) ? prev : [...prev, option]); navigateTo(4); }
    setSelectedOptions(prev => {
      const current = prev[categoryIndex] || []; 
      const exists = current.includes(option); 
      let newSelectedOptions = { ...prev };
      if (isRemoval) {
        newSelectedOptions[categoryIndex] = current.filter(item => item !== option);
        if ([2, 3].includes(categoryIndex)) setSelectedDetailItems(d => d.filter(item => item !== option));
        if ([5, 7, 8, 19].includes(categoryIndex)) { if (!isShankSubflow) setSelectedHeadItems(h => h.filter(item => item !== option)); else setSelectedShankItems(s => s.filter(item => item !== option)); }
        if (categoryIndex === 14) setSelectedShankItems(s => s.filter(item => item !== option));
        if (categoryIndex === 15) setSelectedProfileItems(p => p.filter(item => item !== option));
        if (categoryIndex === 11) { setMainGemsSettings([]); setHeadSecSettings([]); setShankSecSettings([]); }
        if (categoryIndex === 12) { setMainGemsShapes([]); setHeadSecShapes([]); setShankSecShapes([]); }
        if (categoryIndex === 13) { setMainGemsDirections([]); setHeadSecDirections([]); setShankSecDirections([]); }
        if (categoryIndex === 18) { setHeadSecSettings([]); setShankSecSettings([]); }
      } else { if (!exists) newSelectedOptions[categoryIndex] = [...current, option]; } return newSelectedOptions;
    });
  };

  const removeItemGlobally = (categoryIndex: number, item: string) => {
    if (categoryIndex === 4) { if (item.startsWith("US Size: ")) { setSelectedSizeItems([]); setSizeInputBuffer(""); return; } setSelectedDetailItems(prev => prev.filter(i => i !== item)); setSelectedOptions(prev => { const next = { ...prev }; [2, 3].forEach(idx => { if (next[idx]) next[idx] = next[idx].filter(i => i !== item); }); return next; }); }
    else if ([5, 7, 8].includes(categoryIndex)) { setSelectedHeadItems(prev => prev.filter(i => i !== item)); }
    else if ([14, 16].includes(categoryIndex)) { setSelectedShankItems(prev => prev.filter(i => i !== item)); }
    else if (categoryIndex === 19) { setSelectedHeadItems(prev => prev.filter(i => i !== item)); setSelectedShankItems(prev => prev.filter(i => i !== item)); }
    else if (categoryIndex === 15) { setSelectedProfileItems(prev => prev.filter(i => i !== item)); setSelectedOptions(prev => { const next = { ...prev }; if (next[15]) next[15] = next[15].filter(i => i !== item); return next; }); }
    else toggleOption(categoryIndex, item, true);
  };

  const handleBaseSizeSelect = (val: string) => { setSizeInputBuffer(val); setActiveDropdown(null); setShowSuffixMenu(true); setSelectedSizeItems([val]); };
  const handleSuffixSelect = (suffix: string) => { const newVal = sizeInputBuffer + suffix; setSizeInputBuffer(newVal); setShowSuffixMenu(false); setSelectedSizeItems([newVal]); };
  const handleSizeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const val = e.target.value.replace(/[^0-9.]/g, ''); const parts = val.split('.'); if (parts.length > 2) return; setSizeInputBuffer(val); const isInteger = /^\d+$/.test(val); if (isInteger && parseInt(val) <= 16) setShowSuffixMenu(true); else setShowSuffixMenu(false); if (validSizes.includes(val)) setSelectedSizeItems([val]); };
  const handleSizeInputBlur = () => { if (!validSizes.includes(sizeInputBuffer)) setSizeInputBuffer(selectedSizeItems[0] || ""); };
  const handleSizeInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { setShowSuffixMenu(false); const val = e.currentTarget.value; if (validSizes.includes(val)) { setSelectedSizeItems([val]); e.currentTarget.blur(); } else { setSizeInputBuffer(selectedSizeItems[0] || ""); e.currentTarget.blur(); } } };

  const currentIdx = activeMenuIndex !== null ? activeMenuIndex : 0; 
  const currentList = menuData[currentIdx] || []; 
  const currentTitle = menuLabels[currentIdx] || "Jewelry Type"; 
  const isAnyModalOpen = isShiftPressed;
  const isBand = targetCategoryIndex === 3;

  const renderBuilder = (title: string, type: 'main' | 'secondary', settings: string[], setSettings: (v: any) => void, shapes: string[], setShapes: (v: any) => void, directions: string[], setDirections: (v: any) => void, size: string, setSize: (v: string) => void, count: string, setCount: (v: string) => void, onAccept: () => void, settingsIndex: number) => (
    <div className="flex flex-col items-center justify-start w-full max-full pt-0 h-full min-h-[calc(100vh-160px)]">
      <h2 className={`text-2xl font-black tracking-[0.15em] text-center uppercase mb-4 mt-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>{title}</h2>
      <div className="grid grid-cols-5 w-full px-10 gap-x-4 mt-12">
        <div className="flex flex-col items-center">
          <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SETTINGS</span>
          <div className="flex flex-col items-center gap-y-1 mb-1 min-h-[24px]">{settings.map((item, idx) => ( <div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item}</span></div> ))}</div>
          <div onClick={() => { setGemBuilderType(type); navigateTo(settingsIndex); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
        </div>
        <div className="flex flex-col items-center">
          <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SHAPE</span>
          <div className="flex flex-col items-center gap-y-1 mb-1 min-h-[24px]">{shapes.map((item, idx) => ( <div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item}</span></div> ))}</div>
          <div onClick={() => { setGemBuilderType(type); navigateTo(12); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
        </div>
        <div className="flex flex-col items-center">
          <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>DIRECTION</span>
          <div className="flex flex-col items-center gap-y-1 mb-1 min-h-[24px]">{directions.map((item, idx) => ( <div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item}</span></div> ))}</div>
          <div onClick={() => { setGemBuilderType(type); navigateTo(13); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
        </div>
        <div className="flex flex-col items-center">
          <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SIZE</span>
          <div className="flex flex-col items-center h-6 mb-1" />
          <div className={`w-72 h-12 flex items-center justify-center transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><input type="text" value={size} onChange={(e) => setSize(e.target.value)} placeholder="0x0x0" className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center placeholder-gray-600 ${isDarkMode ? 'text-white' : 'text-black'}`} /></div>
        </div>
        <div className="flex flex-col items-center">
          <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>COUNT</span>
          <div className="flex flex-col items-center h-6 mb-1" />
          <div className={`w-72 h-12 flex items-center justify-center transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><input type="text" value={count} onChange={(e) => handleNumericCountChange(e.target.value, setCount)} placeholder="1" className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center placeholder-gray-600 ${isDarkMode ? 'text-white' : 'text-black'}`} /></div>
        </div>
      </div>
      <div className="absolute bottom-12 right-16"><button onClick={onAccept} className={`text-5xl font-black uppercase tracking-[0.2em] transition-opacity hover:opacity-70 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>ACCEPT</button></div>
    </div>
  );

  const renderCurrentView = () => {
    if (location.pathname === '/login') {
      return (
        <div className="flex-1 flex items-center justify-center w-full">
          <div className={`w-full max-w-sm p-8 border ${isDarkMode ? 'border-[#1e293b] bg-[#1f2937]' : 'border-[#e2e8f0] bg-[#f8fafc]'}`}>
            <div className="flex items-center mb-6">
              <button onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/jewelry-type'); }} className={`text-xs font-black opacity-60 hover:opacity-100 transition-opacity mr-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>✕</button>
              <h2 className={`text-2xl font-black uppercase tracking-widest flex-1 text-center ${isDarkMode ? 'text-white' : 'text-black'}`}>Login</h2>
            </div>
            <div className="flex flex-col gap-3">
              <input type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className={`px-4 py-2 border text-sm font-bold bg-transparent outline-none ${isDarkMode ? 'border-[#374151] text-white placeholder-gray-500' : 'border-[#cbd5e1] text-black placeholder-gray-400'}`} />
              <input type="password" placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className={`px-4 py-2 border text-sm font-bold bg-transparent outline-none ${isDarkMode ? 'border-[#374151] text-white placeholder-gray-500' : 'border-[#cbd5e1] text-black placeholder-gray-400'}`} />
              {loginError && <p className="text-red-500 text-xs font-bold">{loginError}</p>}
              <button disabled={loginLoading} onClick={async () => { setLoginError(null); setLoginLoading(true); try { await login(loginEmail, loginPassword); const d = await me(); setUserEmail(d.email); navigate('/jewelry-type'); } catch (err: any) { setLoginError(err.message || 'Login failed'); } finally { setLoginLoading(false); } }} className="px-4 py-2 font-black uppercase tracking-widest text-sm bg-green-700 text-white hover:bg-green-800 disabled:opacity-50">
                {loginLoading ? '...' : 'Login'}
              </button>
              <button disabled className={`px-4 py-2 font-black uppercase tracking-widest text-sm border opacity-30 cursor-not-allowed ${isDarkMode ? 'border-[#374151] text-gray-400' : 'border-[#cbd5e1] text-gray-600'}`}>
                Register
              </button>
            </div>
          </div>
        </div>
      );
    }
    if (currentIdx === 4) {
      const currentRing = (showSummaryOverlay && selectedListItem !== null)
        ? (rings[selectedListItem - 1] ?? null) : null;
      const currentDbItem = currentRing ? {
        type:    currentRing.ring_type_names,
        head:    currentRing.head_setting_names,
        shank:   currentRing.shank_type_names,
        profile: currentRing.profile_names,
        size:    currentRing.finger_size,
      } : null;
      return (
        <div className="flex flex-col items-center justify-start w-full max-full pt-0 h-full min-h-[calc(100vh-160px)]">
          <h2 className={`text-2xl font-black tracking-[0.15em] text-center uppercase mb-4 -mt-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>{isBand ? 'Band' : 'Ring'}</h2>
          <div className={`flex items-center justify-center gap-2 w-full mb-6 pt-0`}>
             <div className="flex justify-center"><div className={`px-6 py-1 border cursor-not-allowed opacity-40 ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><span className={`text-2xl font-black italic tracking-widest uppercase ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>3DM</span></div></div>
             <div className="flex justify-center" onClick={() => setActivePreviewTab('STL')}><div className={`px-6 py-1 border cursor-pointer hover:opacity-80 transition-opacity ${activePreviewTab === 'STL' ? (isDarkMode ? 'bg-[#1a263d] border-[#38bdf8]' : 'bg-[#e0f2fe] border-[#0284c7]') : (isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]')}`}><span className={`text-2xl font-black italic tracking-widest uppercase ${activePreviewTab === 'STL' ? 'text-[#38bdf8]' : (isDarkMode ? 'text-white' : 'text-gray-900')}`}>STL</span></div></div>
             <div className="flex justify-center" onClick={() => setActivePreviewTab('IMAGE')}><div className={`px-6 py-1 border cursor-pointer hover:opacity-80 transition-opacity ${activePreviewTab === 'IMAGE' ? (isDarkMode ? 'bg-[#1a263d] border-[#38bdf8]' : 'bg-[#e0f2fe] border-[#0284c7]') : (isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]')}`}><span className={`text-2xl font-black italic tracking-widest uppercase ${activePreviewTab === 'IMAGE' ? 'text-[#38bdf8]' : (isDarkMode ? 'text-white' : 'text-gray-900')}`}>IMAGE</span></div></div>
          </div>
          {userEmail && (
            <div className="w-full px-10 mb-4 shrink-0 flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3">
                <label className="flex flex-col gap-1 cursor-pointer">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-60">3DM file *</span>
                  <div className={`px-3 py-2 border text-sm font-mono truncate ${isDarkMode ? 'border-[#374151] bg-[#111827]' : 'border-gray-200 bg-gray-50'}`}>{file3dm ? file3dm.name : 'Choose .3dm…'}<input type="file" accept=".3dm" className="hidden" onChange={e => setFile3dm(e.target.files?.[0] ?? null)} /></div>
                </label>
                <label className="flex flex-col gap-1 cursor-pointer">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-60">STL file *</span>
                  <div className={`px-3 py-2 border text-sm font-mono truncate ${isDarkMode ? 'border-[#374151] bg-[#111827]' : 'border-gray-200 bg-gray-50'}`}>{fileStl ? fileStl.name : 'Choose .stl…'}<input type="file" accept=".stl" className="hidden" onChange={e => setFileStl(e.target.files?.[0] ?? null)} /></div>
                </label>
                <label className="flex flex-col gap-1 cursor-pointer">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-60">Images</span>
                  <div className={`px-3 py-2 border text-sm font-mono truncate ${isDarkMode ? 'border-[#374151] bg-[#111827]' : 'border-gray-200 bg-gray-50'}`}>{picFiles.length > 0 ? `${picFiles.length} image(s)` : 'Choose images…'}<input type="file" accept="image/*" multiple className="hidden" onChange={e => setPicFiles(Array.from(e.target.files || []))} /></div>
                </label>
              </div>
              {uploadError && <div className="text-red-500 text-sm font-bold px-1">{uploadError}</div>}
              <div className="flex justify-center gap-4">
                <button onClick={handleCancel} className="px-10 py-3 bg-gray-500 text-white text-sm font-bold uppercase tracking-[0.2em] hover:bg-gray-600">CANCEL</button>
                <button onClick={handleSaveToLibrary} disabled={isUploading} className="px-10 py-3 bg-green-700 text-white text-sm font-bold uppercase tracking-[0.2em] hover:bg-green-800 disabled:opacity-50">{isUploading ? 'SAVING…' : 'SAVE TO LIBRARY'}</button>
              </div>
            </div>
          )}
          <div className={`grid ${isBand ? 'grid-cols-3' : 'grid-cols-5'} w-full pl-10 pr-20 gap-x-4 mb-4`}>
            <div className="flex flex-col items-center">
              <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>TYPE</span>
              <div className="flex flex-col items-center gap-y-1">{isBand ? selectedBandTypeIds.map(id => (lookups?.bands || []).find(b => b.id === id)).filter((item): item is LookupItem => !!item).map((item, idx) => ( <div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item.name}</span><div className="flex items-center gap-2 ml-2"><button onClick={() => setSelectedBandTypeIds(prev => prev.filter(x => x !== item.id))} className="opacity-60 hover:opacity-100 transition-opacity"><X size={14} /></button></div></div> )) : selectedRingTypeIds.map(id => (lookups?.ring_types || []).find(rt => rt.id === id)).filter((item): item is LookupItem => !!item).map((item, idx) => ( <div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item.name}</span><div className="flex items-center gap-2 ml-2"><button onClick={() => setSelectedRingTypeIds(prev => prev.filter(x => x !== item.id))} className="opacity-60 hover:opacity-100 transition-opacity"><X size={14} /></button></div></div> ))}</div>
              <div onClick={() => setHeadGemPickerField(isBand ? 'band_type' : 'ring_type')} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner mt-1 ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
            </div>
            {!isBand && (
              <>
                <div className="flex flex-col items-center">
                  <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>HEAD</span>
                  <div className="flex flex-col items-center gap-y-1">{selectedHeadItems.filter(item => !["HEAD", "MineGem", "GEMS", "Head Setting", "Texture&Details"].includes(item)).map((item, idx) => ( <div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{(isInteractiveMode && item.includes('_')) ? renderInteractiveCode(item) : (item.startsWith("SEC_") ? item.replace("SEC_", "") : item)}</span><div className="flex items-center gap-2 ml-2"><button onClick={() => removeItemGlobally(5, item)} className="opacity-60 hover:opacity-100 transition-opacity"><X size={14} /></button><button onClick={(e) => { e.preventDefault(); handleEditItem(5, item); }} onContextMenu={(e) => { e.preventDefault(); setIsInteractiveMode(!isInteractiveMode); }} className={`opacity-60 hover:opacity-100 transition-opacity`}><Pencil size={14} color={isInteractiveMode ? "#16a34a" : "currentColor"} /></button></div></div> ))}</div>
                  <div onClick={() => { setGemBuilderType('main'); setEditingItemCode(null); navigateTo(5); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner mt-1 ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SHANK</span>
                  <div className="flex flex-col items-center gap-y-1">{selectedShankItems.filter(item => !["TYPE", "GEMS", "Texture&Details"].includes(item)).map((item, idx) => ( <div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{(isInteractiveMode && item.includes('_')) ? renderInteractiveCode(item) : (item.startsWith("SEC_") ? item.replace("SEC_", "") : item)}</span><div className="flex items-center gap-2 ml-2"><button onClick={() => removeItemGlobally(16, item)} className="opacity-60 hover:opacity-100 transition-opacity"><X size={14} /></button><button onClick={(e) => { e.preventDefault(); handleEditItem(16, item); }} onContextMenu={(e) => { e.preventDefault(); setIsInteractiveMode(!isInteractiveMode); }} className={`opacity-60 hover:opacity-100 transition-opacity`}><Pencil size={14} color={isInteractiveMode ? "#16a34a" : "currentColor"} /></button></div></div> ))}</div>
                  <div onClick={() => { setGemBuilderType('main'); setEditingItemCode(null); navigateTo(16); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner mt-1 ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
                </div>
              </>
            )}
            <div className="flex flex-col items-center">
              <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>PROFILE</span>
              <div className="flex flex-col items-center gap-y-1">{selectedProfileIds.map(id => (lookups?.profiles || []).find(p => p.id === id)).filter((item): item is LookupItem => !!item).map((item, idx) => ( <div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item.name}</span><div className="flex items-center gap-2 ml-2"><button onClick={() => setSelectedProfileIds(prev => prev.filter(x => x !== item.id))} className="opacity-60 hover:opacity-100 transition-opacity"><X size={14} /></button></div></div> ))}</div>
              <div onClick={() => setHeadGemPickerField('profile')} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner mt-1 ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
            </div>
            <div className="flex flex-col items-center">
              <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>US SIZE</span>
              <div className="relative mt-1" ref={detailsDropdownRef}>
                <button onClick={() => setIsInfoOpen(true)} style={{ position: 'absolute', left: 'calc(100% + 40px)', top: '50%', transform: 'translateY(-50%)' }} className="flex items-center justify-center hover:opacity-80 transition-opacity"><span className="text-emerald-400 font-black italic leading-none select-none" style={{ fontSize: 26 }}>i</span></button>
                <div className={`w-72 h-12 flex items-center justify-between px-4 transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><input type="text" value={sizeInputBuffer || selectedSizeItems[0] || ""} onChange={handleSizeInputChange} onKeyDown={handleSizeInputKeyDown} onBlur={handleSizeInputBlur} className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center ${isDarkMode ? 'text-white' : 'text-black'}`} /><button onClick={() => { setActiveDropdown(activeDropdown === 'details-size' ? null : 'details-size'); setShowSuffixMenu(false); }} className="ml-2 h-full flex items-center justify-center"><ChevronDown className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} ${activeDropdown === 'details-size' ? 'rotate-180' : ''} transition-transform`} size={20} /></button></div>
                {activeDropdown === 'details-size' && (<div className={`absolute top-full right-0 w-[420px] z-[60] border shadow-2xl p-1 ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-white border-[#e2e8f0]'} grid grid-cols-6 gap-1`}>{INTEGER_SIZE_OPTIONS.map((opt) => (<div key={opt} onClick={() => handleBaseSizeSelect(opt)} className={`px-1 py-3 text-2xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]'}`}>{opt}</div>))}</div>)}
                {showSuffixMenu && !activeDropdown && (<div className={`absolute top-full right-0 w-72 z-[70] border shadow-2xl flex flex-col ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-white border-[#e2e8f0]'}`}>{SUFFIX_OPTIONS.map((suf) => (<div key={suf} onClick={() => handleSuffixSelect(suf)} className={`px-6 py-3 text-2xl font-black italic uppercase tracking-wider cursor-pointer border-b last:border-0 ${isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]'}`}>{suf}</div>))}<div onClick={() => setShowSuffixMenu(false)} className={`px-6 py-2 text-sm font-bold uppercase text-center cursor-pointer ${isDarkMode ? 'text-gray-400 hover:text-black' : 'text-gray-500 hover:text-white'}`}>CLOSE</div></div>)}
              </div>
            </div>
          </div>
          

          <div className={`mt-auto w-full flex flex-col border-t ${isDarkMode ? 'bg-[#0b0f19] border-[#1e293b]' : 'bg-[#f1f5f9] border-[#cbd5e1]'} relative`}>
            {showSummaryOverlay && (
              <div className="absolute inset-0 z-[110] flex flex-col overflow-hidden animate-in fade-in duration-200">
                <div className={`flex items-center h-14 px-10 border-b shrink-0 ${isDarkMode ? 'bg-[#1f2937] border-[#1e293b]' : 'bg-[#e5e7eb] border-[#cbd5e1]'} relative justify-center`}>
                  <h3 className={`text-4xl font-black italic tracking-widest uppercase ${isDarkMode ? 'text-white' : 'text-black'}`}>INFO</h3>
                  <button onClick={() => { setShowSummaryOverlay(false); setOverlayPage(0); }} className={`absolute right-10 ${isDarkMode ? 'text-white' : 'text-black'} p-1 transition-transform hover:scale-110`}><X size={32} strokeWidth={2.5} /></button>
                </div>
                <div className="flex flex-1 overflow-hidden relative">
                   {overlayPage === 1 && (
                     <button onClick={() => setOverlayPage(0)} className={`absolute left-4 top-1/2 -translate-y-1/2 z-[120] ${isDarkMode ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'} transition-colors opacity-80`}><ChevronLeft size={80} strokeWidth={1.5} /></button>
                   )}
                   {overlayPage === 0 && (
                     <button onClick={() => setOverlayPage(1)} className={`absolute right-4 top-1/2 -translate-y-1/2 z-[120] ${isDarkMode ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'} transition-colors opacity-80`}><ChevronRight size={80} strokeWidth={1.5} /></button>
                   )}
                   <div className={`flex-1 flex flex-col ${isDarkMode ? 'bg-[#111827]' : 'bg-white'} overflow-hidden relative`}>
                        {(selectedListItem !== null && selectedListItem > 1) && (
                          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-[125]"><button onClick={handlePrevListItem} className="hover:opacity-70 transition-opacity p-1"><ChevronUp size={48} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} strokeWidth={2} /></button></div>
                        )}
                        {overlayPage === 0 ? (
                          <div className="flex flex-col items-stretch justify-start w-full h-full pt-16">
                            <div className={`grid ${isBand ? 'grid-cols-3' : 'grid-cols-5'} w-full px-10 gap-x-4`}>
                              <div className="flex flex-col items-center">
                                <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>TYPE</span>
                                <div className="flex flex-col items-center gap-y-1">{(currentDbItem ? currentDbItem.type : selectedDetailItems.filter(item => menuData[targetCategoryIndex].includes(item))).map((item, idx) => ( <span key={idx} className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item}</span> ))}</div>
                              </div>
                              {!isBand && (
                                <div className="flex flex-col items-center">
                                  <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>HEAD</span>
                                  <div className="flex flex-col items-center gap-y-1">{(currentDbItem ? currentDbItem.head : selectedHeadItems.filter(item => !["HEAD", "MineGem", "GEMS", "Head Setting", "Texture&Details"].includes(item))).map((item, idx) => ( <span key={idx} className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item.startsWith("SEC_") ? item.replace("SEC_", "") : item}</span> ))}</div>
                                </div>
                              )}
                              
                              {!isBand && (
                                <div className="flex flex-col items-center">
                                  <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SHANK</span>
                                  <div className="flex flex-col items-center gap-y-1">{(currentDbItem ? currentDbItem.shank : selectedShankItems.filter(item => !["TYPE", "GEMS", "Texture&Details"].includes(item))).map((item, idx) => ( <span key={idx} className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item.startsWith("SEC_") ? item.replace("SEC_", "") : item}</span> ))}</div>
                                </div>
                              )}
                              <div className="flex flex-col items-center">
                                <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>PROFILE</span>
                                <div className="flex flex-col items-center gap-y-1">{(currentDbItem ? currentDbItem.profile : selectedProfileIds.map(id => (lookups?.profiles || []).find(p => p.id === id)?.name).filter(Boolean)).map((item, idx) => ( <span key={idx} className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item}</span> ))}</div>
                              </div>
                              
                              <div className="flex flex-col items-center">
                                <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>US SIZE</span>
                                <span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{currentDbItem ? currentDbItem.size : (selectedSizeItems[0] || "NOT SET")}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
                            {selectedImage && (
                              <>
                                <div 
                                  className="absolute inset-0 opacity-50 grayscale-[20%]" 
                                  style={{ 
                                    backgroundImage: `url(${selectedImage})`, 
                                    backgroundSize: 'cover', 
                                    backgroundPosition: 'center', 
                                    filter: 'blur(45px)',
                                    transform: 'scale(1.15)'
                                  }} 
                                />
                                <img src={selectedImage} alt="Selection Render" className="relative z-10 w-full h-full object-contain" />
                              </>
                            )}
                          </div>
                        )}
                        {(selectedListItem !== null && selectedListItem < listItemsCount) && (
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-[125]"><button onClick={handleNextListItem} className="hover:opacity-70 transition-opacity p-1"><ChevronDown size={48} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} strokeWidth={2} /></button></div>
                        )}
                   </div>
                </div>
                <div className={`h-3 w-full shrink-0 ${isDarkMode ? 'bg-[#1f2937]' : 'bg-[#e5e7eb] border-t border-[#d1d5db]'}`} />
              </div>
            )}
            <div className={`grid grid-cols-1 w-full px-10 h-14 transform ${isDarkMode ? 'bg-[#1f2937]' : 'bg-[#e5e7eb]'} border-b ${isDarkMode ? 'border-[#1e293b]' : 'border-[#cbd5e1]'}`}>
              <div className="flex items-center"><Search size={32} className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} cursor-pointer`} /><div className={`ml-8 text-5xl font-black italic ${isDarkMode ? 'text-white' : 'text-black'} tracking-tighter`}>{totalCount}</div></div>
            </div>
            <div className="flex w-full h-[calc(100vh-332px)] min-h-[500px]">
              <div ref={scrollListRef} onScroll={handleScroll} className={`w-[480px] flex flex-col px-4 pb-4 pt-0 overflow-y-auto hide-scrollbar ${isDarkMode ? 'bg-[#111827]' : 'bg-white'}`}>
                <div className="flex flex-col gap-1 pt-4">
                  {rings.length === 0 && (
                    <div className={`text-2xl font-black italic tracking-widest px-4 py-8 text-center ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                      {lookups ? 'No rings found' : 'Loading…'}
                    </div>
                  )}
                  {rings.map((ring, idx) => {
                    const num = idx + 1;
                    return (
                      <div key={ring.id} onClick={() => handleListItemClick(num)} className={`grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center text-4xl font-black italic tracking-widest py-1 px-4 cursor-pointer transition-colors ${num === selectedListItem ? 'text-[#38bdf8]' : (isDarkMode ? 'text-white' : 'text-black')}`}>
                        <span className="truncate shrink-0">{ring.id}</span>
                        <span className="tracking-[0.1em] flex-1 min-w-0 truncate">{ring.code}</span>
                        <div className="flex items-center gap-4 shrink-0 justify-self-start">
                          <button onClick={(e) => { e.stopPropagation(); setInfoRing(ring); }} className="text-[#10b981] italic font-black text-3xl hover:opacity-70 transition-opacity">i</button>
                          <button onClick={(e) => { e.stopPropagation(); downloadRingFilesZip(ring); }} className={`opacity-70 hover:opacity-100 transition-opacity ${isDarkMode ? 'text-white' : 'text-black'}`}><Download size={28} strokeWidth={2} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div ref={scrollTrackRef} className={`w-6 border-l border-r flex flex-col items-center shrink-0 ${isDarkMode ? 'bg-[#0b0f19] border-[#1e293b]' : 'bg-[#f1f5f9] border-[#cbd5e1]'} relative`}>
                 <div 
                   onMouseDown={handleThumbMouseDown} 
                   style={{ top: `${thumbTop}px`, position: 'absolute' }} 
                   className={`w-4 h-32 rounded-sm transform transition-colors z-10 ${
                     isDraggingThumb 
                       ? (isDarkMode ? 'bg-[#38bdf8]' : 'bg-[#0284c7]') 
                       : (isDarkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-300 hover:bg-gray-400')
                   } ${isDraggingThumb ? 'cursor-grabbing' : 'cursor-grab'}`}
                 >
                   <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                     <div className={`w-1.5 h-0.5 rounded-full ${isDraggingThumb ? 'bg-white' : (isDarkMode ? 'bg-gray-400' : 'bg-gray-500')}`} />
                     <div className={`w-1.5 h-0.5 rounded-full ${isDraggingThumb ? 'bg-white' : (isDarkMode ? 'bg-gray-400' : 'bg-gray-500')}`} />
                     <div className={`w-1.5 h-0.5 rounded-full ${isDraggingThumb ? 'bg-white' : (isDarkMode ? 'bg-gray-400' : 'bg-gray-500')}`} />
                   </div>
                 </div>
              </div>
              <div className={`flex-1 min-h-0 flex flex-col items-stretch relative p-1 group ${isDarkMode ? 'bg-[#111827]' : 'bg-[#f1f5f9]'}`}>
                 <div
                   id="main-photo-viewport"
                   onClick={() => activePreviewTab === 'IMAGE' && selectedImage && setIsFullScreenImage(true)}
                   className={`flex-1 w-full min-h-0 flex items-center justify-center border ${isDarkMode ? 'border-[#1e293b] bg-[#111827]' : 'border-gray-100 bg-[#f1f5f9]'} relative ${activePreviewTab === 'STL' ? 'cursor-default' : 'cursor-pointer'} group transition-none overflow-hidden`}
                 >
                    {isLoadingRings ? (
                      <span className={`text-sm font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Loading...</span>
                    ) : activePreviewTab === 'STL' && ringStl ? (
                      <div className="absolute inset-0">
                        <StlViewer url={ringStl} isDarkMode={isDarkMode} />
                      </div>
                    ) : selectedImage ? (
                      <>
                        <div
                          className="absolute inset-0 opacity-40 grayscale-[10%]"
                          style={{
                            backgroundImage: `url(${selectedImage})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: 'blur(35px)',
                            transform: 'scale(1.1)'
                          }}
                        />
                        <img
                          src={selectedImage}
                          className="relative z-10 w-full h-full object-contain drop-shadow-2xl"
                          style={{ maxHeight: '100%', maxWidth: '100%' }}
                          alt="Selected Item"
                        />
                        <button onClick={(e) => { e.stopPropagation(); setShowSummaryOverlay(true); setOverlayPage(1); }} className="absolute z-20 top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded transition-colors border border-white/10 group-hover:opacity-100 opacity-0 transform group-hover:scale-110"><Maximize2 size={32} /></button>
                      </>
                    ) : null}
                 </div>
                 {!isLoadingRings && (ringImages.length > 0 || ringStl) && (
                   <div className={`flex items-center justify-start gap-2 overflow-x-auto overflow-y-hidden hide-scrollbar shrink-0 p-2 w-full h-32 relative z-10 ${isDarkMode ? 'bg-[#0b0f19]' : 'bg-[#e2e8f0]'}`}>
                     {ringImages.map((url, i) => (
                       <img
                         key={i}
                         src={url}
                         alt={`view-${i + 1}`}
                         onClick={(e) => { e.stopPropagation(); setActivePreviewTab('IMAGE'); setSelectedImage(url); }}
                         className={`h-24 w-24 object-cover cursor-pointer shrink-0 border-2 transition-colors ${activePreviewTab === 'IMAGE' && url === selectedImage ? 'border-[#38bdf8]' : isDarkMode ? 'border-transparent hover:border-gray-600' : 'border-transparent hover:border-gray-300'}`}
                       />
                     ))}
                     {ringStl && (
                       <button
                         onClick={(e) => { e.stopPropagation(); setActivePreviewTab('STL'); }}
                         className={`h-24 w-24 shrink-0 border-2 flex items-center justify-center text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer ${activePreviewTab === 'STL' ? 'border-[#38bdf8] text-[#38bdf8]' : isDarkMode ? 'border-transparent text-gray-400 hover:border-gray-600 hover:text-white' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-black'}`}
                       >
                         3D
                       </button>
                     )}
                   </div>
                 )}
              </div>
            </div>
          </div>
          {isInfoOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9998]" onClick={() => setIsInfoOpen(false)}>
              <div className={`p-6 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto mx-4 ${isDarkMode ? 'bg-[#0f1b2b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
                <h2 className={`text-xl font-black uppercase tracking-widest mb-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>{isBand ? 'Band Parameters' : 'Ring Parameters'}</h2>
                <div className={`flex flex-col gap-2 text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {isBand ? (<>
                    <div><span className="opacity-60 uppercase tracking-wider mr-1">TYPE:</span>{selectedBandTypeIds.map(id => (lookups?.bands || []).find(x => x.id === id)?.name).filter(Boolean).join(', ') || '—'}</div>
                    <div><span className="opacity-60 uppercase tracking-wider mr-1">PROFILE:</span>{selectedProfileIds.map(id => (lookups?.profiles || []).find(x => x.id === id)?.name).filter(Boolean).join(', ') || '—'}</div>
                    <div><span className="opacity-60 uppercase tracking-wider mr-1">US SIZE:</span>{selectedSizeItems[0] || '—'}</div>
                  </>) : (<>
                    <div><span className="opacity-60 uppercase tracking-wider mr-1">TYPE:</span>{(currentRing ? currentRing.ring_type_names.join(', ') : selectedRingTypeIds.map(id => (lookups?.ring_types || []).find(x => x.id === id)?.name).filter(Boolean).join(', ')) || '—'}</div>
                    <div><span className="opacity-60 uppercase tracking-wider mr-1">HEAD Settings:</span>{(currentRing ? currentRing.head_setting_names.join(', ') : selectedHeadSettingIds.map(id => (lookups?.head_settings || []).find(x => x.id === id)?.name).filter(Boolean).join(', ')) || '—'}</div>
                    <div><span className="opacity-60 uppercase tracking-wider mr-1">HEAD Textures:</span>{(currentRing ? currentRing.head_texture_names.join(', ') : selectedHeadTextureIds.map(id => (lookups?.textures || []).find(x => x.id === id)?.name).filter(Boolean).join(', ')) || '—'}</div>
                    <div><span className="opacity-60 uppercase tracking-wider mr-1">SHANK Types:</span>{(currentRing ? currentRing.shank_type_names.join(', ') : selectedShankTypeIds.map(id => (lookups?.shank_types || []).find(x => x.id === id)?.name).filter(Boolean).join(', ')) || '—'}</div>
                    <div><span className="opacity-60 uppercase tracking-wider mr-1">SHANK Textures:</span>{(currentRing ? currentRing.shank_texture_names.join(', ') : selectedShankTextureIds.map(id => (lookups?.textures || []).find(x => x.id === id)?.name).filter(Boolean).join(', ')) || '—'}</div>
                    <div><span className="opacity-60 uppercase tracking-wider mr-1">PROFILE:</span>{(currentRing ? currentRing.profile_names.join(', ') : selectedProfileIds.map(id => (lookups?.profiles || []).find(x => x.id === id)?.name).filter(Boolean).join(', ')) || '—'}</div>
                    <div><span className="opacity-60 uppercase tracking-wider mr-1">US SIZE:</span>{(currentRing ? currentRing.finger_size : selectedSizeItems[0]) || '—'}</div>
                    <div className={`mt-2 pt-2 border-t ${isDarkMode ? 'border-[#1e293b]' : 'border-gray-200'}`}><span className="opacity-60 uppercase tracking-wider mr-1">MAIN GEM:</span>{(currentRing ? (currentRing.head_gem ? [currentRing.head_gem.settings, currentRing.head_gem.shape, currentRing.head_gem.direction, currentRing.head_gem.size && `sz:${currentRing.head_gem.size}`, `×${currentRing.head_gem.count}`].filter(Boolean).join(' / ') : '') : [mainGemsSettings[0], mainGemsShapes[0], mainGemsDirections[0], mainGemsSize && `sz:${mainGemsSize}`, mainGemsCount && `×${mainGemsCount}`].filter(Boolean).join(' / ')) || '—'}</div>
                    <div><span className="opacity-60 uppercase tracking-wider mr-1">SHANK GEM:</span>{(currentRing ? currentRing.shank_gems.map(g => [g.settings, g.shape, g.direction, g.size && `sz:${g.size}`, `×${g.count}`].filter(Boolean).join(' / ')).join(' | ') : shankGems.map(r => [r.settings, r.shapes, r.directions, r.size && `sz:${r.size}`, r.count && `×${r.count}`].filter(Boolean).join(' / ')).filter(Boolean).join(' | ')) || '—'}</div>
                  </>)}
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => setIsInfoOpen(false)} className={`text-xs font-black uppercase tracking-widest px-4 py-2 border ${isDarkMode ? 'border-[#374151] text-gray-300 hover:text-white hover:border-white' : 'border-gray-300 text-gray-600 hover:text-black hover:border-black'}`}>CLOSE</button>
                </div>
              </div>
            </div>
          )}
          {headGemPickerField === 'ring_type' && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setHeadGemPickerField(null)}>
              <div style={{ background: isDarkMode ? '#0f1b2b' : '#fff', padding: '24px', borderRadius: '8px', minWidth: '320px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {(lookups?.ring_types || []).map((item, i) => {
                    const sel = selectedRingTypeIds.includes(item.id);
                    return <div key={i} onClick={() => setSelectedRingTypeIds(prev => sel ? prev.filter(x => x !== item.id) : [...prev, item.id])} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${sel ? (isDarkMode ? 'text-white border-white bg-[#1f2937]' : 'text-black border-black bg-[#e2e8f0]') : (isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]')}`}>{sel ? '✓ ' : ''}{item.name}</div>;
                  })}
                </div>
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <button onClick={() => setHeadGemPickerField(null)} className={`text-sm font-black uppercase tracking-widest px-6 py-2 border ${isDarkMode ? 'border-[#374151] text-gray-300 hover:text-white hover:border-white' : 'border-gray-300 text-gray-600 hover:text-black hover:border-black'}`}>DONE</button>
                </div>
              </div>
            </div>
          )}
          {headGemPickerField === 'band_type' && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setHeadGemPickerField(null)}>
              <div style={{ background: isDarkMode ? '#0f1b2b' : '#fff', padding: '24px', borderRadius: '8px', minWidth: '320px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {(lookups?.bands || []).map((item, i) => {
                    const sel = selectedBandTypeIds.includes(item.id);
                    return <div key={i} onClick={() => setSelectedBandTypeIds(prev => sel ? prev.filter(x => x !== item.id) : [...prev, item.id])} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${sel ? (isDarkMode ? 'text-white border-white bg-[#1f2937]' : 'text-black border-black bg-[#e2e8f0]') : (isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]')}`}>{sel ? '✓ ' : ''}{item.name}</div>;
                  })}
                </div>
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <button onClick={() => setHeadGemPickerField(null)} className={`text-sm font-black uppercase tracking-widest px-6 py-2 border ${isDarkMode ? 'border-[#374151] text-gray-300 hover:text-white hover:border-white' : 'border-gray-300 text-gray-600 hover:text-black hover:border-black'}`}>DONE</button>
                </div>
              </div>
            </div>
          )}
          {headGemPickerField === 'profile' && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setHeadGemPickerField(null)}>
              <div style={{ background: isDarkMode ? '#0f1b2b' : '#fff', padding: '24px', borderRadius: '8px', minWidth: '320px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {(lookups?.profiles || []).map((item, i) => {
                    const sel = selectedProfileIds.includes(item.id);
                    return <div key={i} onClick={() => setSelectedProfileIds(prev => sel ? prev.filter(x => x !== item.id) : [...prev, item.id])} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${sel ? (isDarkMode ? 'text-white border-white bg-[#1f2937]' : 'text-black border-black bg-[#e2e8f0]') : (isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]')}`}>{sel ? '✓ ' : ''}{item.name}</div>;
                  })}
                </div>
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <button onClick={() => setHeadGemPickerField(null)} className={`text-sm font-black uppercase tracking-widest px-6 py-2 border ${isDarkMode ? 'border-[#374151] text-gray-300 hover:text-white hover:border-white' : 'border-gray-300 text-gray-600 hover:text-black hover:border-black'}`}>DONE</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    } else if (currentIdx === 5) {
      return (
        <div ref={headPageRef} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); navigateTo(4); } }} className="flex flex-col items-center justify-start w-full max-full min-h-[calc(100vh-160px)] pt-4 overflow-x-hidden pb-12 focus:outline-none">
          <h2 className={`text-6xl font-black tracking-tight text-center shrink-0 uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-black'}`}>{currentTitle}</h2>
          <div className="flex items-start justify-center gap-16 w-full mt-4 mb-8">
            <div className="flex flex-col items-center">
              <button onClick={() => setHeadGemPickerField('head_setting')} className={`whitespace-nowrap text-3xl font-bold tracking-tighter text-center opacity-80 hover:opacity-100 ${isDarkMode ? 'text-[#9ca3af]' : 'text-[#111827]'}`}>HEAD</button>
              {selectedHeadSettingIds.length > 0 && <span className={`text-sm font-bold italic uppercase tracking-wider mt-1 text-center ${isDarkMode ? 'text-white' : 'text-black'}`}>{selectedHeadSettingIds.map(id => (lookups?.head_settings || []).find(s => s.id === id)?.name).filter(Boolean).join(', ')}</span>}
            </div>
            <div className="flex flex-col items-center">
              <button onClick={() => setHeadGemPickerField('head_texture_details')} className={`whitespace-nowrap text-3xl font-bold tracking-tighter text-center opacity-80 hover:opacity-100 ${isDarkMode ? 'text-[#9ca3af]' : 'text-[#111827]'}`}>Texture&amp;Details</button>
              {selectedHeadTextureIds.length > 0 && <span className={`text-sm font-bold italic uppercase tracking-wider mt-1 text-center ${isDarkMode ? 'text-white' : 'text-black'}`}>{selectedHeadTextureIds.map(id => (lookups?.textures || []).find(t => t.id === id)?.name).filter(Boolean).join(', ')}</span>}
            </div>
          </div>
          {false && <button onClick={addGemRow} className={`text-sm font-bold uppercase tracking-widest px-4 py-1 border mb-6 ${isDarkMode ? 'border-[#374151] text-gray-400 hover:text-white' : 'border-gray-300 text-gray-500 hover:text-black'}`}>+ Add Gems</button>}
          {/* Inline MAIN GEM builder — no page navigation */}
          <div className="flex flex-col items-center justify-start w-full max-full pt-0">
            <h2 className={`text-2xl font-black tracking-[0.15em] text-center uppercase mb-4 mt-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>MAIN GEM</h2>
            <div className="grid grid-cols-5 w-full px-10 gap-x-4 mt-12">
              <div className="flex flex-col items-center">
                <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SETTINGS</span>
                <div className="flex flex-col items-center gap-y-1 mb-1 min-h-[24px]">{mainGemsSettings.map((item, idx) => (<div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item}</span></div>))}</div>
                <div onClick={() => setHeadGemPickerField('settings')} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
              </div>
              <div className="flex flex-col items-center">
                <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SHAPE</span>
                <div className="flex flex-col items-center gap-y-1 mb-1 min-h-[24px]">{mainGemsShapes.map((item, idx) => (<div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item}</span></div>))}</div>
                <div onClick={() => setHeadGemPickerField('shapes')} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
              </div>
              <div className="flex flex-col items-center">
                <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>DIRECTION</span>
                <div className="flex flex-col items-center gap-y-1 mb-1 min-h-[24px]">{mainGemsDirections.map((item, idx) => (<div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item}</span></div>))}</div>
                <div onClick={() => setHeadGemPickerField('directions')} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
              </div>
              <div className="flex flex-col items-center">
                <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SIZE</span>
                <div className="flex flex-col items-center h-6 mb-1" />
                <div className={`w-72 h-12 flex items-center justify-center transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><input type="text" value={mainGemsSize} onChange={e => setMainGemsSize(e.target.value)} placeholder="0x0x0" className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center placeholder-gray-600 ${isDarkMode ? 'text-white' : 'text-black'}`} /></div>
              </div>
              <div className="flex flex-col items-center">
                <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>COUNT</span>
                <div className="flex flex-col items-center h-6 mb-1" />
                <div className={`w-72 h-12 flex items-center justify-center transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><input type="text" value={mainGemsCount} onChange={e => handleNumericCountChange(e.target.value, setMainGemsCount)} placeholder="1" className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center placeholder-gray-600 ${isDarkMode ? 'text-white' : 'text-black'}`} /></div>
              </div>
            </div>
          </div>
          {extraGemRows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-5 w-full px-10 gap-x-4 mt-8">
              <div className="flex flex-col items-center">
                <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SETTINGS</span>
                <select value={row.settingId} onChange={e => updateExtraGemRow(idx, 'settingId', e.target.value)} className={`w-72 h-12 border text-xl font-black italic uppercase tracking-wider text-center outline-none ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] text-white' : 'bg-[#f8fafc] border-[#e2e8f0] text-black'}`}>
                  <option value="">-</option>
                  {(lookups?.head_stone_settings || []).map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col items-center">
                <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SHAPE</span>
                <select value={row.shapeId} onChange={e => updateExtraGemRow(idx, 'shapeId', e.target.value)} className={`w-72 h-12 border text-xl font-black italic uppercase tracking-wider text-center outline-none ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] text-white' : 'bg-[#f8fafc] border-[#e2e8f0] text-black'}`}>
                  <option value="">-</option>
                  {(lookups?.stone_shapes || []).map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col items-center">
                <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>DIRECTION</span>
                <select value={row.directionId} onChange={e => updateExtraGemRow(idx, 'directionId', e.target.value)} className={`w-72 h-12 border text-xl font-black italic uppercase tracking-wider text-center outline-none ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] text-white' : 'bg-[#f8fafc] border-[#e2e8f0] text-black'}`}>
                  <option value="">-</option>
                  {(lookups?.directions || []).map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col items-center">
                <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SIZE</span>
                <div className={`w-72 h-12 flex items-center justify-center border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><input type="text" value={row.size} onChange={e => updateExtraGemRow(idx, 'size', e.target.value)} className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center ${isDarkMode ? 'text-white' : 'text-black'}`} /></div>
              </div>
              <div className="flex flex-col items-center">
                <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>COUNT</span>
                <div className={`w-72 h-12 flex items-center justify-center border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><input type="text" value={row.count} onChange={e => updateExtraGemRow(idx, 'count', e.target.value)} className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center ${isDarkMode ? 'text-white' : 'text-black'}`} /></div>
              </div>
            </div>
          ))}
          {headGemPickerField !== null && headGemPickerField !== 'ring_type' && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setHeadGemPickerField(null)}>
              <div style={{ background: isDarkMode ? '#0f1b2b' : '#fff', padding: '24px', borderRadius: '8px', minWidth: '320px', maxHeight: '80vh', overflowY: 'auto' }} tabIndex={0} onKeyDown={e => { if ((headGemPickerField === 'head_setting' || headGemPickerField === 'head_texture_details') && e.key === 'Enter') { e.preventDefault(); closePickerAndReturnToRingSave(); } }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {headGemPickerField === 'head_setting'
                    ? (lookups?.head_settings || []).map((item, i) => {
                        const sel = selectedHeadSettingIds.includes(item.id);
                        return <div key={i} onClick={() => setSelectedHeadSettingIds(prev => sel ? prev.filter(x => x !== item.id) : [...prev, item.id])} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${sel ? (isDarkMode ? 'text-white border-white bg-[#1f2937]' : 'text-black border-black bg-[#e2e8f0]') : (isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]')}`}>{sel ? '✓ ' : ''}{item.name}</div>;
                      })
                    : headGemPickerField === 'head_texture_details'
                    ? (lookups?.textures || []).map((item, i) => {
                        const sel = selectedHeadTextureIds.includes(item.id);
                        return <div key={i} onClick={() => setSelectedHeadTextureIds(prev => sel ? prev.filter(x => x !== item.id) : [...prev, item.id])} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${sel ? (isDarkMode ? 'text-white border-white bg-[#1f2937]' : 'text-black border-black bg-[#e2e8f0]') : (isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]')}`}>{sel ? '✓ ' : ''}{item.name}</div>;
                      })
                    : (headGemPickerField === 'settings' ? menuData[11] : headGemPickerField === 'shapes' ? menuData[12] : menuData[13]).map((opt, i) => (
                        <div key={i} onClick={() => { if (headGemPickerField === 'settings') setMainGemsSettings([opt]); else if (headGemPickerField === 'shapes') setMainGemsShapes([opt]); else setMainGemsDirections([opt]); setHeadGemPickerField(null); }} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]'}`}>{opt}</div>
                      ))
                  }
                </div>
                {(headGemPickerField === 'head_setting' || headGemPickerField === 'head_texture_details') && (
                  <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <button onClick={closePickerAndReturnToRingSave} className={`text-sm font-black uppercase tracking-widest px-6 py-2 border ${isDarkMode ? 'border-[#374151] text-gray-300 hover:text-white hover:border-white' : 'border-gray-300 text-gray-600 hover:text-black hover:border-black'}`}>DONE</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    } else if (currentIdx === 6) {
      return renderBuilder(menuLabels[6], 'main', mainGemsSettings, setMainGemsSettings, mainGemsShapes, setMainGemsShapes, mainGemsDirections, setMainGemsDirections, mainGemsSize, setMainGemsSize, mainGemsCount, setMainGemsCount, handleAcceptMainGems, 11);
    } else if (currentIdx === 9) {
      const secArgs = isShankSubflow ? { 
        settings: shankSecSettings, 
        setSettings: setShankSecSettings, 
        shapes: shankSecShapes, 
        setShapes: setShankSecShapes, 
        directions: shankSecDirections, 
        setDirections: setShankSecDirections, 
        size: shankSecSize, 
        setSize: setShankSecSize, 
        count: shankSecCount, 
        setCount: setShankSecCount 
      } : { 
        settings: headSecSettings, 
        setSettings: setHeadSecSettings, 
        shapes: headSecShapes, 
        setShapes: setHeadSecShapes, 
        directions: headSecDirections, 
        setDirections: setHeadSecDirections, 
        size: headSecSize, 
        setSize: setHeadSecSize, 
        count: headSecCount, 
        setCount: setHeadSecCount 
      };
      return renderBuilder(menuLabels[9], 'secondary', secArgs.settings, secArgs.setSettings, secArgs.shapes, secArgs.setShapes, secArgs.directions, secArgs.setDirections, secArgs.size, secArgs.setSize, secArgs.count, secArgs.setCount, handleAcceptSecondaryGems, 18);
    } else if (currentIdx === 16) {
      return (
        <div ref={shankPageRef} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); navigateTo(4); } }} className="flex flex-col items-center justify-start w-full max-full min-h-[calc(100vh-160px)] pt-4 overflow-x-hidden pb-12 focus:outline-none">
          <h2 className={`text-6xl font-black tracking-tight text-center shrink-0 uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-black'}`}>{currentTitle}</h2>
          <div className="flex items-start justify-center gap-16 w-full mt-4 mb-8">
            <div className="flex flex-col items-center">
              <button onClick={() => setHeadGemPickerField('shank_type')} className={`whitespace-nowrap text-3xl font-bold tracking-tighter text-center opacity-80 hover:opacity-100 ${isDarkMode ? 'text-[#9ca3af]' : 'text-[#111827]'}`}>TYPE</button>
              {selectedShankTypeIds.length > 0 && <span className={`text-sm font-bold italic uppercase tracking-wider mt-1 text-center ${isDarkMode ? 'text-white' : 'text-black'}`}>{selectedShankTypeIds.map(id => (lookups?.shank_types || []).find(s => s.id === id)?.name).filter(Boolean).join(', ')}</span>}
            </div>
            <div className="flex flex-col items-center">
              <button onClick={() => setHeadGemPickerField('shank_texture_details')} className={`whitespace-nowrap text-3xl font-bold tracking-tighter text-center opacity-80 hover:opacity-100 ${isDarkMode ? 'text-[#9ca3af]' : 'text-[#111827]'}`}>Texture&amp;Details</button>
              {selectedShankTextureIds.length > 0 && <span className={`text-sm font-bold italic uppercase tracking-wider mt-1 text-center ${isDarkMode ? 'text-white' : 'text-black'}`}>{selectedShankTextureIds.map(id => (lookups?.textures || []).find(t => t.id === id)?.name).filter(Boolean).join(', ')}</span>}
            </div>
          </div>
          <div className="flex flex-col items-center justify-start w-full max-full pt-0">
            <h2 className={`text-2xl font-black tracking-[0.15em] text-center uppercase mb-4 mt-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>GEMS</h2>
            <button onClick={() => setShankGems(prev => [...prev, mkShankGem()])} className={`mb-2 text-xl font-black italic uppercase tracking-widest px-6 py-1 border transition-colors ${isDarkMode ? 'border-[#374151] text-gray-300 hover:text-white hover:border-white' : 'border-gray-300 text-gray-600 hover:text-black hover:border-black'}`}>+ ADD GEMS</button>
            {shankGems.map((gem, rowIdx) => (
              <div key={rowIdx} className="grid grid-cols-5 w-full px-10 gap-x-4 mt-12">
                <div className="flex flex-col items-center">
                  <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SETTINGS</span>
                  <div className="flex flex-col items-center gap-y-1 mb-1 min-h-[24px]">{gem.settings ? <div className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{gem.settings}</span></div> : null}</div>
                  <div onClick={() => { setShankPickerRow(rowIdx); setHeadGemPickerField('shank_settings'); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SHAPE</span>
                  <div className="flex flex-col items-center gap-y-1 mb-1 min-h-[24px]">{gem.shapes ? <div className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{gem.shapes}</span></div> : null}</div>
                  <div onClick={() => { setShankPickerRow(rowIdx); setHeadGemPickerField('shank_shapes'); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>DIRECTION</span>
                  <div className="flex flex-col items-center gap-y-1 mb-1 min-h-[24px]">{gem.directions ? <div className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{gem.directions}</span></div> : null}</div>
                  <div onClick={() => { setShankPickerRow(rowIdx); setHeadGemPickerField('shank_directions'); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SIZE</span>
                  <div className="flex flex-col items-center h-6 mb-1" />
                  <div className={`w-72 h-12 flex items-center justify-center transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><input type="text" value={gem.size} onChange={e => updateShankGem(rowIdx, { size: e.target.value })} placeholder="0x0x0" className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center placeholder-gray-600 ${isDarkMode ? 'text-white' : 'text-black'}`} /></div>
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>COUNT</span>
                  <div className="flex flex-col items-center h-6 mb-1" />
                  <div className={`w-72 h-12 flex items-center justify-center transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><input type="text" value={gem.count} onChange={e => handleNumericCountChange(e.target.value, v => updateShankGem(rowIdx, { count: v }))} placeholder="1" className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center placeholder-gray-600 ${isDarkMode ? 'text-white' : 'text-black'}`} /></div>
                </div>
              </div>
            ))}
          </div>
          {headGemPickerField !== null && (headGemPickerField === 'shank_type' || headGemPickerField === 'shank_texture_details' || headGemPickerField === 'shank_settings' || headGemPickerField === 'shank_shapes' || headGemPickerField === 'shank_directions') && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setHeadGemPickerField(null)}>
              <div style={{ background: isDarkMode ? '#0f1b2b' : '#fff', padding: '24px', borderRadius: '8px', minWidth: '320px', maxHeight: '80vh', overflowY: 'auto' }} tabIndex={0} onKeyDown={e => { if ((headGemPickerField === 'shank_type' || headGemPickerField === 'shank_texture_details') && e.key === 'Enter') { e.preventDefault(); closePickerAndReturnToRingSave(); } }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {headGemPickerField === 'shank_type'
                    ? (lookups?.shank_types || []).map((item, i) => {
                        const sel = selectedShankTypeIds.includes(item.id);
                        return <div key={i} onClick={() => setSelectedShankTypeIds(prev => sel ? prev.filter(x => x !== item.id) : [...prev, item.id])} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${sel ? (isDarkMode ? 'text-white border-white bg-[#1f2937]' : 'text-black border-black bg-[#e2e8f0]') : (isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]')}`}>{sel ? '✓ ' : ''}{item.name}</div>;
                      })
                    : headGemPickerField === 'shank_texture_details'
                    ? (lookups?.textures || []).map((item, i) => {
                        const sel = selectedShankTextureIds.includes(item.id);
                        return <div key={i} onClick={() => setSelectedShankTextureIds(prev => sel ? prev.filter(x => x !== item.id) : [...prev, item.id])} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${sel ? (isDarkMode ? 'text-white border-white bg-[#1f2937]' : 'text-black border-black bg-[#e2e8f0]') : (isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]')}`}>{sel ? '✓ ' : ''}{item.name}</div>;
                      })
                    : headGemPickerField === 'shank_settings'
                    ? (lookups?.shank_stone_settings || []).map((item, i) => (
                        <div key={i} onClick={() => { updateShankGem(shankPickerRow, { settings: item.name, settingId: item.id }); setHeadGemPickerField(null); }} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]'}`}>{item.name}</div>
                      ))
                    : headGemPickerField === 'shank_shapes'
                    ? (lookups?.stone_shapes || []).map((item, i) => (
                        <div key={i} onClick={() => { updateShankGem(shankPickerRow, { shapes: item.name }); setHeadGemPickerField(null); }} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]'}`}>{item.name}</div>
                      ))
                    : (lookups?.directions || []).map((item, i) => (
                        <div key={i} onClick={() => { updateShankGem(shankPickerRow, { directions: item.name }); setHeadGemPickerField(null); }} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]'}`}>{item.name}</div>
                      ))
                  }
                </div>
                {(headGemPickerField === 'shank_type' || headGemPickerField === 'shank_texture_details') && (
                  <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <button onClick={closePickerAndReturnToRingSave} className={`text-sm font-black uppercase tracking-widest px-6 py-2 border ${isDarkMode ? 'border-[#374151] text-gray-300 hover:text-white hover:border-white' : 'border-gray-300 text-gray-600 hover:text-black hover:border-black'}`}>DONE</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    } else {
      const buttonGridClass = [2, 3, 5, 7, 8, 11, 12, 13, 14, 15, 16, 18, 19].includes(currentIdx) 
        ? 'grid-cols-3 gap-y-6 gap-x-44 mt-2' 
        : currentIdx === 1 
          ? 'grid-cols-2 gap-x-32 mt-16' 
          : 'grid-cols-3 gap-y-8 gap-x-12 mt-10';

      return (
        <div className="flex flex-col items-center justify-start w-full max-full relative min-h-[calc(100vh-160px)] pt-4 overflow-x-hidden pb-12">
          <h2 className={`text-6xl font-black tracking-tight text-center shrink-0 uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-black'}`}>{currentTitle}</h2>
          <div className={`grid ${buttonGridClass} w-full justify-items-center px-4`}>
            {currentList.map((type, index) => {
              if (type === "") return <div key={`spacer-${index}`} className="w-full h-full" />;
              
              const isNav = (currentIdx === 0 && type === "Rings") || (currentIdx === 1 && ["Rings", "Bands"].includes(type)) || (currentIdx === 5 && ["MineGem", "HEAD", "GEMS", "Texture&Details"].includes(type)) || (currentIdx === 16 && ["TYPE", "GEMS", "Texture&Details"].includes(type));
              
              let isSelected = false;
              if (!isNav) {
                if (currentIdx === 2 || currentIdx === 3) isSelected = selectedDetailItems.includes(type);
                else if ([5, 7, 8].includes(currentIdx)) isSelected = selectedHeadItems.includes(type);
                else if (currentIdx === 14 || currentIdx === 16) isSelected = selectedShankItems.includes(type);
                else if (currentIdx === 15) isSelected = selectedProfileItems.includes(type);
                else if (currentIdx === 19) isSelected = isShankSubflow ? selectedShankItems.includes(type) : selectedHeadItems.includes(type);
                else if (currentIdx === 11) isSelected = gemBuilderType === 'main' ? mainGemsSettings.includes(type) : (isShankSubflow ? shankSecSettings.includes(type) : headSecSettings.includes(type));
                else if (currentIdx === 12) isSelected = gemBuilderType === 'main' ? mainGemsShapes.includes(type) : (isShankSubflow ? shankSecShapes.includes(type) : headSecShapes.includes(type));
                else if (currentIdx === 13) isSelected = gemBuilderType === 'main' ? mainGemsDirections.includes(type) : (isShankSubflow ? shankSecDirections.includes(type) : headSecDirections.includes(type));
                else if (currentIdx === 18) isSelected = isShankSubflow ? shankSecSettings.includes(type) : headSecSettings.includes(type);
                else isSelected = (selectedOptions[currentIdx] || []).includes(type);
              }
              
              const isRestricted = currentIdx === 0 && ["Earrings", "Bracelets", "Necklace", "Body Jewelry", "Accessories"].includes(type);
              
              const sizeClass = [2, 3, 5, 7, 8, 11, 12, 13, 14, 15, 16, 18, 19].includes(currentIdx) 
                ? 'whitespace-nowrap text-3xl font-bold' 
                : currentIdx === 1 
                  ? 'text-7xl font-bold' 
                  : 'whitespace-pre-line text-4xl font-semibold';
                  
              const opacityClass = isRestricted ? 'opacity-30 cursor-not-allowed font-medium' : isSelected ? 'font-black' : 'opacity-80 hover:opacity-100';
              const textColClass = !isSelected ? (isDarkMode ? 'text-[#9ca3af]' : 'text-[#111827]') : '';
              const finalBtnClass = `${sizeClass} tracking-tighter text-center leading-[1.1] ${opacityClass} ${textColClass}`;

              return (
                <div key={`type-${index}`} className={`flex flex-col items-center justify-center gap-2 break-inside-avoid ${currentIdx === 0 && ["Necklace", "Body Jewelry", "Accessories"].includes(type) ? 'mt-8' : ''}`}>
                  <button disabled={isRestricted} onClick={() => { !isRestricted && toggleOption(currentIdx, type, isSelected); }} className={finalBtnClass}>
                    {type}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center relative overflow-hidden ${isDarkMode ? 'bg-[#111827] text-[#f9fafb]' : 'bg-[#ffffff] text-[#1f2937]'}`}>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
      <div className={`w-full flex flex-col items-center duration-0 ${isAnyModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <header className={`fixed top-0 left-0 right-0 h-10 flex items-center justify-between px-0 z-50 transform ${isDarkMode ? 'bg-[#1f2937]' : 'bg-[#e5e7eb] border-b border-[#d1d5db]'} shadow-sm`}>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><button onClick={() => navigate('/', { replace: true })} className="text-xl font-black uppercase tracking-[0.35em] leading-none text-gray-500 transition-all duration-300 cursor-pointer hover:opacity-80 pointer-events-auto">SLS LIBRARY</button></div>
          <div className="flex items-center h-full pr-4 z-10 ml-auto gap-3">
            {userEmail ? (
              <>
                <span className={`text-xs font-bold tracking-wider truncate max-w-[160px] ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{userEmail}</span>
                <button onClick={() => { clearAuthToken(); setUserEmail(null); navigate('/login'); }} title="Logout" className={`opacity-60 hover:opacity-100 transition-opacity ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}><LogOut size={14} /></button>
              </>
            ) : (
              <button onClick={() => navigate('/login')} className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 border ${isDarkMode ? 'border-gray-600 text-gray-400 hover:text-white' : 'border-gray-400 text-gray-600 hover:text-black'}`}>Login</button>
            )}
            <div onClick={() => setIsDarkMode(!isDarkMode)} className={`relative flex items-center w-12 h-6 rounded-full border p-0.5 cursor-pointer transition-colors ${isDarkMode ? 'bg-[#111827] border-[#374151]' : 'bg-[#ffffff] border-[#cbd5e1]'} shadow-sm`}>
              <div className={`absolute w-4 h-4 rounded-full transform flex items-center justify-center shadow-md transition-transform duration-200 ${isDarkMode ? 'translate-x-0 bg-[#374151] text-white' : 'translate-x-7 bg-white text-[#f59e0b]'}`}>{isDarkMode ? <Moon size={10} /> : <Sun size={10} />}</div>
            </div>
          </div>
        </header>
        <footer className={`fixed bottom-0 left-0 right-0 h-3 z-50 transform ${isDarkMode ? 'bg-[#1f2937]' : 'bg-[#e5e7eb] border-t border-[#d1d5db]'} shadow-sm`} />
        {!isSerchExpanded && (
          <div className="w-full flex-1 flex flex-col items-center justify-start pt-8 pb-6 px-4 overflow-y-auto hide-scrollbar min-h-[calc(100vh-40px)] mt-10 relative">
            {activeMenuIndex !== 0 && activeMenuIndex !== null && ( 
              <> 
                <button onClick={handleOldSchemeBack} onContextMenu={(e) => { e.preventDefault(); handleHistoryBack(); }} className={`fixed left-10 top-14 flex items-center justify-center transition-opacity hover:opacity-70 z-50 ${isDarkMode ? 'text-white' : 'text-black'}`}><ArrowLeft size={32} strokeWidth={2.5} /></button> 
              </> 
            )}
            {renderCurrentView()}
          </div>
        )}
      </div>

      {isAnyModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
          <div className={`w-[96vw] h-[92vh] rounded-lg shadow-2xl relative flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#1f2937] text-white' : 'bg-white text-black'}`}>
            <div className="pt-10 px-8 pb-8 flex flex-col h-full overflow-hidden">
              <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:min-h-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-4 p-2 hide-scrollbar">
                {menuLabels.map((label, index) => {
                  if ([0, 1, 6, 9].includes(index) || label === "" || label === "GEMS") return null;
                  let selections: string[] = []; 
                  const textureItems = selectedOptions[19] || [];
                  if ([2, 3].includes(index)) selections = selectedOptions[index] || [];
                  else if (index === 5) selections = selectedHeadItems.filter(item => !textureItems.includes(item));
                  else if (index === 16) selections = selectedShankItems.filter(item => !textureItems.includes(item));
                  else if (index === 19) selections = textureItems;
                  else if (index === 15) { selections = selectedOptions[index] || []; selections = [...selections, ...selectedProfileItems]; }
                  else { selections = selectedOptions[index] || []; }
                  
                  if (index === 4) { if (selectedSizeItems.length > 0) selections = [`US Size: ${selectedSizeItems[0]}`]; else return null; }
                  const uniqueSelections = Array.from(new Set(selections.filter(item => !["Rings", "Bands", "HEAD", "MineGem", "GEMS", "TYPE", "Texture&Details", "Head Setting"].includes(item)))); 
                  if (uniqueSelections.length === 0) return null;
                  return (
                    <div key={index} className={`flex flex-col border-b pb-2 last:border-0 h-fit ${isDarkMode ? 'border-[#374151]' : 'border-[#f0f0ed]'}`}>
                      <button onClick={() => handleEditItem(index, "")} className="text-lg font-extrabold uppercase tracking-tight mb-2 border-l-4 border-green-500 text-left pl-4 hover:text-green-500">{label}</button>
                      <div className="flex flex-col gap-1">{uniqueSelections.map((item, idx) => ( <div key={idx} className="flex items-center justify-between group"><span className="text-sm font-medium leading-tight opacity-90 whitespace-pre-line">{(isInteractiveMode && item.includes('_')) ? renderInteractiveCode(item) : (item.startsWith("SEC_") ? item.replace("SEC_", "") : item)}</span><div className="flex items-center gap-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => removeItemGlobally(index, item)} className="text-red-500 hover:text-red-400"><X size={14} /></button><button onClick={(e) => { e.preventDefault(); handleEditItem(index, item); }} onContextMenu={(e) => { e.preventDefault(); setIsInteractiveMode(!isInteractiveMode); }} className="transition-colors"><Pencil size={14} color={isInteractiveMode ? "#16a34a" : "currentColor"} /></button></div></div> ))}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {infoRing && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setInfoRing(null)}>
          <div style={{ background: '#0f1b2b', padding: '24px', borderRadius: '8px', minWidth: '320px', color: '#fff' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '18px', marginBottom: '12px' }}>Ring Info</div>
            <div><span style={{ color: 'red', fontWeight: 700 }}>TYPE: </span>{infoRing.ring_type_names?.join(', ') || '—'}</div>
            <div><span style={{ color: 'red', fontWeight: 700 }}>HEAD SETTINGS: </span>{infoRing.head_setting_names?.join(', ') || '—'}</div>
            <div><span style={{ color: 'red', fontWeight: 700 }}>HEAD TEXTURES: </span>{infoRing.head_texture_names?.join(', ') || '—'}</div>
            <div><span style={{ color: 'red', fontWeight: 700 }}>SHANK TYPES: </span>{infoRing.shank_type_names?.join(', ') || '—'}</div>
            <div><span style={{ color: 'red', fontWeight: 700 }}>SHANK TEXTURES: </span>{infoRing.shank_texture_names?.join(', ') || '—'}</div>
            <div><span style={{ color: 'red', fontWeight: 700 }}>PROFILE: </span>{infoRing.profile_names?.join(', ') || '—'}</div>
            <div><span style={{ color: 'red', fontWeight: 700 }}>US SIZE: </span>{infoRing.finger_size || '—'}</div>
            <div><span style={{ color: 'red', fontWeight: 700 }}>MAIN GEM: </span>{infoRing.head_gem ? [infoRing.head_gem.settings, infoRing.head_gem.shape, infoRing.head_gem.direction, infoRing.head_gem.size && `sz:${infoRing.head_gem.size}`, `×${infoRing.head_gem.count}`].filter(Boolean).join(' / ') : '—'}</div>
            <div style={{ display: 'flex' }}><span style={{ color: 'red', fontWeight: 700,marginRight: 5, flexShrink: 0 }}>SHANK GEM: </span><div>{infoRing.shank_gems?.length ? infoRing.shank_gems.map((g, i) => <div key={i}>{[g.settings, g.shape, g.direction, g.size && `sz:${g.size}`, `×${g.count}`].filter(Boolean).join(' / ')}</div>) : '—'}</div></div>
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button onClick={() => setInfoRing(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {isFullScreenImage && selectedImage && (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center animate-in fade-in zoom-in duration-200">
          <button onClick={() => setIsFullScreenImage(false)} className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors z-[210] p-2 hover:bg-white/10 rounded-full"><X size={48} strokeWidth={2.5} /></button>
          <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
             <div 
               className="absolute inset-0 opacity-60 grayscale-[30%]" 
               style={{ 
                 backgroundImage: `url(${selectedImage})`, 
                 backgroundSize: 'cover', 
                 backgroundPosition: 'center', 
                 filter: 'blur(60px)',
                 transform: 'scale(1.2)'
               }} 
             />
             <img src={selectedImage} className="relative z-10 max-w-full max-h-full object-contain pointer-events-none drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)]" alt="Full Screen View" />
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

export default App;
