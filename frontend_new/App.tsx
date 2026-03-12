import React, { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Pencil, X, Moon, Sun, Search, ArrowLeft, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Maximize2, Check, Download, Plus, Trash2, LogOut } from 'lucide-react';
import { fetchLookups, searchRings, createRing, fetchRingFiles, matchIds, login, me, getAuthToken, clearAuthToken, type Lookups, type Ring } from './api/jewelry';
import { getBaseUrl } from './api/client';
import JSZip from 'jszip';
import StlViewer from './components/StlViewer';

// Define constants for ring sizes and menu labels
const INTEGER_SIZE_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"];
const CUSTOMER_NAMES = [
  "Adam Warlock", "Alejandra Jones", "Alex Summers", "Alexander Wright", "Alicia Masters",
  "Amara Okafor", "America Chavez", "Anna Marie", "Aria Gupta", "Arthur Curry",
  "Barry Allen", "Belasco", "Ben Grimm", "Ben Reilly", "Benjamin Lee",
  "Betsy Braddock", "Blackheart", "Blind Al", "Bobby Drake", "Bruce Wayne",
  "Bucky Barnes", "Carol Danvers", "Carter Slade", "Cassie Lang", "Charles Xavier",
  "Charlotte Smith", "Chloe Lefebvre", "Clark Kent", "Cletus Kasady", "Clint Barton",
  "Daimon Hellstrom", "Daniel Kim", "Danny Ketch", "Danny Rand", "David Haller",
  "David Miller", "Diana Prince", "Dopinder", "Drax the Destroyer", "Eddie Brock",
  "Elena Rodriguez", "Erik Lehnsherr", "Ethan Hunt", "Felicity Smoak", "Flash Thompson",
  "Foggy Nelson", "Francis Freeman", "Frank Castle", "Franklin Richards", "Gabriel Santos",
  "Gabriel Summers", "Gamora", "Groot", "Gwen Stacy", "Gwenpool",
  "Hal Jordan", "Hank McCoy", "Harry Osborn", "Hiroshi Sato", "Hobie Brown",
  "Hope Summers", "Hope van Dyne", "Iris West", "Isabella Garcia", "Isabella Rossi",
  "Jack Hammer", "James Wilson", "Jean Grey", "Jennifer Kale", "Jennifer Walters",
  "Jessica Jones", "Johnny Blaze", "Johnny Storm", "John Stewart", "Jubilation Lee",
  "Kamala Khan", "Kara Danvers", "Karen Page", "Kate Bishop", "Kevin Sydney",
  "Kitty Pryde", "Kristoff Vernard", "Kurt Wagner", "Kushala", "Leo Petrov",
  "Liam O'Connor", "Lilith", "Logan Howlett", "Loki Laufeyson", "Lorna Dane",
  "Lucas Muller", "Lucas Varga", "Luke Cage", "Lyja", "Lyra",
  "Mantiss", "Marc Spector", "Marcus Thorne", "Mateo Silva", "Matt Murdock",
  "Mayday Parker", "Mephisto", "Mia Tanaka", "Miguel O'Hara", "Miles Morales",
  "Natasha Romanoff", "Nathan Summers", "Nathaniel Grey", "Nathaniel Richards", "Nebula",
  "Neena Thurman", "Noah Schmidt", "Noble Kale", "Norman Osborn", "Norrin Radd",
  "Oliver Quinn", "Olivia Dubois", "Ororo Munroe", "Otto Octavius", "Pavitr Prabhakar",
  "Penny Parker", "Peter B. Parker", "Peter Maximoff", "Peter Parker", "Peter Quill",
  "Phyla-Vell", "Piotr Rasputin", "Rachel Summers", "Raven Darkholme", "Reed Richards",
  "Remy LeBeau", "Robbie Reyes", "Rocket Raccoon", "Russell Collins", "Sam Wilson",
  "Satana Hellstrom", "Scott Lang", "Scott Summers", "Sean Cassidy", "Selina Kyle",
  "Shalla-Bal", "Sienna Jones", "Sofia Martinez", "Sophia Chen", "Stephen Strange",
  "Steve Rogers", "Sue Storm", "T'Challa", "Thor Odinson", "Tony Stark",
  "Valeria Richards", "Vanessa Carlysle", "Victor Stone", "Victor von Doom", "Wade Wilson",
  "Wally West", "Wanda Maximoff", "Warren Worthington", "William Brown", "Wilson Fisk",
  "Wyatt Wingfoot", "Yara Al-Sayed", "Yondu Udonta", "Yukio", "Zara Ahmed",
  "Zarathos"
];
const SUFFIX_OPTIONS = [".25", ".5", ".75"];

// ── Label-to-DB normalization maps ────────────────────────────────────────────
// The frontend uses abbreviated or differently-spelled names. These maps translate
// them to the exact backend names before matchIds is called.

// menu[15] → lookups.profiles  ("Arch, D-Shape" vs "Arch-Shape" in DB)
const PROFILE_LABEL_MAP: Record<string, string> = {
  'Arch, D-Shape':         'Arch-Shape',
  'Arch, D-Shape Comfort': 'Arch-Shape Comfort',
};

// menu[14] → lookups.shank_types  (DB uses full "Classic Shank" etc.; avoids prefix over-match)
const SHANK_TYPE_LABEL_MAP: Record<string, string> = {
  'Classic':             'Classic Shank',
  'Tapered':             'Tapered Shank',
  'Split':               'Split Shank',
  'Bypass':              'Bypass Shank',
  'Euro':                'Euro Shank',
  'Cathedral & Tapered': 'Cathedral & Tapered Shank',
};

function applyLabelMap(names: string[], map: Record<string, string>): string[] {
  return names.map(n => map[n] ?? n);
}
// ─────────────────────────────────────────────────────────────────────────────

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
  "SHANK TYPE",         // 14
  "PROFILE",      // 15
  "TYPE",        // 16
  "TYPE",             // 17
  "SETTING",      // 18
  "Texture&Details"      // 19
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

type ShankGemRow = { settings: string; settingId: number | null; shapes: string; directions: string; size: string; count: string };
const mkShankGem = (): ShankGemRow => ({ settings: '', settingId: null, shapes: '', directions: '', size: '', count: '' });

const App: React.FC = () => {
  const detailsDropdownRef = useRef<HTMLDivElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const customerListRef = useRef<HTMLDivElement>(null);
  const customerTrackRef = useRef<HTMLDivElement>(null);
  const scrollListRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInput3DMRef = useRef<HTMLInputElement>(null);
  const fileInputSTLRef = useRef<HTMLInputElement>(null);
  const fileInputMediaRef = useRef<HTMLInputElement>(null);
  const typePickerInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const [uploadedAssets, setUploadedAssets] = useState<Record<string, boolean>>({});
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(0);
  const [menuHistory, setMenuHistory] = useState<number[]>([0]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [headGemPickerField, setHeadGemPickerField] = useState<
    'ring_type' | 'band_type' | 'head_setting' | 'head_texture' |
    'shank_type' | 'profile' | 'shank_texture' |
    'settings' | 'shapes' | 'directions' | null>(null);
  const gemPickerSetterRef = useRef<((v: string[]) => void) | null>(null);
  const [typePickerQuery, setTypePickerQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSerchExpanded, setIsSerchExpanded] = useState(false);
  const [hasSearchBeenClicked, setHasSearchBeenClicked] = useState(false);
  const [hasCustomerSearchBeenClicked, setHasCustomerSearchBeenClicked] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isCustomerSearchFocused, setIsCustomerSearchFocused] = useState(false);
  const [isSizeFocused, setIsSizeFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPlaceholder, setSearchPlaceholder] = useState("Search by Name or ID");
  const [targetCategoryIndex, setTargetCategoryIndex] = useState<number>(2);
  
  const [activeJewelryType, setActiveJewelryType] = useState<'ring' | 'band'>('ring');
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

  const [shankGems, setShankGems] = useState<ShankGemRow[]>([mkShankGem()]);
  const [shankPickerRow, setShankPickerRow] = useState(0);
  const [shankPickerField, setShankPickerField] = useState<'settings' | 'shapes' | 'directions' | null>(null);
  const updateShankGem = (idx: number, patch: Partial<ShankGemRow>) =>
    setShankGems(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));

  const [isShankSubflow, setIsShankSubflow] = useState<boolean>(false);
  // Tracks where gem sub-screens (18/12/13) return to: 9 = builder, 16 = shank inline
  const [gemBuilderHome, setGemBuilderHome] = useState<number>(9);
  const [isInteractiveMode, setIsInteractiveMode] = useState<string | null>(null);

  const [activeDropdown, setActiveDropdown] = useState<'details-size' | null>(null);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [focusedCustomerIndex, setFocusedCustomerIndex] = useState(-1);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [jobName, setJobName] = useState("");
  const [jobPlaceholder, setJobPlaceholder] = useState("Job Name");
  const [sizeInputBuffer, setSizeInputBuffer] = useState<string>("");
  const [showSuffixMenu, setShowSuffixMenu] = useState<boolean>(false);

  const [selectedOptions, setSelectedOptions] = useState<Record<number, string[]>>({});
  const [history, setHistory] = useState<Record<number, string[]>[]>([]);
  const [redoStack, setRedoStack] = useState<Record<number, string[]>[]>([]);

  // ── Backend integration state ─────────────────────────────────────────────
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const validSizes = useMemo(() => (lookups?.finger_sizes || []).map(x => String(x.name)), [lookups]);
  const [rings, setRings] = useState<Ring[]>([]);
  const [file3dm, setFile3dm] = useState<File | null>(null);
  const [fileStl, setFileStl] = useState<File | null>(null);
  const [fileMedia, setFileMedia] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  // ─────────────────────────────────────────────────────────────────────────

  const listItemsCount = rings.length;
  const thumbHeight = 128; // h-32 in Tailwind is 8rem = 128px
  
  // Adjusted gaps: top and bottom are set to 30px to accommodate the arrow buttons
  const topPadding = 22; 
  const bottomPadding = 22; 
  const [thumbTop, setThumbTop] = useState(topPadding);
  const [customerThumbTop, setCustomerThumbTop] = useState(16);
  const [customerThumbHeight, setCustomerThumbHeight] = useState(64);
  const [isCustomerScrollbarReady, setIsCustomerScrollbarReady] = useState(false);
  const [isDraggingThumb, setIsDraggingThumb] = useState(false);
  const [isDraggingCustomerThumb, setIsDraggingCustomerThumb] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [customerDragOffset, setCustomerDragOffset] = useState(0);

  const [selectedListItem, setSelectedListItem] = useState<number | null>(null);
  const [infoRing, setInfoRing] = useState<Ring | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(DEFAULT_PRODUCT_IMAGE);
  const [libraryImages, setLibraryImages] = useState<Record<number, string>>({});
  const [ringImages, setRingImages] = useState<string[]>([]);
  const [ringStl, setRingStl] = useState<string | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'IMAGE' | 'STL'>('IMAGE');

  const [showSummaryOverlay, setShowSummaryOverlay] = useState<boolean>(false);
  const [overlayPage, setOverlayPage] = useState<number>(0);
  const [isFullScreenImage, setIsFullScreenImage] = useState<boolean>(false);

  const [showSkipWarning, setShowSkipWarning] = useState<boolean>(false);
  const [missingSections, setMissingSections] = useState<string[]>([]);
  const [onSkipConfirm, setOnSkipConfirm] = useState<(() => void) | null>(null);
  const [isSkipChecked, setIsSkipChecked] = useState<boolean>(false);
  const [activeAssetType, setActiveAssetType] = useState<'image' | 'stl' | '3dm'>('image');
  const [activeMagnifiers, setActiveMagnifiers] = useState<Record<string, boolean>>({});

  const menuData: Record<number, string[]> = {
    0: ["Rings", "Earrings", "Bracelets", "Necklace", "Body Jewelry", "Accessories"],
    1: ["Rings", "Bands"],
    2: lookups?.ring_types.map(rt => rt.name) ?? [],
    3: ["Wedding Bands", "Eternity Bands", "Plain Bands", "Domed Bands", "Twisted Bands", "Split Bands"],
    5: ["HEAD", "GEMS", "MineGem", "Texture&Details"], 
    7: lookups?.head_settings.map(s => s.name) ?? [],
    8: [],
    9: ["Secondary Settings", "Shape", "Direction", "Size", "Count"],
    11: lookups?.head_stone_settings.map(s => s.name) ?? [],
    12: lookups?.stone_shapes.map(s => s.name) ?? [],
    13: lookups?.directions.map(s => s.name) ?? [],
    14: ["Classic", "Knife-Edge", "Cathedral", "Tapered", "Split", "Twisted (Infinity)", "Bypass", "Euro", "Cathedral & Tapered", "Open", "Fancy"],
    15: ["Rectangular", "Roundish", "Half-Roundish", "Arch, D-Shape", "Knife-Edge", "Knife-Arch", "Fancy", "Rectangular Comfort", "Roundish Comfort", "Half-Roundish Comfort", "Arch, D-Shape Comfort", "Knife-Edge Comfort", "Knife-Arch Comfort", "Fancy Comfort"],
    16: ["TYPE", "GEMS", "PROFILE", "Texture&Details"], 
    18: ["Prong Setting", "Flush Setting", "French Pave", "Bezel Setting", "Channel Setting", "Pavé Setting", "Micro Pavé", "Tension Setting", "Bar Setting", "Cluster Setting", "Invisible Setting", "Burnish Setting"],
    19: lookups?.textures.map(t => t.name) ?? []
  };

  const parseSizeForSort = (item: string) => {
    const parts = item.split('_');
    if (parts.length > 4) {
      const sizeStr = parts[4];
      const num = parseFloat(sizeStr);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const sortGemsBySizeDesc = (a: string, b: string) => {
    return parseSizeForSort(b) - parseSizeForSort(a);
  };

  const getOrderedHeadItems = (items: string[]) => {
    const headTypes = items.filter(i => menuData[7].includes(i) || menuData[8].includes(i));
    const mainGems = items.filter(i => i.startsWith("M_")).sort(sortGemsBySizeDesc);
    const secGems = items.filter(i => i.startsWith("SEC_")).sort(sortGemsBySizeDesc);
    const textures = items.filter(i => menuData[19].includes(i));
    const known = new Set([...headTypes, ...mainGems, ...secGems, ...textures, "HEAD", "MineGem", "GEMS", "Head Setting", "Texture&Details"]);
    const others = items.filter(i => !known.has(i));
    return [...headTypes, ...mainGems, ...secGems, ...textures, ...others];
  };

  const getOrderedShankItems = (shankItems: string[], profileItems: string[]) => {
    const types = shankItems.filter(i => menuData[14].includes(i)).map(i => ({ item: i, cat: 16 }));
    const secGems = shankItems.filter(i => i.startsWith("SEC_")).sort(sortGemsBySizeDesc).map(i => ({ item: i, cat: 16 }));
    const profiles = profileItems.map(i => ({ item: i, cat: 15 }));
    const textures = shankItems.filter(i => menuData[19].includes(i)).map(i => ({ item: i, cat: 16 }));
    
    const known = new Set([...types.map(t=>t.item), ...secGems.map(t=>t.item), ...textures.map(t=>t.item), "TYPE", "GEMS", "Texture&Details", "PROFILE"]);
    const others = shankItems.filter(i => !known.has(i)).map(i => ({ item: i, cat: 16 }));
    
    return [...types, ...secGems, ...textures, ...profiles, ...others];
  };

  // Map ring ID → Ring object for O(1) lookup in the list render
  const ringsMap = useMemo<Record<number, Ring>>(() => {
    const m: Record<number, Ring> = {};
    rings.forEach(r => { m[r.id] = r; });
    return m;
  }, [rings]);

  const navigateTo = (idx: number | null, newJewelryType?: 'ring' | 'band') => {
    const target = idx === null ? 0 : idx;
    if (target === activeMenuIndex) return;
    setMenuHistory(prev => [...prev, target]);
    setActiveMenuIndex(target);
    // Only push a URL entry when transitioning between top-level routes.
    // In-page section switches within /rings or /bands must NOT create history entries.
    const isTopLevelForward =
      target === 0 ||
      target === 1 ||
      (target === 4 && (activeMenuIndex === 0 || activeMenuIndex === 1));
    if (isTopLevelForward) {
      const jt = newJewelryType ?? activeJewelryType;
      const route =
        target === 0 ? '/jewelry-type' :
        target === 1 ? '/type' :
        jt === 'band' ? '/bands' : '/rings';
      if (route !== location.pathname) {
        // Entering /rings or /bands: replace /type so browser Back skips it.
        // Store menuIndex:4 so the base /rings state is restorable.
        navigate(route, target === 4 ? { state: { menuIndex: 4 } } : undefined);
      }
    } else if (location.pathname === '/rings' || location.pathname === '/bands') {
      // Internal step within rings/bands: push a same-URL history entry so that
      // browser Back/Forward walks these steps without changing the pathname.
      navigate(location.pathname, { state: { menuIndex: target } });
    }
  };

  const handleOldSchemeBack = () => {
    const idx = activeMenuIndex;
    let target = 0;
    if (idx === 4) target = 1;
    else if (idx === 2 || idx === 3 || idx === 5 || idx === 16) target = 4;
    else if (idx === 14 || idx === 15) target = 16;
    else if (idx === 6 || idx === 7 || idx === 8) target = 5;
    else if (idx === 9 || idx === 19) target = isShankSubflow ? 16 : 5;
    else if (idx === 11 || idx === 12 || idx === 13 || idx === 18) target = gemBuilderType === 'main' ? 5 : gemBuilderHome;
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

  const prepareEditState = useCallback((item: string, categoryIndex?: number) => {
    if (item.startsWith("US Size: ")) return false;
    setEditingItemCode(item);
    
    // If it's a Texture&Details item, we need to know if it's from the shank or head
    if (categoryIndex === 19 || menuData[19].includes(item)) {
      const inShank = selectedShankItems.includes(item);
      setIsShankSubflow(inShank);
    }

    if (item.includes('_')) {
      const isSec = item.startsWith("SEC_");
      const isMain = item.startsWith("M_");
      const parts = isSec ? item.substring(4).split('_') : (isMain ? item.substring(2).split('_') : item.split('_'));
      
      if (isSec) {
        const inShank = selectedShankItems.includes(item);
        setIsShankSubflow(inShank);
        setGemBuilderType('secondary');
        const setter = inShank ? { setSettings: setShankSecSettings, setShapes: setShankSecShapes, setDirections: setShankSecDirections, setSize: setShankSecSize, setCount: setShankSecCount } : { setSettings: setHeadSecSettings, setShapes: setHeadSecShapes, setDirections: setHeadSecDirections, setSize: setHeadSecSize, setCount: setHeadSecCount };
        
        const secSettingMapRev: Record<string, string> = { "PR": "Prong Setting", "FL": "Flush Setting", "FP": "French Pave", "BZ": "Bezel Setting", "CH": "Channel Setting", "PV": "Pavé Setting", "MP": "Micro Pavé", "TN": "Tension Setting", "BR": "Bar Setting", "CL": "Cluster Setting", "IN": "Invisible Setting", "BN": "Burnish Setting" };
        const shapeMapRev: Record<string, string> = { "RD": "Round", "AS": "Asscher", "CU": "Cushion", "EM": "Emerald", "MQ": "Marquise", "OV": "Oval", "PE": "Pear", "PR": "Princess", "RA": "Radiant", "SR": "Radiant Square", "SC": "Cushion Square", "HT": "Heart", "BG": "Baguette", "TB": "Tapered Baguette", "HX": "Hexagon", "KT": "Kite", "TR": "Trillion", "HM" : "Half Moon" };
        const directionMapRev: Record<string, string> = { "NS": "North-South", "SL": "Slanted", "AL": "Alternating", "EW": "Est-West", "ND": "Not-Directed" };

        if (parts[0]) { const foundSetting = secSettingMapRev[parts[0]] || menuData[18].find(s => s.substring(0, 2).toUpperCase() === parts[0]); if (foundSetting) setter.setSettings([foundSetting]); }
        if (parts[1]) { const foundShape = shapeMapRev[parts[1]] || menuData[12].find(s => s.substring(0, 2).toUpperCase() === parts[1]); if (foundShape) setter.setShapes([foundShape]); }
        if (parts[2]) { 
           const foundDir = directionMapRev[parts[2]] || menuData[13].find(s => s.substring(0, 2).toUpperCase() === parts[2]); 
           if (foundDir) setter.setDirections([foundDir]); 
        }
        if (parts[3]) setter.setSize(parts[3]);
        if (parts[4]) setter.setCount(parts[4]);
      } else {
        setGemBuilderType('main');
        const settingMapRev: Record<string, string> = { "BZ": "Bezel", "HB": "Half bezel", "3P": "Three Prongs", "FP": "Four Prongs", "5P": "Five Prongs", "6P": "Six Prongs", "DP": "Double Prong", "BN": "Burnish", "PG": "Peg" };
        const shapeMapRev: Record<string, string> = { "RD": "Round", "AS": "Asscher", "CU": "Cushion", "EM": "Emerald", "MQ": "Marquise", "OV": "Oval", "PE": "Pear", "PR": "Princess", "RA": "Radiant", "SR": "Radiant Square", "SC": "Cushion Square", "HT": "Heart", "BG": "Baguette", "TB": "Tapered Baguette", "HX": "Hexagon", "KT": "Kite", "TR": "Trillion", "HM" : "Half Moon" };
        const directionMapRev: Record<string, string> = { "NS": "North-South", "SL": "Slanted", "AL": "Alternating", "EW": "Est-West", "ND": "Not-Directed" };
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
    setIsSaveModalOpen(false); 
    if (prepareEditState(item, categoryIndex)) {
      if (item.includes('_')) { navigateTo(item.startsWith("SEC_") ? 9 : 6); } else {
        if ([5, 7, 8].includes(categoryIndex)) { 
          if (menuData[7].includes(item) || item === "Head Setting") { navigateTo(7); return; } 
          if (menuData[8].includes(item)) { navigateTo(8); return; } 
          if (menuData[19].includes(item)) { setIsShankSubflow(false); navigateTo(19); return; }
          navigateTo(5); return; 
        }
        if ([14, 16, 15].includes(categoryIndex)) { 
          if (menuData[14].includes(item) || item === "TYPE") { navigateTo(14); return; } 
          if (menuData[15].includes(item) || item === "PROFILE") { navigateTo(15); return; } 
          if (menuData[19].includes(item)) { setIsShankSubflow(true); navigateTo(19); return; }
          navigateTo(16); return; 
        }
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

  const renderInteractiveCode = (item: string, isSummary: boolean = false) => {
    if (!item.includes('_')) return <span>{item}</span>;
    const isSec = item.startsWith("SEC_");
    const isMain = item.startsWith("M_");
    const parts = item.split('_');
    const placeholders = ["SET", "SHP", "DIR", "SIZ", "COU"];
    
    const pencilCursor = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMGM0YTciIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTcgM2EyLjg1IDIuODMgMCAxIDEgNCA0TDcuNSAyMC41IDIgMjJsMS41LTUuNVoiLz48cGF0aCBkPSJtMTUgNSA0IDQiLz48L3N2Zz4=") 0 24, auto';
    
    return (
      <span className="flex items-center" onClick={(e) => e.stopPropagation()}>
        {parts.map((p, i) => {
          let targetIdx = -1;
          if (isSec) { if (i === 1) targetIdx = 18; if (i === 2) targetIdx = 12; if (i === 3) targetIdx = 13; if (i === 4 || i === 5) targetIdx = 9; }
          else if (isMain) { if (i === 1) targetIdx = 11; if (i === 2) targetIdx = 12; if (i === 3) targetIdx = 13; if (i === 4 || i === 5) targetIdx = 6; }
          else { if (i === 0) targetIdx = 11; if (i === 1) targetIdx = 12; if (i === 2) targetIdx = 13; if (i === 3 || i === 4) targetIdx = 6; }
          
          const isPlaceholder = placeholders.includes(p);
          const isInteractive = isInteractiveMode === item && !isSummary;
          const colorClass = isPlaceholder ? "red-mist-glow text-[#ef4444]" : (isDarkMode ? "text-white" : "text-black");
          const hoverClass = isInteractive ? "hover:text-[#00c4a7] interactive-hover" : "";
          const showUnderscore = i < parts.length - 1;

          if (p === 'SEC' || p === 'M') return <span key={i} className={`cursor-default ${isDarkMode ? 'text-white' : 'text-black'}`}>{p}_</span>;
          return (
            <React.Fragment key={i}>
              <span 
                onClick={(e) => { e.stopPropagation(); if (targetIdx !== -1 && isInteractive) { prepareEditState(item); navigateTo(targetIdx); } }} 
                className={`transition-colors duration-75 ${colorClass} ${hoverClass}`} 
                style={{ cursor: isInteractive ? pencilCursor : 'default' }}
              >
                {p}
              </span>
              {showUnderscore && <span className={`cursor-default ${isDarkMode ? 'text-white' : 'text-black'}`}>_</span>}
            </React.Fragment>
          );
        })}
      </span>
    );
  };

  const generateMainGemsCode = useCallback(() => {
    const settingMap: Record<string, string> = { "Bezel": "BZ", "Half bezel": "HB", "Three Prongs": "3P", "Four Prongs": "FP", "Five Prongs": "5P", "Six Prongs": "6P", "Double Prong": "DP", "Burnish": "BN", "Peg": "PG" };
    const shapeMap: Record<string, string> = { "Round": "RD", "Asscher": "AS", "Cushion": "CU", "Emerald": "EM", "Marquise": "MQ", "Oval": "OV", "Pear": "PE", "Princess": "PR", "Radiant": "RA", "Radiant Square": "SR", "Cushion Square": "SC", "Heart": "HT", "Baguette": "BG", "Tapered Baguette": "TB", "Hexagon": "HX", "Kite": "KT", "Trillion": "TR", "Half Moon" : "HM" };
    const directionMap: Record<string, string> = { "North-South": "NS", "Slanted": "SL", "Alternating": "AL", "Est-West": "EW", "Not-Directed": "ND" };
    const parts: string[] = ["M"]; // Always start with M_
    
    parts.push(mainGemsSettings[0] ? (settingMap[mainGemsSettings[0]] || mainGemsSettings[0].substring(0, 2).toUpperCase()) : "SET");
    parts.push(mainGemsShapes[0] ? (shapeMap[mainGemsShapes[0]] || mainGemsShapes[0].substring(0, 2).toUpperCase()) : "SHP");
    parts.push(mainGemsDirections[0] ? (directionMap[mainGemsDirections[0]] || mainGemsDirections[0].substring(0, 1).toUpperCase()) : "DIR");
    parts.push(mainGemsSize ? mainGemsSize.toUpperCase() : "SIZ");
    parts.push(mainGemsCount || "COU");
    
    return parts.join("_");
  }, [mainGemsSettings, mainGemsShapes, mainGemsDirections, mainGemsCount, mainGemsSize]);

  const generateSecondaryGemsCode = useCallback((settings: string[], shapes: string[], directions: string[], size: string, count: string) => {
    const parts: string[] = [];
    
    const secSettingMap: Record<string, string> = { "Prong Setting": "PR", "Flush Setting": "FL", "French Pave": "FP", "Bezel Setting": "BZ", "Channel Setting": "CH", "Pavé Setting": "PV", "Micro Pavé": "MP", "Tension Setting": "TN", "Bar Setting": "BR", "Cluster Setting": "CL", "Invisible Setting": "IN", "Burnish Setting": "BN" };
    const shapeMap: Record<string, string> = { "Round": "RD", "Asscher": "AS", "Cushion": "CU", "Emerald": "EM", "Marquise": "MQ", "Oval": "OV", "Pear": "PE", "Princess": "PR", "Radiant": "RA", "Radiant Square": "SR", "Cushion Square": "SC", "Heart": "HT", "Baguette": "BG", "Tapered Baguette": "TB", "Hexagon": "HX", "Kite": "KT", "Trillion": "TR", "Half Moon" : "HM" };
    
    parts.push(settings[0] ? (secSettingMap[settings[0]] || settings[0].substring(0, 2).toUpperCase()) : "SET");
    parts.push(shapes[0] ? (shapeMap[shapes[0]] || shapes[0].substring(0, 2).toUpperCase()) : "SHP");
    
    if (directions[0]) {
       const mapping: Record<string, string> = { "North-South": "NS", "Slanted": "SL", "Alternating": "AL", "Est-West": "EW", "Not-Directed": "ND" };
       parts.push(mapping[directions[0]] || directions[0].substring(0, 2).toUpperCase());
    } else {
       parts.push("DIR");
    }
    
    parts.push(size ? size.toUpperCase() : "SIZ");
    parts.push(count || "COU");
    
    return parts.join("_");
  }, []);

  const clearMainGems = useCallback(() => {
    setMainGemsSettings([]); setMainGemsShapes([]); setMainGemsDirections([]); setMainGemsSize(""); setMainGemsCount("");
    setSelectedOptions(prev => { const next = { ...prev }; delete next[11]; delete next[12]; delete next[13]; return next; });
  }, []);

  const clearSecondaryGems = useCallback((type: 'head' | 'shank') => {
    if (type === 'head') { setHeadSecSettings([]); setHeadSecShapes([]); setHeadSecDirections([]); setHeadSecSize(""); setHeadSecCount(""); }
    else { setShankSecSettings([]); setShankSecShapes([]); setShankSecDirections([]); setShankSecSize(""); setShankSecCount(""); }
    setSelectedOptions(prev => { const next = { ...prev }; delete next[18]; delete next[12]; delete next[13]; return next; });
  }, []);

  const getMissingSections = (settings: string[], shapes: string[], directions: string[], size: string, count: string) => {
    const missing = [];
    if (settings.length === 0) missing.push("SETTINGS");
    if (shapes.length === 0) missing.push("SHAPE");
    if (directions.length === 0) missing.push("DIRECTION");
    if (!size) missing.push("SIZE");
    if (!count) missing.push("COUNT");
    return missing;
  };

  const handleAcceptMainGems = useCallback(() => {
    const missing = getMissingSections(mainGemsSettings, mainGemsShapes, mainGemsDirections, mainGemsSize, mainGemsCount);
    
    const proceed = () => {
      const code = generateMainGemsCode();
      if (!code) return;
      if (editingItemCode) { setSelectedHeadItems(prev => prev.map(item => item === editingItemCode ? code : item)); setEditingItemCode(null); } 
      else { setSelectedHeadItems(prev => Array.from(new Set([...prev, code, "MineGem"]))); }
      clearMainGems(); navigateTo(4);
    };

    if (missing.length > 0 && !isSkipChecked) {
      setMissingSections(missing);
      setOnSkipConfirm(() => proceed);
      setShowSkipWarning(true);
    } else {
      proceed();
    }
  }, [mainGemsSettings, mainGemsShapes, mainGemsDirections, mainGemsSize, mainGemsCount, generateMainGemsCode, clearMainGems, editingItemCode, isSkipChecked]);

  const handleAcceptSecondaryGems = useCallback(() => {
    const settings = isShankSubflow ? shankSecSettings : headSecSettings;
    const shapes = isShankSubflow ? shankSecShapes : headSecShapes;
    const directions = isShankSubflow ? shankSecDirections : headSecDirections;
    const size = isShankSubflow ? shankSecSize : headSecSize;
    const count = isShankSubflow ? shankSecCount : headSecCount;

    const missing = getMissingSections(settings, shapes, directions, size, count);

    const proceed = () => {
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
    };

    if (missing.length > 0 && !isSkipChecked) {
      setMissingSections(missing);
      setOnSkipConfirm(() => proceed);
      setShowSkipWarning(true);
    } else {
      proceed();
    }
  }, [isShankSubflow, generateSecondaryGemsCode, shankSecSettings, shankSecShapes, shankSecDirections, shankSecSize, shankSecCount, headSecSettings, headSecShapes, headSecDirections, headSecSize, headSecCount, clearSecondaryGems, editingItemCode, isSkipChecked]);

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
    setSelectedOptions({}); setHistory([]); setRedoStack([]); setActiveMenuIndex(0); setMenuHistory([0]); setIsSaveModalOpen(false); setIsDarkMode(true); setIsSerchExpanded(false); setHasSearchBeenClicked(false); setHasCustomerSearchBeenClicked(false); setSearchQuery(""); setSelectedDetailItems([]); setSelectedHeadItems([]); setSelectedShankItems([]); setSelectedProfileItems([]); setSelectedSizeItems([]); setMainGemsSize(""); setMainGemsCount(""); setMainGemsSettings([]); setMainGemsShapes([]); setMainGemsDirections([]); setHeadSecSettings([]); setHeadSecShapes([]); setHeadSecDirections([]); setHeadSecSize(""); setHeadSecCount(""); setShankSecSettings([]); setShankSecShapes([]); setShankSecDirections([]); setShankSecSize(""); setShankSecCount(""); setShankGems([mkShankGem()]); setSizeInputBuffer(""); setActiveDropdown(null); setShowSuffixMenu(false); setIsShankSubflow(false); setGemBuilderType('main'); setIsInteractiveMode(null); setEditingItemCode(null); setIsSkipChecked(false); setRingStore(initialConfig()); setBandStore(initialConfig()); setActiveJewelryType('ring'); setShowSummaryOverlay(false); setOverlayPage(0); setIsFullScreenImage(false); setSelectedListItem(null); setSelectedImage(DEFAULT_PRODUCT_IMAGE); setRingImages([]); setRingStl(null); setActivePreviewTab('IMAGE'); setUploadedAssets({}); setFile3dm(null); setFileStl(null); setFileMedia([]); setUploadStatus('idle'); setUploadError(null);
  }, []);

  // ── Backend upload handler (must be after resetAll) ───────────────────────
  const handleAccept = useCallback(async () => {
    if (!lookups) return;

    const sizeStr = selectedSizeItems[0] || '';
    // finger_size: DB name field is numeric (e.g. 7.0), sizeStr is a string ("7")
    const fingerSizeItem = lookups.finger_sizes.find(
      fs => parseFloat(String(fs.name)) === parseFloat(sizeStr),
    ) ?? lookups.finger_sizes[0];

    // Ring type: selected via TYPE popup → stored in selectedDetailItems, not selectedOptions[2/3]
    const ringTypeNames = selectedDetailItems.filter(item =>
      activeJewelryType === 'ring' ? menuData[2].includes(item) : menuData[3].includes(item)
    );
    const headItems = [...(selectedOptions[7] || []), ...(selectedOptions[8] || [])];

    // Head main gem: after handleAcceptMainGems, data is encoded as "M_..." in selectedHeadItems
    // and mainGemsSettings is cleared. Decode from the M_ code first; fall back to raw state.
    const settingMapRev: Record<string, string> = { "BZ": "Bezel", "HB": "Half bezel", "3P": "Three Prongs", "FP": "Four Prongs", "5P": "Five Prongs", "6P": "Six Prongs", "DP": "Double Prong", "BN": "Burnish", "PG": "Peg" };
    const shapeMapRev: Record<string, string> = { "RD": "Round", "AS": "Asscher", "CU": "Cushion", "EM": "Emerald", "MQ": "Marquise", "OV": "Oval", "PE": "Pear", "PR": "Princess", "RA": "Radiant", "SR": "Radiant Square", "SC": "Cushion Square", "HT": "Heart", "BG": "Baguette", "TB": "Tapered Baguette", "HX": "Hexagon", "KT": "Kite", "TR": "Trillion", "HM": "Half Moon" };
    const directionMapRev: Record<string, string> = { "NS": "North-South", "SL": "Slanted", "AL": "Alternating", "EW": "Est-West", "ND": "Not-Directed" };
    let headGems: Array<{ head_stone_setting_id: number | null; stone_shape_id: number | null; directions_id: number | null; stone_size: string; stone_count: number }> = [];
    const mainGemCode = selectedHeadItems.find(item => item.startsWith("M_"));
    if (mainGemCode) {
      const parts = mainGemCode.substring(2).split('_');
      const settingName = settingMapRev[parts[0]] || menuData[11].find(o => o.substring(0, 2).toUpperCase() === parts[0]);
      const shapeName   = shapeMapRev[parts[1]]   || menuData[12].find(o => o.substring(0, 2).toUpperCase() === parts[1]);
      const dirName     = directionMapRev[parts[2]] || menuData[13].find(o => o.substring(0, 1).toUpperCase() === parts[2]);
      headGems = [{
        head_stone_setting_id: settingName ? matchIds([settingName], lookups.head_stone_settings)[0] ?? null : null,
        stone_shape_id:        shapeName   ? matchIds([shapeName],   lookups.stone_shapes)[0]          ?? null : null,
        directions_id:         dirName     ? matchIds([dirName],     lookups.directions)[0]             ?? null : null,
        stone_size:  parts[3] || '',
        stone_count: parseInt(parts[4]) || 1,
      }];
    } else if (mainGemsSettings.length > 0) {
      headGems = [{
        head_stone_setting_id: matchIds(mainGemsSettings, lookups.head_stone_settings)[0] ?? null,
        stone_shape_id:        matchIds(mainGemsShapes,   lookups.stone_shapes)[0]          ?? null,
        directions_id:         matchIds(mainGemsDirections, lookups.directions)[0]           ?? null,
        stone_size:  mainGemsSize,
        stone_count: parseInt(mainGemsCount) || 1,
      }];
    }

    const shankGemsPayload = shankGems.map(r => ({
      shank_stone_setting_id: r.settingId,
      stone_shape_id:         matchIds([r.shapes],     lookups.stone_shapes)[0]  ?? null,
      directions_id:          matchIds([r.directions], lookups.directions)[0]    ?? null,
      stone_size:  r.size || '',
      stone_count: parseInt(r.count, 10) || 1,
    }));

    const fd = new FormData();
    if (file3dm) fd.append('file_3dm', file3dm);
    if (fileStl) fd.append('file_stl', fileStl);
    fileMedia.forEach(f => fd.append('pictures', f));
    if (fingerSizeItem) fd.append('finger_size_id', String(fingerSizeItem.id));
    matchIds(ringTypeNames, lookups.ring_types).forEach(id => fd.append('ring_type_ids', String(id)));
    matchIds(headItems, lookups.head_settings).forEach(id => fd.append('head_setting_ids', String(id)));
    matchIds(applyLabelMap(selectedOptions[14] || [], SHANK_TYPE_LABEL_MAP), lookups.shank_types).forEach(id => fd.append('shank_type_ids', String(id)));
    matchIds(applyLabelMap(selectedProfileItems, PROFILE_LABEL_MAP), lookups.profiles).forEach(id => fd.append('profiles_ids', String(id)));
    matchIds(selectedHeadItems.filter(i => menuData[19].includes(i)), lookups.textures).forEach(id => fd.append('head_textures_ids', String(id)));
    matchIds(selectedShankItems.filter(i => menuData[19].includes(i)), lookups.textures).forEach(id => fd.append('shank_textures_ids', String(id)));
    if (activeJewelryType === 'band') {
      matchIds(selectedOptions[3] || [], lookups.bands).forEach(id => fd.append('bands_ids', String(id)));
    }
    fd.append('head_gems_json', JSON.stringify(headGems));
    fd.append('shank_gems_json', JSON.stringify(shankGemsPayload));
    fd.append('band_gems_json', '[]');

    setUploadStatus('uploading');
    setUploadError(null);
    try {
      await createRing(fd);
      setUploadStatus('success');
      setIsSaveModalOpen(false);
      resetAll();
      navigate('/jewelry-type');
    } catch (err: unknown) {
      setUploadStatus('error');
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    }
  }, [lookups, file3dm, fileStl, fileMedia, selectedSizeItems, activeJewelryType, selectedOptions,
      selectedDetailItems, mainGemsSettings, mainGemsShapes, mainGemsDirections, mainGemsSize, mainGemsCount,
      shankGems,
      selectedProfileItems, selectedHeadItems, selectedShankItems, resetAll]);
  // ─────────────────────────────────────────────────────────────────────────

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const highlightMatch = (text: string, query: string, prefixOnly = false) => {
    if (!query) return text;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(prefixOnly ? `^(${escapedQuery})` : `(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} className="text-[#00c4a7]">{part}</span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const filteredListItems = useMemo(() => {
    if (!searchQuery) return rings.map(r => r.id);
    const lowerQuery = searchQuery.toLowerCase();
    return rings.filter(ring => {
      if (String(ring.code).includes(searchQuery)) return true;
      const fields = [
        ...ring.ring_type_names,
        ...ring.head_setting_names,
        ...ring.shank_type_names,
        ...ring.profile_names,
        ring.finger_size || '',
      ];
      return fields.some(field => field.toLowerCase().includes(lowerQuery));
    }).map(r => r.id);
  }, [searchQuery, rings]);

  const filteredCustomers = useMemo(() => {
    return [...CUSTOMER_NAMES].sort((a, b) => a.localeCompare(b)).filter(name => 
      name.toLowerCase().startsWith(customerSearchQuery.toLowerCase())
    );
  }, [customerSearchQuery]);

  const handleNumericCountChange = (val: string, setter: (v: string) => void) => {
    const numericVal = val.replace(/[^0-9]/g, ''); if (numericVal === "") { setter(""); return; } const num = parseInt(numericVal); if (num <= 500) setter(numericVal);
  };

  // High precision high resolution scroll update with custom asymmetric gaps
  const syncCustomerScrollbar = useCallback((forceReady = false) => {
    if (customerListRef.current && customerTrackRef.current) {
      const list = customerListRef.current;
      const track = customerTrackRef.current;
      const { scrollTop, scrollHeight, clientHeight } = list;
      const trackHeight = track.getBoundingClientRect().height;
      
      if (trackHeight <= 32 || clientHeight === 0 || scrollHeight === 0) return;

      const newThumbHeight = Math.max(40, Math.min(trackHeight - 32, (clientHeight / scrollHeight) * (trackHeight - 32)));
      setCustomerThumbHeight(newThumbHeight);
      
      const scrollableHeight = scrollHeight - clientHeight;
      const availableTrack = trackHeight - 16 - 16 - newThumbHeight;
      
      if (scrollableHeight > 0) {
        const scrollPercent = scrollTop / scrollableHeight;
        setCustomerThumbTop(16 + (scrollPercent * Math.max(0, availableTrack)));
      } else {
        setCustomerThumbTop(16);
      }
      
      // Only show scrollbar if there is actual content to scroll
      if (forceReady) {
        setIsCustomerScrollbarReady(scrollableHeight > 0);
      }
    }
  }, []);

  const handleCustomerScroll = useCallback(() => {
    if (!isDraggingCustomerThumb) {
      syncCustomerScrollbar(true);
    }
  }, [isDraggingCustomerThumb, syncCustomerScrollbar]);

  // Restore user session on mount
  useEffect(() => {
    if (!getAuthToken()) return;
    me().then(data => setUserEmail(data.email)).catch(() => clearAuthToken());
  }, []);

  // Sync customer scrollbar when content or dropdown state changes
  useEffect(() => {
    if (isCustomerDropdownOpen) {
      setFocusedCustomerIndex(0);
    } else {
      setFocusedCustomerIndex(-1);
    }
  }, [isCustomerDropdownOpen, customerSearchQuery]);

  useLayoutEffect(() => {
    if (isCustomerDropdownOpen) {
      // Prepare values silently first
      syncCustomerScrollbar(false);
      
      // Delay showing to ensure layout is stable and prevent flickering/jumping
      const timer = setTimeout(() => {
        syncCustomerScrollbar(true);
      }, 64);
      
      return () => clearTimeout(timer);
    } else {
      setIsCustomerScrollbarReady(false);
    }
  }, [isCustomerDropdownOpen, filteredCustomers, syncCustomerScrollbar]);

  const handleCustomerThumbMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!customerTrackRef.current) return;
    
    const trackRect = customerTrackRef.current.getBoundingClientRect();
    const currentThumbTop = customerThumbTop;
    const clickY = e.clientY - trackRect.top;
    
    setCustomerDragOffset(clickY - currentThumbTop);
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCustomerThumb(true);
  }, [customerThumbTop]);

  const handleCustomerTrackMouseDown = useCallback((e: React.MouseEvent) => {
    if (!customerTrackRef.current || !customerListRef.current) return;
    const trackRect = customerTrackRef.current.getBoundingClientRect();
    const clickY = e.clientY - trackRect.top;
    const availableTrack = trackRect.height - 16 - 16 - customerThumbHeight;
    
    if (availableTrack <= 0) return;

    let targetThumbTop = clickY - (customerThumbHeight / 2);
    const constrainedY = Math.max(16, Math.min(targetThumbTop, availableTrack + 16));
    const scrollPercent = (constrainedY - 16) / availableTrack;
    
    const scrollableHeight = customerListRef.current.scrollHeight - customerListRef.current.clientHeight;
    customerListRef.current.scrollTop = scrollPercent * scrollableHeight;
    setCustomerThumbTop(constrainedY);
  }, [customerThumbHeight]);

  const handleScroll = useCallback(() => {
    if (scrollListRef.current && scrollTrackRef.current && !isDraggingThumb) {
      const { scrollTop, scrollHeight, clientHeight } = scrollListRef.current;
      const trackRect = scrollTrackRef.current.getBoundingClientRect();
      // Distance the top of the thumb can travel, respecting asymmetric gaps
      const availableTrack = trackRect.height - topPadding - bottomPadding - thumbHeight; 
      const scrollableHeight = scrollHeight - clientHeight;
      if (scrollableHeight > 0) {
        const scrollPercent = scrollTop / scrollableHeight;
        setThumbTop(topPadding + (scrollPercent * availableTrack));
      } else {
        setThumbTop(topPadding);
      }
    }
  }, [thumbHeight, topPadding, bottomPadding, isDraggingThumb]);

  const handleThumbMouseDown = useCallback((e: React.MouseEvent) => { 
    if (e.button !== 0) return; // Only primary button
    if (!scrollTrackRef.current) return;

    const trackRect = scrollTrackRef.current.getBoundingClientRect();
    const currentThumbTop = thumbTop;
    const clickY = e.clientY - trackRect.top;

    setDragOffset(clickY - currentThumbTop);
    e.preventDefault(); 
    e.stopPropagation();
    setIsDraggingThumb(true); 
  }, [thumbTop]);

  const handleTrackMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollTrackRef.current || !scrollListRef.current) return;
    const trackRect = scrollTrackRef.current.getBoundingClientRect();
    const clickY = e.clientY - trackRect.top;
    const trackHeight = trackRect.height;
    const availableTrack = trackHeight - topPadding - bottomPadding - thumbHeight;
    
    if (availableTrack <= 0) return;

    // Calculate target thumb top position (constrained)
    let targetThumbTop = clickY - (thumbHeight / 2);
    const constrainedY = Math.max(topPadding, Math.min(targetThumbTop, availableTrack + topPadding));
    const scrollPercent = (constrainedY - topPadding) / availableTrack;
    
    const scrollableHeight = scrollListRef.current.scrollHeight - scrollListRef.current.clientHeight;
    scrollListRef.current.scrollTop = scrollPercent * scrollableHeight;
    setThumbTop(constrainedY);
  }, [thumbHeight, topPadding, bottomPadding]);

  const downloadRingFilesZip = async (ring: Ring) => {
    const base = await getBaseUrl();
    const code = String(ring.code);
    const url3dm = `${base}/3dm/${code}.3dm`;
    const urlStl = `${base}/stl/${code}.stl`;
    try {
      const [res3dm, resStl] = await Promise.all([fetch(url3dm), fetch(urlStl)]);
      if (!res3dm.ok && !resStl.ok) { setUploadError(`Files not found for ring ${code}.`); return; }
      const zip = new JSZip();
      const folder = zip.folder(code)!;
      if (res3dm.ok) folder.file(`${code}.3dm`, await res3dm.blob());
      if (resStl.ok) folder.file(`${code}.stl`, await resStl.blob());
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
    fetchRingFiles(num)
      .then(({ images, stl }) => {
        setRingImages(images);
        setRingStl(stl);
        setActivePreviewTab('IMAGE');
        const img = images[0] || null;
        if (img) { setLibraryImages(prev => ({ ...prev, [num]: img })); }
        setSelectedImage(img ?? DEFAULT_PRODUCT_IMAGE);
      })
      .catch(() => { setRingImages([]); setRingStl(null); setSelectedImage(DEFAULT_PRODUCT_IMAGE); });
  }, []);

  const handlePrevListItem = useCallback(() => {
    if (filteredListItems.length === 0) return;
    if (selectedListItem === null) {
      handleListItemClick(filteredListItems[0]);
    } else {
      const currentIndex = filteredListItems.indexOf(selectedListItem);
      if (currentIndex > 0) {
        handleListItemClick(filteredListItems[currentIndex - 1]);
      }
    }
  }, [selectedListItem, handleListItemClick, filteredListItems]);

  const handleNextListItem = useCallback(() => {
    if (filteredListItems.length === 0) return;
    if (selectedListItem === null) {
      handleListItemClick(filteredListItems[0]);
    } else {
      const currentIndex = filteredListItems.indexOf(selectedListItem);
      if (currentIndex !== -1 && currentIndex < filteredListItems.length - 1) {
        handleListItemClick(filteredListItems[currentIndex + 1]);
      }
    }
  }, [selectedListItem, handleListItemClick, filteredListItems]);

  const handleScrollUp = () => {
    if (scrollListRef.current) {
      scrollListRef.current.scrollBy({ top: -100, behavior: 'smooth' });
    }
  };

  const handleScrollDown = () => {
    if (scrollListRef.current) {
      scrollListRef.current.scrollBy({ top: 100, behavior: 'smooth' });
    }
  };

  // Robust Scrollbar Dragging Management
  useEffect(() => {
    if (!isDraggingThumb) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (scrollTrackRef.current && scrollListRef.current) {
        const trackRect = scrollTrackRef.current.getBoundingClientRect();
        const availableTrack = trackRect.height - topPadding - bottomPadding - thumbHeight;
        
        if (availableTrack <= 0) return;

        // Calculate thumb top using the stored offset to prevent jumping
        let targetThumbTop = e.clientY - trackRect.top - dragOffset;
        
        // Constrain thumb position
        const constrainedY = Math.max(topPadding, Math.min(targetThumbTop, availableTrack + topPadding));
        const scrollPercent = (constrainedY - topPadding) / availableTrack;
        
        const { scrollHeight, clientHeight } = scrollListRef.current;
        const maxScroll = scrollHeight - clientHeight;
        
        if (maxScroll > 0) {
          scrollListRef.current.scrollTop = scrollPercent * maxScroll;
        }
        
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
  }, [isDraggingThumb, thumbHeight, topPadding, bottomPadding, dragOffset]);

  useEffect(() => {
    if (!isDraggingCustomerThumb) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (customerTrackRef.current && customerListRef.current) {
        const trackRect = customerTrackRef.current.getBoundingClientRect();
        const availableTrack = trackRect.height - 16 - 16 - customerThumbHeight;
        
        if (availableTrack <= 0) return;

        let targetThumbTop = e.clientY - trackRect.top - customerDragOffset;
        const constrainedY = Math.max(16, Math.min(targetThumbTop, availableTrack + 16));
        const scrollPercent = (constrainedY - 16) / availableTrack;
        
        const { scrollHeight, clientHeight } = customerListRef.current;
        const maxScroll = scrollHeight - clientHeight;
        
        if (maxScroll > 0) {
          customerListRef.current.scrollTop = scrollPercent * maxScroll;
        }
        
        setCustomerThumbTop(constrainedY);
      }
    };

    const handleMouseUp = () => setIsDraggingCustomerThumb(false);
    const preventDefault = (e: Event) => e.preventDefault();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseUp);
    document.addEventListener('dragstart', preventDefault);
    
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
  }, [isDraggingCustomerThumb, customerDragOffset, customerThumbHeight]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement; 
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (e.key === 'Tab') {
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') { 
        e.preventDefault(); 
        if (isFullScreenImage) setIsFullScreenImage(false);
        else if (showSummaryOverlay) setShowSummaryOverlay(false); 
        else if (isResetModalOpen) setIsResetModalOpen(false);
        else if (isInteractiveMode) setIsInteractiveMode(null);
        else setIsResetModalOpen(true); 
        return; 
      }
      if (isSaveModalOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); }
      if (e.key.toLowerCase() === 'd' && !isInputFocused) { e.preventDefault(); setIsDarkMode(prev => !prev); }
      if (e.key === 'Enter') { 
        if (isCustomerDropdownOpen && focusedCustomerIndex !== -1 && filteredCustomers[focusedCustomerIndex]) {
          e.preventDefault();
          setSelectedCustomer(filteredCustomers[focusedCustomerIndex]);
          setIsCustomerDropdownOpen(false);
          setCustomerSearchQuery("");
          return;
        }
        if (activeMenuIndex === 6) { e.preventDefault(); handleAcceptMainGems(); } 
        else if (activeMenuIndex === 9) { e.preventDefault(); handleAcceptSecondaryGems(); } 
      }
      
      if (isCustomerDropdownOpen) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedCustomerIndex(prev => prev > 0 ? prev - 1 : prev);
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedCustomerIndex(prev => prev < filteredCustomers.length - 1 ? prev + 1 : prev);
          return;
        }
      }

      if (!isInputFocused) {
        if (e.key === 'ArrowUp') { e.preventDefault(); handlePrevListItem(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); handleNextListItem(); }
        if (showSummaryOverlay) {
          if (e.key === 'ArrowLeft') { e.preventDefault(); if (overlayPage === 1) setOverlayPage(0); }
          if (e.key === 'ArrowRight') { e.preventDefault(); if (overlayPage === 0) setOverlayPage(1); }
        }
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (activeDropdown === 'details-size' && detailsDropdownRef.current && !detailsDropdownRef.current.contains(event.target as Node)) setActiveDropdown(null);
      if (showSuffixMenu && !detailsDropdownRef.current?.contains(event.target as Node)) setShowSuffixMenu(false);
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
        setCustomerSearchQuery("");
      }
    };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('mousedown', handleClickOutside);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('mousedown', handleClickOutside); };
  }, [handleUndo, handleRedo, isSaveModalOpen, isResetModalOpen, resetAll, activeDropdown, showSuffixMenu, activeMenuIndex, handleAcceptMainGems, handleAcceptSecondaryGems, showSummaryOverlay, isFullScreenImage, handlePrevListItem, handleNextListItem, overlayPage, isCustomerDropdownOpen, focusedCustomerIndex, filteredCustomers]);

  useEffect(() => {
    if (isCustomerDropdownOpen && focusedCustomerIndex !== -1 && customerListRef.current) {
      const focusedElement = customerListRef.current.querySelector(`[data-customer-index="${focusedCustomerIndex}"]`);
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedCustomerIndex, isCustomerDropdownOpen]);

  useEffect(() => {
    saveCurrentToStore();
  }, [saveCurrentToStore]);

  // ── Fetch lookups from backend once on mount ──────────────────────────────
  useEffect(() => {
    fetchLookups().then(setLookups).catch(console.error);
  }, []);

  // ── URL → state sync: keeps browser Back/Forward in sync with app state ───
  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '') {
      navigate('/jewelry-type', { replace: true });
      return;
    }
    const routeToState: Record<string, { idx: number; history: number[]; target?: number; type?: 'ring' | 'band' }> = {
      '/jewelry-type': { idx: 0, history: [0] },
      '/type':         { idx: 1, history: [0, 1] },
      '/rings':        { idx: 4, history: [0, 1, 4], target: 2, type: 'ring' },
      '/bands':        { idx: 4, history: [0, 1, 4], target: 3, type: 'band' },
    };
    const e = routeToState[location.pathname];
    if (!e) return;

    // For /rings and /bands, history.state carries the internal menu index.
    // An internal step (menuIndex !== 4) restores only activeMenuIndex so that
    // in-app state (menuHistory, etc.) is not clobbered during browser Back/Forward.
    const stateMenuIndex = (location.state as { menuIndex?: number } | null)?.menuIndex;
    const isInternalStep =
      (location.pathname === '/rings' || location.pathname === '/bands') &&
      stateMenuIndex !== undefined &&
      stateMenuIndex !== 4;

    setActiveMenuIndex(prev => {
      const desired = isInternalStep ? stateMenuIndex! : e.idx;
      return prev === desired ? prev : desired;
    });
    if (!isInternalStep) {
      setMenuHistory(prev => (prev.length === e.history.length && prev.every((v, i) => v === e.history[i])) ? prev : e.history);
      if (e.target !== undefined) setTargetCategoryIndex(prev => prev === e.target ? prev : e.target!);
      if (e.type   !== undefined) setActiveJewelryType  (prev => prev === e.type   ? prev : e.type!);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.state]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── Fetch ring list whenever lookups or active filters change ─────────────
  useEffect(() => {
    if (!lookups) return;
    const activeDetailItems  = selectedDetailItems.filter(i  => !activeMagnifiers[i]);
    const activeHeadItems    = selectedHeadItems.filter(i    => !activeMagnifiers[i]);
    const activeShankItems   = selectedShankItems.filter(i   => !activeMagnifiers[i]);
    const activeProfileItems = selectedProfileItems.filter(i => !activeMagnifiers[i]);
    searchRings({
      selectedDetailItems:  activeDetailItems,
      selectedHeadItems:    activeHeadItems,
      selectedShankItems:   activeShankItems,
      selectedProfileItems: activeProfileItems,
      headTextureItems:  activeHeadItems.filter(i => menuData[19].includes(i)),
      shankTextureItems: activeShankItems.filter(i => menuData[19].includes(i)),
      type_mode: activeJewelryType === 'ring' ? 'rings' : 'bands',
    }, lookups)
      .then(result => {
        setRings(result.items);
        if (result.items.length === 0) {
          setSelectedListItem(null);
          setSelectedImage(null);
          setRingImages([]);
          setRingStl(null);
        }
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookups, activeJewelryType, selectedDetailItems, selectedHeadItems, selectedShankItems, selectedProfileItems, activeMagnifiers]);
  // ─────────────────────────────────────────────────────────────────────────

  // Clear selection when jewelry type switches
  useEffect(() => {
    setSelectedListItem(null);
    setSelectedImage(null);
    setRingImages([]);
    setRingStl(null);
  }, [activeJewelryType]);

  // Auto-select first ring when list loads or becomes valid (mirrors old frontend)
  useEffect(() => {
    if (rings.length > 0 && (selectedListItem === null || !ringsMap[selectedListItem])) {
      handleListItemClick(rings[0].id);
    }
  }, [rings, selectedListItem, handleListItemClick, ringsMap]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedListItem !== null && scrollListRef.current) {
      const list = scrollListRef.current;
      const activeItem = list.querySelector(`[data-id="${selectedListItem}"]`);
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedListItem]);

  const toggleOption = (categoryIndex: number, option: string, isRemoval: boolean) => {
    if (!option) return;
    if (categoryIndex === 0 && option === "Rings") { navigateTo(1); return; }
    if (categoryIndex === 1) { 
      const newType = (option === "Rings") ? 'ring' : 'band'; 
      const newTarget = (option === "Rings") ? 2 : 3; 
      if (newType !== activeJewelryType) { setActiveJewelryType(newType); setTargetCategoryIndex(newTarget); loadFromStore(newType); } 
      else setTargetCategoryIndex(newTarget); 
      setSelectedOptions(prev => ({ ...prev, [1]: [option] }));
      navigateTo(4, newType);
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
      if (option === "PROFILE") { navigateTo(15); return; } 
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
    if (categoryIndex === 11 && !isRemoval) { gemBuilderType === 'main' ? setMainGemsSettings([option]) : (isShankSubflow ? setShankSecSettings([option]) : setHeadSecSettings([option])); navigateTo(gemBuilderType === 'main' ? 5 : gemBuilderHome); }
    else if (categoryIndex === 12 && !isRemoval) { gemBuilderType === 'main' ? setMainGemsShapes([option]) : (isShankSubflow ? setShankSecShapes([option]) : setHeadSecShapes([option])); navigateTo(gemBuilderType === 'main' ? 5 : gemBuilderHome); }
    else if (categoryIndex === 13 && !isRemoval) { gemBuilderType === 'main' ? setMainGemsDirections([option]) : (isShankSubflow ? setShankSecDirections([option]) : setHeadSecDirections([option])); navigateTo(gemBuilderType === 'main' ? 5 : gemBuilderHome); }
    else if (categoryIndex === 18 && !isRemoval) { isShankSubflow ? setShankSecSettings([option]) : setHeadSecSettings([option]); navigateTo(gemBuilderHome); }
    else if (categoryIndex === 14 && !isRemoval) { setSelectedShankItems(prev => prev.includes(option) ? prev : [...prev, option]); navigateTo(4); }
    else if (categoryIndex === 15 && !isRemoval) { setSelectedProfileItems(prev => prev.includes(option) ? prev : [...prev, option]); navigateTo(4); }
    else if (categoryIndex === 19) { 
      if (!isRemoval) {
        if (isShankSubflow) setSelectedShankItems(prev => prev.includes(option) ? prev : [...prev, option]); 
        else setSelectedHeadItems(prev => prev.includes(option) ? prev : [...prev, option]); 
        navigateTo(4); 
      }
    }
    else if ([2, 3].includes(categoryIndex) && !isRemoval) { setSelectedDetailItems(prev => prev.includes(option) ? prev : [...prev, option]); navigateTo(4); }
    else if ([5, 7, 8].includes(categoryIndex) && !isRemoval) { setSelectedHeadItems(prev => prev.includes(option) ? prev : [...prev, option]); navigateTo(4); }
    setSelectedOptions(prev => {
      const current = prev[categoryIndex] || []; 
      const exists = current.includes(option); 
      let newSelectedOptions = { ...prev };
      if (isRemoval) {
        newSelectedOptions[categoryIndex] = current.filter(item => item !== option);
        if ([2, 3].includes(categoryIndex)) setSelectedDetailItems(d => d.filter(item => item !== option));
        if ([5, 7, 8].includes(categoryIndex)) { setSelectedHeadItems(h => h.filter(item => item !== option)); }
        if (categoryIndex === 19) { 
          if (!isShankSubflow) setSelectedHeadItems(h => h.filter(item => item !== option)); 
          else setSelectedShankItems(s => s.filter(item => item !== option)); 
        }
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
    else if ([5, 7, 8].includes(categoryIndex)) { 
      setSelectedHeadItems(prev => prev.filter(i => i !== item)); 
      setSelectedOptions(prev => { const next = { ...prev }; Object.keys(next).forEach(k => { next[Number(k)] = next[Number(k)].filter(i => i !== item); }); return next; });
    }
    else if ([14, 16].includes(categoryIndex)) { 
      setSelectedShankItems(prev => prev.filter(i => i !== item)); 
      setSelectedOptions(prev => { const next = { ...prev }; Object.keys(next).forEach(k => { next[Number(k)] = next[Number(k)].filter(i => i !== item); }); return next; });
    }
    else if (categoryIndex === 19) { 
      if (isShankSubflow) {
        setSelectedShankItems(prev => prev.filter(i => i !== item));
      } else {
        setSelectedHeadItems(prev => prev.filter(i => i !== item));
      }
      setSelectedOptions(prev => { const next = { ...prev }; if (next[19]) next[19] = next[19].filter(i => i !== item); return next; });
    }
    else if (categoryIndex === 15) { setSelectedProfileItems(prev => prev.filter(i => i !== item)); setSelectedOptions(prev => { const next = { ...prev }; if (next[15]) next[15] = next[15].filter(i => i !== item); return next; }); }
    else toggleOption(categoryIndex, item, true);
  };

  const handleBaseSizeSelect = (val: string) => { setSizeInputBuffer(val); setActiveDropdown(null); setShowSuffixMenu(true); setSelectedSizeItems([val]); };
  const handleSuffixSelect = (suffix: string) => { const newVal = sizeInputBuffer + suffix; setSizeInputBuffer(newVal); setShowSuffixMenu(false); setSelectedSizeItems([newVal]); };
  const handleSizeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
    let val = e.target.value.replace(/[^0-9.]/g, ''); 
    const parts = val.split('.'); 
    if (parts.length > 2) return; 
    
    // Limit to 20
    if (val !== "" && parseFloat(val) > 20) {
      val = "20";
    }

    setSizeInputBuffer(val); 
    if (val === "") {
      setSelectedSizeItems([]);
      setShowSuffixMenu(false);
      return;
    }
    const isInteger = /^\d+$/.test(val); 
    if (isInteger && parseInt(val) <= 16) setShowSuffixMenu(true); 
    else setShowSuffixMenu(false); 
    if (validSizes.includes(val)) setSelectedSizeItems([val]);
  };
  const handleSizeInputBlur = () => { 
    if (sizeInputBuffer === "") {
      setSelectedSizeItems([]);
      return;
    }
    if (!validSizes.includes(sizeInputBuffer)) setSizeInputBuffer(selectedSizeItems[0] || "");
  };
  const handleSizeInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { setShowSuffixMenu(false); const val = e.currentTarget.value; if (validSizes.includes(val)) { setSelectedSizeItems([val]); e.currentTarget.blur(); } else { setSizeInputBuffer(selectedSizeItems[0] || ""); e.currentTarget.blur(); } } };

  const currentIdx = activeMenuIndex !== null ? activeMenuIndex : 0;
  const currentList = menuData[currentIdx] || [];
  const currentTitle = menuLabels[currentIdx] || "Jewelry Type";
  const isAnyModalOpen = isSaveModalOpen || isResetModalOpen || showSkipWarning; 
  const libModalRef = useRef<HTMLDivElement>(null);
  const [libShrinkLevel, setLibShrinkLevel] = useState(0);

  useLayoutEffect(() => {
    if (isAnyModalOpen && libModalRef.current) {
      const container = libModalRef.current;
      if (container.scrollHeight > container.clientHeight) {
        if (libShrinkLevel < 2) {
          setLibShrinkLevel(prev => prev + 1);
        }
      }
    }
  }, [isAnyModalOpen, selectedOptions, selectedHeadItems, selectedShankItems, libShrinkLevel]);

  useEffect(() => {
    if (!isAnyModalOpen) {
      setLibShrinkLevel(0);
    }
  }, [isAnyModalOpen]);

  const libTextSize = libShrinkLevel === 0 ? 'text-base' : libShrinkLevel === 1 ? 'text-sm' : 'text-xs';
  const libItemHeight = libShrinkLevel === 0 ? 'h-7' : libShrinkLevel === 1 ? 'h-6' : 'h-5';
  const libSectionGap = libShrinkLevel === 0 ? 'gap-y-16' : libShrinkLevel === 1 ? 'gap-y-10' : 'gap-y-4';
  const libTitleSize = libShrinkLevel === 0 ? 'text-2xl' : libShrinkLevel === 1 ? 'text-xl' : 'text-lg';
  const libLabelSize = libShrinkLevel === 0 ? 'text-base' : libShrinkLevel === 1 ? 'text-sm' : 'text-xs';
  const isBand = targetCategoryIndex === 3;

  const isIncompleteCode = (code: string) => {
    if (!code.includes('_')) return false;
    const parts = code.split('_');
    const placeholders = ["SET", "SHP", "DIR", "SIZ", "COU"];
    const hasPlaceholders = parts.some(p => placeholders.includes(p));
    const hasRealValues = parts.some(p => p !== "M" && p !== "SEC" && !placeholders.includes(p));
    return hasPlaceholders && hasRealValues;
  };

  const renderBuilder = (title: string, type: 'main' | 'secondary', settings: string[], setSettings: (v: any) => void, shapes: string[], setShapes: (v: any) => void, directions: string[], setDirections: (v: any) => void, size: string, setSize: (v: string) => void, count: string, setCount: (v: string) => void, onAccept: () => void, settingsIndex: number) => {
    const placeholders = ["SET", "SHP", "DIR", "SIZ", "COU"];
    return (
      <div className="flex flex-col items-center justify-start w-full max-full pt-0 h-full min-h-[calc(100vh-160px)]">
        <h2 className={`text-2xl font-black tracking-[0.15em] text-center uppercase mb-4 -mt-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>{title}</h2>
        <div className="flex justify-center w-full gap-8 mt-12">
          <div className="flex flex-col items-center">
            <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SETTINGS</span>
            <div className="flex flex-col items-center gap-y-3 mb-1 min-h-[24px]">{settings.map((item, idx) => ( <div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${placeholders.includes(item) ? 'text-[#ef4444]' : (isDarkMode ? 'text-white' : 'text-black')}`}>{item}</span></div> ))}</div>
            <div onClick={() => { gemPickerSetterRef.current = setSettings; setHeadGemPickerField('settings'); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors rounded-full ${isDarkMode ? 'bg-[#121c2e] hover:bg-[#1a263d]' : 'bg-[#f8fafc] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
          </div>
          <div className="flex flex-col items-center">
            <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SHAPE</span>
            <div className="flex flex-col items-center gap-y-3 mb-1 min-h-[24px]">{shapes.map((item, idx) => ( <div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${placeholders.includes(item) ? 'text-[#ef4444]' : (isDarkMode ? 'text-white' : 'text-black')}`}>{item}</span></div> ))}</div>
            <div onClick={() => { gemPickerSetterRef.current = setShapes; setHeadGemPickerField('shapes'); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors rounded-full ${isDarkMode ? 'bg-[#121c2e] hover:bg-[#1a263d]' : 'bg-[#f8fafc] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
          </div>
          <div className="flex flex-col items-center">
            <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>DIRECTION</span>
            <div className="flex flex-col items-center gap-y-3 mb-1 min-h-[24px]">{directions.map((item, idx) => ( <div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${placeholders.includes(item) ? 'text-[#ef4444]' : (isDarkMode ? 'text-white' : 'text-black')}`}>{item}</span></div> ))}</div>
            <div onClick={() => { gemPickerSetterRef.current = setDirections; setHeadGemPickerField('directions'); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors rounded-full ${isDarkMode ? 'bg-[#121c2e] hover:bg-[#1a263d]' : 'bg-[#f8fafc] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
          </div>
          <div className="flex flex-col items-center">
            <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SIZE</span>
            <div className="flex flex-col items-center h-6 mb-1" />
            <div className={`w-72 h-14 flex items-center justify-center rounded-full ${isDarkMode ? 'bg-[#121c2e]' : 'bg-[#f8fafc]'}`}>
              <input 
                type="text" 
                value={size}
                onChange={(e) => { const val = e.target.value.replace(/[^0-9xX.]/g, ''); setSize(val); }}
                placeholder="0x0x0"
                className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center placeholder-gray-600 ${isDarkMode ? 'text-white' : 'text-black'}`}
              />
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>COUNT</span>
            <div className="flex flex-col items-center h-6 mb-1" />
            <div className={`w-72 h-14 flex items-center justify-center rounded-full ${isDarkMode ? 'bg-[#121c2e]' : 'bg-[#f8fafc]'}`}>
              <input 
                type="text" 
                value={count}
                onChange={(e) => handleNumericCountChange(e.target.value, setCount)}
                placeholder="1"
                className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center placeholder-gray-600 ${isDarkMode ? 'text-white' : 'text-black'}`} 
              />
            </div>
          </div>
        </div>
        <div className="absolute bottom-12 right-16"><button onClick={onAccept} className={`text-5xl font-black uppercase tracking-[0.2em] transition-opacity hover:opacity-70 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>ACCEPT</button></div>
      </div>
    );
  };

  const renderCurrentView = () => {
    const isMainGemsIncomplete = selectedHeadItems.some(isIncompleteCode);
    const isShankGemsIncomplete = selectedShankItems.some(isIncompleteCode);
    const isTypeComplete = selectedDetailItems.some(item => menuData[targetCategoryIndex].includes(item));
    const isHeadTypeSelected = selectedHeadItems.some(item => menuData[7].includes(item) || menuData[8].includes(item));
    const isMineGemSelected = selectedHeadItems.some(item => item.startsWith("M_"));
    const isHeadComplete = isHeadTypeSelected && isMineGemSelected;
    const isShankTypeSelected = selectedShankItems.some(item => menuData[14].includes(item));
    const isShankProfileSelected = selectedProfileItems.length > 0;
    const isShankComplete = isShankTypeSelected && isShankProfileSelected;
    const isSizeComplete = selectedSizeItems.length > 0;

    if (location.pathname === '/login') {
      return (
        <div className="flex-1 flex items-center justify-center w-full">
          <div className={`w-full max-w-sm p-8 border ${isDarkMode ? 'border-[#1e293b] bg-[#1f2937]' : 'border-[#e2e8f0] bg-[#f8fafc]'}`}>
            <div className="flex items-center mb-6">
              <h2 className={`text-2xl font-black uppercase tracking-widest flex-1 text-center ${isDarkMode ? 'text-white' : 'text-black'}`}>Login</h2>
              <button onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/jewelry-type'); }} className={`text-xs font-black opacity-60 hover:opacity-100 transition-opacity ml-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>✕</button>
            </div>
            <div className="flex flex-col gap-3">
              <input type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className={`px-4 py-2 border text-sm font-bold bg-transparent outline-none ${isDarkMode ? 'border-[#374151] text-white placeholder-gray-500' : 'border-[#cbd5e1] text-black placeholder-gray-400'}`} />
              <input type="password" placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={async e => { if (e.key === 'Enter') { setLoginError(null); setLoginLoading(true); try { await login(loginEmail, loginPassword); const d = await me(); setUserEmail(d.email); navigate(-1); } catch (err: any) { setLoginError(err.message || 'Login failed'); } finally { setLoginLoading(false); } } }} className={`px-4 py-2 border text-sm font-bold bg-transparent outline-none ${isDarkMode ? 'border-[#374151] text-white placeholder-gray-500' : 'border-[#cbd5e1] text-black placeholder-gray-400'}`} />
              {loginError && <p className="text-red-500 text-xs font-bold">{loginError}</p>}
              <button disabled={loginLoading} onClick={async () => { setLoginError(null); setLoginLoading(true); try { await login(loginEmail, loginPassword); const d = await me(); setUserEmail(d.email); navigate(-1); } catch (err: any) { setLoginError(err.message || 'Login failed'); } finally { setLoginLoading(false); } }} className="px-4 py-2 font-black uppercase tracking-widest text-sm bg-green-700 text-white hover:bg-green-800 disabled:opacity-50">
                {loginLoading ? '...' : 'Login'}
              </button>
              <button disabled className={`px-4 py-2 font-black uppercase tracking-widest text-sm border opacity-30 cursor-not-allowed ${isDarkMode ? 'border-[#374151] text-gray-400' : 'border-[#cbd5e1] text-gray-600'}`}>Register</button>
            </div>
          </div>
        </div>
      );
    }

    if (currentIdx === 4) {
      const _selectedRing = (showSummaryOverlay && selectedListItem) ? ringsMap[selectedListItem] : null;
      const currentDbItem = _selectedRing ? {
        type:    _selectedRing.ring_type_names,
        head:    _selectedRing.head_setting_names,
        shank:   _selectedRing.shank_type_names,
        profile: _selectedRing.profile_names,
        size:    _selectedRing.finger_size || '',
      } : null;
      
      return (
        <div className="flex flex-col items-center justify-start w-full max-full pt-0 h-full min-h-[calc(100vh-160px)]">
          <h2 className={`text-2xl font-black tracking-[0.15em] text-center uppercase mb-4 -mt-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>{isBand ? 'Band' : 'Ring'}</h2>
          
          <div className="flex justify-start items-center gap-8 mb-10 w-[1346px] mx-auto">
            <div className="relative w-72" ref={customerDropdownRef}>
              <div className={`w-full h-14 flex items-center justify-center border rounded-full ${
                isDarkMode ? 'bg-[#121c2e] border-[#1e293b]' : 'bg-[#f8fafc] border-[#e2e8f0]'
              } shadow-inner`}>
                <div 
                  onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  className={`w-[calc(100%-4px)] h-[calc(100%-4px)] flex items-center justify-center px-6 transition-all duration-300 border rounded-full relative cursor-pointer ${
                    selectedCustomer 
                      ? 'border-[#00c4a7] shadow-[0_0_12px_rgba(0,196,167,0.5)]' 
                      : 'border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                  } ${isDarkMode ? 'bg-[#121c2e]' : 'bg-[#f8fafc]'} font-bold ${selectedCustomer ? 'text-[#00c4a7]' : 'text-[#ef4444]'}`}
                >
                  <span className="text-[24px] leading-none truncate">
                    {selectedCustomer || "Select Customer"}
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsCustomerDropdownOpen(!isCustomerDropdownOpen); }}
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center"
                  >
                    <ChevronDown size={24} strokeWidth={3} className={`transition-transform duration-200 ${isCustomerDropdownOpen ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  </button>
                </div>
              </div>
              {isCustomerDropdownOpen && (
                <div className={`absolute top-full mt-6 left-0 right-0 z-[9999] shadow-2xl flex flex-col ${
                  isDarkMode ? 'bg-[#121c2e]' : 'bg-[#f8fafc]'
                }`}>
                  <div className="flex h-[480px]">
                    <div 
                      ref={customerListRef} 
                      onScroll={handleCustomerScroll} 
                      onMouseMove={() => { if (focusedCustomerIndex !== -1) setFocusedCustomerIndex(-1); }}
                      className={`flex-1 overflow-y-auto hide-scrollbar ${isDarkMode ? 'bg-[#121c2e]' : 'bg-white'}`}
                    >
                      {filteredCustomers.map((name, index) => (
                        <div 
                          key={name} 
                          data-customer-index={index}
                          onClick={() => { setSelectedCustomer(name); setIsCustomerDropdownOpen(false); setCustomerSearchQuery(""); }}
                          className={`px-4 py-2 text-lg font-bold cursor-pointer ${
                            focusedCustomerIndex === index 
                              ? (isDarkMode ? 'bg-[#1f2937] text-white' : 'bg-[#f1f5f9] text-black')
                              : (isDarkMode ? 'text-white hover:bg-[#1f2937]' : 'text-black hover:bg-[#f1f5f9]')
                          }`}
                        >
                          {highlightMatch(name, customerSearchQuery, true)}
                        </div>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <div className={`px-4 py-2 text-sm italic ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No customers found</div>
                      )}
                    </div>
                    <div 
                      ref={customerTrackRef} 
                      onMouseDown={handleCustomerTrackMouseDown}
                      className={`w-6 flex flex-col items-center shrink-0 ${isDarkMode ? 'bg-[#0b0f19]' : 'bg-[#f1f5f9]'} relative cursor-pointer`}
                    >
                      <button 
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); if (customerListRef.current) customerListRef.current.scrollBy({ top: -40, behavior: 'smooth' }); }}
                        className={`absolute top-0.5 z-20 hover:opacity-70 transition-opacity ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                      >
                        <ChevronUp size={18} strokeWidth={3} />
                      </button>

                      <div 
                        onMouseDown={handleCustomerThumbMouseDown} 
                        style={{ 
                          top: `${customerThumbTop}px`, 
                          height: `${customerThumbHeight}px`,
                          position: 'absolute',
                          transition: (isDraggingCustomerThumb || !isCustomerScrollbarReady) ? 'none' : 'top 0.2s ease-out',
                          opacity: isCustomerScrollbarReady ? 1 : 0
                        }} 
                        className={`w-3.5 rounded-full transform z-10 transition-opacity duration-200 ${
                          isDraggingCustomerThumb 
                            ? 'bg-[#00c4a7] scale-x-110 shadow-[0_0_10px_rgba(0,196,167,0.4)]' 
                            : (isDarkMode ? 'bg-gray-600 hover:bg-[#00c4a7] hover:scale-x-110' : 'bg-gray-300 hover:bg-[#00c4a7] hover:scale-x-110')
                        } ${isDraggingCustomerThumb ? 'cursor-grabbing' : 'cursor-grab'}`}
                      >
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 pointer-events-none">
                          <div className={`w-1 h-0.5 rounded-full transition-colors ${isDraggingCustomerThumb ? 'bg-white' : (isDarkMode ? 'bg-gray-400' : 'bg-gray-500')}`} />
                          <div className={`w-1 h-0.5 rounded-full transition-colors ${isDraggingCustomerThumb ? 'bg-white' : (isDarkMode ? 'bg-gray-400' : 'bg-gray-500')}`} />
                        </div>
                      </div>

                      <button 
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); if (customerListRef.current) customerListRef.current.scrollBy({ top: 40, behavior: 'smooth' }); }}
                        className={`absolute bottom-0.5 z-20 hover:opacity-70 transition-opacity ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                      >
                        <ChevronDown size={18} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                  <div className={`p-2 border-t ${isDarkMode ? 'border-[#1f2937] bg-[#0d1421]' : 'border-[#f1f5f9] bg-[#f8fafc]'}`}>
                    <div className="relative flex items-center">
                      <div className="absolute left-3 z-10 cursor-pointer" onClick={() => setHasCustomerSearchBeenClicked(true)}>
                        <div className="relative flex items-center justify-center">
                          <Search size={16} className={`${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                        </div>
                      </div>
                      <input 
                        type="text"
                        value={customerSearchQuery}
                        onChange={(e) => { setCustomerSearchQuery(e.target.value); setHasCustomerSearchBeenClicked(true); }}
                        onFocus={() => { setIsCustomerSearchFocused(true); setHasCustomerSearchBeenClicked(true); }}
                        onBlur={() => setIsCustomerSearchFocused(false)}
                        placeholder="Search customer..."
                        className={`w-full pl-10 pr-4 py-2 text-sm font-bold outline-none rounded-sm transition-all duration-300 ${
                          isDarkMode ? 'bg-[#121c2e] text-white placeholder-gray-600' : 'bg-[#f8fafc] text-black placeholder-gray-400'
                        } border ${
                          (customerSearchQuery && filteredCustomers.length === 0)
                            ? 'border-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                            : (customerSearchQuery || isCustomerSearchFocused) 
                              ? 'border-[#00c4a7] shadow-[0_0_8px_rgba(0,196,167,0.4)]' 
                              : (isDarkMode ? 'border-[#374151]' : 'border-[#cbd5e1]')
                        }`}
                        onClick={(e) => { e.stopPropagation(); setHasCustomerSearchBeenClicked(true); }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={`w-[450px] h-14 flex items-center justify-center border rounded-full ${
              isDarkMode ? 'bg-[#121c2e] border-[#1e293b]' : 'bg-[#f8fafc] border-[#e2e8f0]'
            } shadow-inner`}>
              <div className={`w-[calc(100%-4px)] h-[calc(100%-4px)] px-6 flex items-center rounded-full border transition-all duration-300 ${
                jobName 
                  ? 'border-[#00c4a7] shadow-[0_0_12px_rgba(0,196,167,0.5)]' 
                  : 'border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.5)]'
              } ${isDarkMode ? 'bg-[#121c2e]' : 'bg-[#f8fafc]'}`}>
                <input 
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder={jobPlaceholder}
                  onFocus={() => setJobPlaceholder("")}
                  onBlur={() => setJobPlaceholder("Job Name")}
                  className={`w-full bg-transparent font-bold text-[24px] text-center outline-none ${jobName ? 'text-[#00c4a7]' : 'text-[#ef4444]'} placeholder:text-[#ef4444]`}
                />
              </div>
            </div>

            {['3DM', 'STL', 'MEDIA'].map((type) => {
              const isUploaded = uploadedAssets[type];
              const textColor = isUploaded ? 'text-[#00c4a7]' : 'text-[#ef4444]';
              return (
                <div key={type} className={`w-40 h-14 flex items-center justify-center border rounded-full ${
                  isDarkMode ? 'bg-[#121c2e] border-[#1e293b]' : 'bg-[#f8fafc] border-[#e2e8f0]'
                } shadow-inner`}>
                  <button 
                    onClick={(e) => {
                      if (isUploaded) {
                        e.stopPropagation();
                        setUploadedAssets(prev => {
                          const next = { ...prev };
                          delete next[type];
                          return next;
                        });
                        if (type === '3DM') { setFile3dm(null); if (fileInput3DMRef.current) fileInput3DMRef.current.value = ''; }
                        if (type === 'STL') { setFileStl(null); if (fileInputSTLRef.current) fileInputSTLRef.current.value = ''; }
                        if (type === 'MEDIA') { setFileMedia([]); if (fileInputMediaRef.current) fileInputMediaRef.current.value = ''; }
                      } else {
                        if (type === '3DM') fileInput3DMRef.current?.click();
                        if (type === 'STL') fileInputSTLRef.current?.click();
                        if (type === 'MEDIA') fileInputMediaRef.current?.click();
                      }
                    }}
                    className={`w-[calc(100%-4px)] h-[calc(100%-4px)] group relative flex items-center justify-center transition-all duration-300 border rounded-full ${
                      isUploaded 
                        ? 'border-[#00c4a7] shadow-[0_0_12px_rgba(0,196,167,0.5)]' 
                        : 'border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                    } ${isDarkMode ? 'bg-[#121c2e]' : 'bg-[#f8fafc]'} ${textColor} text-2xl font-black uppercase tracking-[0.15em]`}
                  >
                    <span className="group-hover:opacity-20 transition-opacity duration-200">{type}</span>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {isUploaded ? (
                        <div className="w-12 h-12 bg-[#ef4444] flex items-center justify-center rounded-sm shadow-md">
                          <Trash2 size={28} className={isDarkMode ? 'text-[#111827]' : 'text-white'} strokeWidth={2.5} />
                        </div>
                      ) : (
                        <Plus size={48} className={isDarkMode ? 'text-white' : 'text-black'} strokeWidth={3} />
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-start w-[1346px] mx-auto mb-4">
            <div className="flex flex-col items-center w-[350px]">
              <div className={`w-[350px] h-16 flex items-center justify-center border rounded-full ${
                isDarkMode ? 'bg-[#121c2e] border-[#1e293b]' : 'bg-[#f8fafc] border-[#e2e8f0]'
              } shadow-inner mb-3`}>
                <button 
                  onClick={() => { setTypePickerQuery(''); setHeadGemPickerField(activeJewelryType === 'ring' ? 'ring_type' : 'band_type'); setTimeout(() => typePickerInputRef.current?.focus(), 50); }}
                  className={`w-[calc(100%-4px)] h-[calc(100%-4px)] group relative flex items-center justify-center transition-all duration-300 border rounded-full ${
                    isTypeComplete 
                      ? 'border-[#00c4a7] shadow-[0_0_12px_rgba(0,196,167,0.5)] text-[#00c4a7]' 
                      : 'border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.5)] text-[#ef4444]'
                  } ${isDarkMode ? 'bg-[#121c2e]' : 'bg-[#f8fafc]'}`}
                >
                  <span className="text-3xl font-black uppercase tracking-[0.15em] group-hover:opacity-20 transition-opacity duration-200">TYPE</span>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Plus size={48} className={isDarkMode ? 'text-white' : 'text-black'} strokeWidth={3} />
                  </div>
                </button>
              </div>
              <div className="flex flex-col items-start gap-y-3 w-[350px]">{selectedDetailItems.filter(item => menuData[targetCategoryIndex].includes(item)).map((item, idx) => ( <div key={idx} className="flex items-center h-6 cursor-default w-full"><div className="relative flex-1 flex items-center group"><span className={`text-2xl font-black italic uppercase tracking-wider transition-opacity duration-200 ${isInteractiveMode !== item ? 'group-hover:opacity-20' : ''} ${isDarkMode ? 'text-white' : 'text-black'}`}>{item.includes('_') ? renderInteractiveCode(item, false) : item}</span><div className={`absolute inset-0 opacity-0 ${isInteractiveMode !== item ? 'group-hover:opacity-100' : ''} transition-opacity duration-200 pointer-events-none`}><div className={`absolute left-0 right-6 top-0 bottom-0 ${isInteractiveMode !== item ? 'pointer-events-auto' : 'pointer-events-none'}`}><button onContextMenu={(e) => { if (item.includes('_')) { e.preventDefault(); setIsInteractiveMode(isInteractiveMode === item ? null : item); } }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditItem(targetCategoryIndex, item); }} className="w-full h-full flex items-center justify-center hover:scale-110 transition-transform"><Pencil size={18} className={isInteractiveMode === item ? 'text-[#00c4a7]' : (isDarkMode ? 'text-white' : 'text-black')} fill="currentColor" /></button></div><div className={`absolute right-0 top-1/2 -translate-y-1/2 ${isInteractiveMode !== item ? 'pointer-events-auto' : 'pointer-events-none'}`}><button onClick={(e) => { e.stopPropagation(); toggleOption(targetCategoryIndex, item, true); }} className="w-6 h-6 bg-[#ef4444] flex items-center justify-center rounded-sm shadow-md hover:bg-red-600 transition-colors"><Trash2 size={16} className={isDarkMode ? 'text-[#111827]' : 'text-white'} strokeWidth={2.5} /></button></div></div></div><div className="flex items-center ml-1"><svg onClick={(e) => { e.stopPropagation(); setActiveMagnifiers(prev => ({...prev, [item]: !prev[item]})); }} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="cursor-pointer -ml-1"><circle cx="14" cy="10" r="6" stroke="#9CA3AF" strokeWidth="3.5"/>{!activeMagnifiers[item] && <circle cx="14" cy="10" r="3" fill="#FFFF00"/>}<line x1="9.5" y1="14.5" x2="4" y2="20" stroke="#9CA3AF" strokeWidth="3.5" strokeLinecap="round"/></svg>{isInteractiveMode === item && <button onClick={(e) => { e.stopPropagation(); setIsInteractiveMode(null); }} className="ml-1 flex items-center justify-center hover:opacity-70 transition-opacity"><X size={14} className={isDarkMode ? 'text-white' : 'text-black'} strokeWidth={3} /></button>}</div></div> ))}</div>
            </div>
            {!isBand && (
              <div className="flex flex-col items-center ml-[48px] w-[350px]">
                <div className={`w-[350px] h-16 flex items-center justify-center border rounded-full ${
                  isDarkMode ? 'bg-[#121c2e] border-[#1e293b]' : 'bg-[#f8fafc] border-[#e2e8f0]'
                } shadow-inner mb-3`}>
                  <button 
                    onClick={() => { setGemBuilderType('main'); setEditingItemCode(null); navigateTo(5); }}
                    className={`w-[calc(100%-4px)] h-[calc(100%-4px)] group relative flex items-center justify-center transition-all duration-300 border rounded-full ${
                      (isHeadComplete && !isMainGemsIncomplete) 
                        ? 'border-[#00c4a7] shadow-[0_0_12px_rgba(0,196,167,0.5)] text-[#00c4a7]' 
                        : 'border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.5)] text-[#ef4444]'
                    } ${isDarkMode ? 'bg-[#121c2e]' : 'bg-[#f8fafc]'}`}
                  >
                    <span className="text-3xl font-black uppercase tracking-[0.15em] group-hover:opacity-20 transition-opacity duration-200">HEAD</span>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Plus size={48} className={isDarkMode ? 'text-white' : 'text-black'} strokeWidth={3} />
                    </div>
                  </button>
                </div>
                <div className="flex flex-col items-start gap-y-3 w-[350px]">{getOrderedHeadItems(selectedHeadItems).map((item, idx) => ( <div key={idx} className="flex items-center h-6 cursor-default w-full"><div className="relative flex-1 flex items-center group"><span className={`text-2xl font-black italic uppercase tracking-wider transition-opacity duration-200 ${isInteractiveMode !== item ? 'group-hover:opacity-20' : ''} ${isDarkMode ? 'text-white' : 'text-black'}`}>{item.includes('_') ? renderInteractiveCode(item, false) : (item.startsWith("SEC_") ? item.replace("SEC_", "") : item)}</span><div className={`absolute inset-0 opacity-0 ${isInteractiveMode !== item ? 'group-hover:opacity-100' : ''} transition-opacity duration-200 pointer-events-none`}><div className={`absolute left-0 right-6 top-0 bottom-0 ${isInteractiveMode !== item ? 'pointer-events-auto' : 'pointer-events-none'}`}><button onContextMenu={(e) => { if (item.includes('_')) { e.preventDefault(); setIsInteractiveMode(isInteractiveMode === item ? null : item); } }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditItem(5, item); }} className="w-full h-full flex items-center justify-center hover:scale-110 transition-transform"><Pencil size={18} className={isInteractiveMode === item ? 'text-[#00c4a7]' : (isDarkMode ? 'text-white' : 'text-black')} fill="currentColor" /></button></div><div className={`absolute right-0 top-1/2 -translate-y-1/2 ${isInteractiveMode !== item ? 'pointer-events-auto' : 'pointer-events-none'}`}><button onClick={(e) => { e.stopPropagation(); removeItemGlobally(5, item); }} className="w-6 h-6 bg-[#ef4444] flex items-center justify-center rounded-sm shadow-md hover:bg-red-600 transition-colors"><Trash2 size={16} className={isDarkMode ? 'text-[#111827]' : 'text-white'} strokeWidth={2.5} /></button></div></div></div><div className="flex items-center ml-1"><svg onClick={(e) => { e.stopPropagation(); setActiveMagnifiers(prev => ({...prev, [item]: !prev[item]})); }} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="cursor-pointer -ml-1"><circle cx="14" cy="10" r="6" stroke="#9CA3AF" strokeWidth="3.5"/>{!activeMagnifiers[item] && <circle cx="14" cy="10" r="3" fill="#FFFF00"/>}<line x1="9.5" y1="14.5" x2="4" y2="20" stroke="#9CA3AF" strokeWidth="3.5" strokeLinecap="round"/></svg>{isInteractiveMode === item && <button onClick={(e) => { e.stopPropagation(); setIsInteractiveMode(null); }} className="ml-1 flex items-center justify-center hover:opacity-70 transition-opacity"><X size={14} className={isDarkMode ? 'text-white' : 'text-black'} strokeWidth={3} /></button>}</div></div> ))}</div>
              </div>
            )}
            <div className={`flex flex-col items-center ${isBand ? 'ml-[251px]' : 'ml-[48px]'} w-[350px]`}>
              <div className={`w-[350px] h-16 flex items-center justify-center border rounded-full ${
                isDarkMode ? 'bg-[#121c2e] border-[#1e293b]' : 'bg-[#f8fafc] border-[#e2e8f0]'
              } shadow-inner mb-3`}>
                <button 
                  onClick={() => { setGemBuilderType('main'); setEditingItemCode(null); navigateTo(16); }}
                  className={`w-[calc(100%-4px)] h-[calc(100%-4px)] group relative flex items-center justify-center transition-all duration-300 border rounded-full ${
                    (isShankComplete && !isShankGemsIncomplete) 
                      ? 'border-[#00c4a7] shadow-[0_0_12px_rgba(0,196,167,0.5)] text-[#00c4a7]' 
                      : 'border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.5)] text-[#ef4444]'
                  } ${isDarkMode ? 'bg-[#121c2e]' : 'bg-[#f8fafc]'}`}
                >
                  <span className="text-3xl font-black uppercase tracking-[0.15em] group-hover:opacity-20 transition-opacity duration-200">SHANK</span>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Plus size={48} className={isDarkMode ? 'text-white' : 'text-black'} strokeWidth={3} />
                  </div>
                </button>
              </div>
              <div className="flex flex-col items-start gap-y-3 w-[350px]">
                {getOrderedShankItems(selectedShankItems, selectedProfileItems).map(({item, cat}, idx) => ( <div key={`shank-${idx}`} className="flex items-center h-6 cursor-default w-full"><div className="relative flex-1 flex items-center group"><span className={`text-2xl font-black italic uppercase tracking-wider transition-opacity duration-200 ${isInteractiveMode !== item ? 'group-hover:opacity-20' : ''} ${isDarkMode ? 'text-white' : 'text-black'}`}>{item.includes('_') ? renderInteractiveCode(item, false) : (item.startsWith("SEC_") ? item.replace("SEC_", "") : item)}</span><div className={`absolute inset-0 opacity-0 ${isInteractiveMode !== item ? 'group-hover:opacity-100' : ''} transition-opacity duration-200 pointer-events-none`}><div className={`absolute left-0 right-6 top-0 bottom-0 ${isInteractiveMode !== item ? 'pointer-events-auto' : 'pointer-events-none'}`}><button onContextMenu={(e) => { if (item.includes('_')) { e.preventDefault(); setIsInteractiveMode(isInteractiveMode === item ? null : item); } }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditItem(cat, item); }} className="w-full h-full flex items-center justify-center hover:scale-110 transition-transform"><Pencil size={18} className={isInteractiveMode === item ? 'text-[#00c4a7]' : (isDarkMode ? 'text-white' : 'text-black')} fill="currentColor" /></button></div><div className={`absolute right-0 top-1/2 -translate-y-1/2 ${isInteractiveMode !== item ? 'pointer-events-auto' : 'pointer-events-none'}`}><button onClick={(e) => { e.stopPropagation(); removeItemGlobally(cat, item); }} className="w-6 h-6 bg-[#ef4444] flex items-center justify-center rounded-sm shadow-md hover:bg-red-600 transition-colors"><Trash2 size={16} className={isDarkMode ? 'text-[#111827]' : 'text-white'} strokeWidth={2.5} /></button></div></div></div><div className="flex items-center ml-1"><svg onClick={(e) => { e.stopPropagation(); setActiveMagnifiers(prev => ({...prev, [item]: !prev[item]})); }} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="cursor-pointer -ml-1"><circle cx="14" cy="10" r="6" stroke="#9CA3AF" strokeWidth="3.5"/>{!activeMagnifiers[item] && <circle cx="14" cy="10" r="3" fill="#FFFF00"/>}<line x1="9.5" y1="14.5" x2="4" y2="20" stroke="#9CA3AF" strokeWidth="3.5" strokeLinecap="round"/></svg>{isInteractiveMode === item && <button onClick={(e) => { e.stopPropagation(); setIsInteractiveMode(null); }} className="ml-1 flex items-center justify-center hover:opacity-70 transition-opacity"><X size={14} className={isDarkMode ? 'text-white' : 'text-black'} strokeWidth={3} /></button>}</div></div> ))}
              </div>
            </div>
            <div className={`${isBand ? 'ml-[251px]' : 'ml-[48px]'} flex flex-col items-center`}>
              <div className="relative mb-3" ref={detailsDropdownRef}>
                <div className={`w-36 h-16 flex items-center justify-center border rounded-full ${
                  isDarkMode ? 'bg-[#121c2e] border-[#1e293b]' : 'bg-[#f8fafc] border-[#e2e8f0]'
                } shadow-inner`}>
                  <div className={`w-[calc(100%-4px)] h-[calc(100%-4px)] flex items-center justify-center relative transition-all duration-300 border rounded-full ${
                    isSizeComplete 
                      ? 'border-[#00c4a7] shadow-[0_0_12px_rgba(0,196,167,0.5)]' 
                      : 'border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                  } ${isDarkMode ? 'bg-[#121c2e]' : 'bg-[#f8fafc]'} ${isSizeComplete ? 'text-[#00c4a7]' : 'text-[#ef4444]'}`}>
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="flex items-center">
                        <div className="relative">
                          <span className="invisible text-2xl font-black italic uppercase tracking-wider whitespace-pre">
                            {sizeInputBuffer || selectedSizeItems[0] || "US SIZE"}
                          </span>
                          <input 
                            type="text" 
                            value={sizeInputBuffer || selectedSizeItems[0] || ""} 
                            onChange={handleSizeInputChange} 
                            onKeyDown={handleSizeInputKeyDown} 
                            onFocus={() => setIsSizeFocused(true)}
                            onBlur={() => { handleSizeInputBlur(); setIsSizeFocused(false); }} 
                            placeholder={isSizeFocused ? "" : "US SIZE"}
                            className={`absolute inset-0 w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center ${isSizeComplete ? 'text-[#00c4a7]' : 'text-red-500'} placeholder:text-red-500 placeholder:not-italic placeholder:font-black`} 
                          />
                        </div>
                        {(sizeInputBuffer || selectedSizeItems[0]) && (
                          <span className="text-xl font-black italic uppercase tracking-wider text-gray-500 ml-1 whitespace-nowrap">US</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => { setActiveDropdown(activeDropdown === 'details-size' ? null : 'details-size'); setShowSuffixMenu(false); }} className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center justify-center">
                      <ChevronDown className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} ${activeDropdown === 'details-size' ? 'rotate-180' : ''} transition-transform`} size={18} />
                    </button>
                  </div>
                </div>
                {activeDropdown === 'details-size' && (<div className={`absolute top-full mt-5 right-0 w-[420px] z-[9999] border shadow-2xl p-1 ${isDarkMode ? 'bg-[#121c2e] border-[#1e293b]' : 'bg-white border-[#e2e8f0]'} grid grid-cols-6 gap-1`}>{INTEGER_SIZE_OPTIONS.map((opt) => (<div key={opt} onClick={() => handleBaseSizeSelect(opt)} className={`px-1 py-3 text-2xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]'}`}>{opt}</div>))}</div>)}
                {showSuffixMenu && !activeDropdown && (<div className={`absolute top-full mt-5 right-0 w-72 z-[9999] border shadow-2xl flex flex-col ${isDarkMode ? 'bg-[#121c2e] border-[#1e293b]' : 'bg-white border-[#e2e8f0]'}`}>{SUFFIX_OPTIONS.map((suf) => (<div key={suf} onClick={() => handleSuffixSelect(suf)} className={`px-6 py-3 text-2xl font-black italic uppercase tracking-wider cursor-pointer border-b last:border-0 ${isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]'}`}>{suf}</div>))}<div onClick={() => setShowSuffixMenu(false)} className={`px-6 py-2 text-sm font-bold uppercase text-center cursor-pointer ${isDarkMode ? 'text-gray-400 hover:text-black' : 'text-gray-500 hover:text-white'}`}>CLOSE</div></div>)}
              </div>
            </div>
          </div>

          <div className="flex justify-start w-[1346px] mx-auto mb-4 mt-2 shrink-0">
            <div className="w-[350px]" />
            {!isBand && <div className="w-[350px] ml-[48px]" />}
            <div className={`w-[350px] ${isBand ? 'ml-[251px]' : 'ml-[48px]'}`} />
            <div className={`${isBand ? 'ml-[251px]' : 'ml-[48px]'} w-36 flex items-center justify-center`}>
              <button onClick={() => setIsSaveModalOpen(true)} className="bg-[#00c4a7] hover:bg-[#00a08a] text-[#111827] px-10 py-2 rounded-full text-2xl font-black uppercase tracking-[0.1em] transition-all transform active:scale-95 shadow-lg whitespace-nowrap">ADD TO LIB</button>
            </div>
          </div>
          
          <div className={`mt-auto w-full flex flex-col border-t ${isDarkMode ? 'bg-[#111827] border-[#1e293b]' : 'bg-[#f1f5f9] border-[#cbd5e1]'} relative`}>
            {showSummaryOverlay && (
              <div className="absolute inset-0 z-[110] flex flex-col overflow-hidden animate-in fade-in duration-200">
                <div className={`flex items-center h-14 px-10 border-b w-full shrink-0 ${isDarkMode ? 'bg-[#1f2937] border-[#1e293b]' : 'bg-[#e5e7eb] border-[#cbd5e1]'} relative`}>
                  <div className="flex items-center w-[464px] shrink-0">
                    <svg 
                      width="32" 
                      height="32" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                      className="transition-all duration-300"
                      style={{ 
                        overflow: 'visible',
                        filter: (searchQuery && filteredListItems.length === 0) 
                          ? 'drop-shadow(0 0 5px #ef4444)' 
                          : ((searchQuery || isSearchFocused) ? 'drop-shadow(0 0 5px #00c4a7)' : 'none')
                      }}
                    >
                      <circle 
                        cx="11" 
                        cy="11" 
                        r="8" 
                        stroke={(searchQuery && filteredListItems.length === 0) ? '#ef4444' : ((searchQuery || isSearchFocused) ? '#00c4a7' : (isDarkMode ? "#9CA3AF" : "#4B5563"))} 
                        strokeWidth="2.5"
                      />
                      <path 
                        d="m21 21-4.3-4.3" 
                        stroke={(searchQuery && filteredListItems.length === 0) ? '#ef4444' : ((searchQuery || isSearchFocused) ? '#00c4a7' : (isDarkMode ? "#9CA3AF" : "#4B5563"))} 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className={`ml-8 text-5xl font-black italic ${isDarkMode ? 'text-white' : 'text-black'} tracking-tighter`}>{searchQuery ? filteredListItems.length : listItemsCount}</div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className={`w-full max-w-md px-6 py-1 rounded-full border pointer-events-auto transition-all duration-300 ${
                      (searchQuery && filteredListItems.length === 0)
                        ? 'border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                        : (searchQuery || isSearchFocused) 
                          ? 'border-[#00c4a7] shadow-[0_0_12px_rgba(0,196,167,0.5)]' 
                          : (isDarkMode ? 'border-[#1e293b]' : 'border-[#cbd5e1]')
                    } ${isDarkMode ? 'bg-[#111827]' : 'bg-white'}`}>
                      <input 
                        type="text" 
                        placeholder={searchPlaceholder}
                        onFocus={() => { setSearchPlaceholder(""); setHasSearchBeenClicked(true); setIsSearchFocused(true); }}
                        onBlur={() => { setSearchPlaceholder("Search by Name or ID"); setIsSearchFocused(false); }}
                        value={searchQuery}
                        onChange={(e) => { handleSearchChange(e); setHasSearchBeenClicked(true); }}
                        className={`w-full bg-transparent text-center text-2xl font-bold outline-none ${isDarkMode ? 'text-gray-400 placeholder-gray-500' : 'text-gray-600 placeholder-gray-500'}`}
                      />
                    </div>
                  </div>
                </div>
                <button onClick={() => { setShowSummaryOverlay(false); setOverlayPage(0); }} className={`absolute right-10 top-16 ${isDarkMode ? 'text-white' : 'text-black'} p-1 transition-transform hover:scale-110 z-[130]`}><X size={32} strokeWidth={2.5} /></button>
                <div className="flex flex-1 overflow-hidden relative">
                   {overlayPage === 1 && (
                     <button onClick={() => setOverlayPage(0)} className={`absolute left-4 top-1/2 -translate-y-1/2 z-[120] ${isDarkMode ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'} transition-colors opacity-80`}><ChevronLeft size={80} strokeWidth={1.5} /></button>
                   )}
                   {overlayPage === 0 && (
                     <button onClick={() => setOverlayPage(1)} className={`absolute right-4 top-1/2 -translate-y-1/2 z-[120] ${isDarkMode ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'} transition-colors opacity-80`}><ChevronRight size={80} strokeWidth={1.5} /></button>
                   )}
                   <div className={`flex-1 flex flex-col ${isDarkMode ? 'bg-[#111827]' : 'bg-white'} overflow-hidden relative`}>
                        {(selectedListItem !== null && filteredListItems.indexOf(selectedListItem) > 0) && (
                          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-[125]"><button onClick={handlePrevListItem} className="hover:opacity-70 transition-opacity p-1"><ChevronUp size={48} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} strokeWidth={2} /></button></div>
                        )}
                        {overlayPage === 0 ? (
                          <div className="flex flex-col items-center justify-start w-full h-full pt-16">
                            <div className="flex justify-start w-[1346px] mx-auto">
                              <div className="flex flex-col items-center w-[350px]">
                                <span className={`text-2xl font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>TYPE</span>
                                <div className="flex flex-col items-start gap-y-3 w-[350px]">{(currentDbItem ? currentDbItem.type : selectedDetailItems.filter(item => menuData[targetCategoryIndex].includes(item))).map((item, idx) => ( <span key={idx} className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item.includes('_') ? renderInteractiveCode(item, true) : item}</span> ))}</div>
                              </div>
                              {!isBand && (
                                <div className="flex flex-col items-center ml-[48px] w-[350px]">
                                  <span className={`text-2xl font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>HEAD</span>
                                  <div className="flex flex-col items-start gap-y-3 w-[350px]">{(currentDbItem ? getOrderedHeadItems(currentDbItem.head) : getOrderedHeadItems(selectedHeadItems)).map((item, idx) => ( <span key={idx} className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item.includes('_') ? renderInteractiveCode(item, true) : (item.startsWith("SEC_") ? item.replace("SEC_", "") : item)}</span> ))}</div>
                                </div>
                              )}
                              
                              <div className={`flex flex-col items-center ${isBand ? 'ml-[251px]' : 'ml-[48px]'} w-[350px]`}>
                                <span className={`text-2xl font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SHANK</span>
                                <div className="flex flex-col items-start gap-y-3 w-[350px]">
                                  {(currentDbItem ? getOrderedShankItems(currentDbItem.shank, currentDbItem.profile) : getOrderedShankItems(selectedShankItems, selectedProfileItems)).map(({item}, idx) => ( <span key={`shank-${idx}`} className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item.includes('_') ? renderInteractiveCode(item, true) : (item.startsWith("SEC_") ? item.replace("SEC_", "") : item)}</span> ))}
                                </div>
                              </div>
                              <div className={`${isBand ? 'ml-[251px]' : 'ml-[48px]'} flex flex-col items-center`}>
                                <span className={`text-2xl font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>US SIZE</span>
                                <div className="flex items-center">
                                  <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{currentDbItem ? currentDbItem.size : (selectedSizeItems[0] || "NOT SET")}</span>
                                  {(currentDbItem?.size || selectedSizeItems[0]) && (
                                    <span className="text-xl font-black italic uppercase tracking-wider text-gray-500 ml-1">US</span>
                                  )}
                                </div>
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
                        {(selectedListItem !== null && filteredListItems.indexOf(selectedListItem) < filteredListItems.length - 1) && (
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-[125]"><button onClick={handleNextListItem} className="hover:opacity-70 transition-opacity p-1"><ChevronDown size={48} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} strokeWidth={2} /></button></div>
                        )}
                   </div>
                </div>
                <div className={`h-3 w-full shrink-0 ${isDarkMode ? 'bg-[#1f2937]' : 'bg-[#e5e7eb] border-t border-[#d1d5db]'}`} />
              </div>
            )}
            <div className="w-full">
              <div className={`flex w-full px-10 h-14 items-center ${isDarkMode ? 'bg-[#1f2937]' : 'bg-[#e5e7eb]'} border-b ${isDarkMode ? 'border-[#1e293b]' : 'border-[#cbd5e1]'} relative`}>
                <div className="flex items-center w-[464px] shrink-0">
                  <svg 
                    width="32" 
                    height="32" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    className="transition-all duration-300"
                    style={{ 
                      overflow: 'visible',
                      filter: (searchQuery && filteredListItems.length === 0) 
                        ? 'drop-shadow(0 0 5px #ef4444)' 
                        : ((searchQuery || isSearchFocused) ? 'drop-shadow(0 0 5px #00c4a7)' : 'none')
                    }}
                  >
                    <circle 
                      cx="11" 
                      cy="11" 
                      r="8" 
                      stroke={(searchQuery && filteredListItems.length === 0) ? '#ef4444' : ((searchQuery || isSearchFocused) ? '#00c4a7' : (isDarkMode ? "#9CA3AF" : "#4B5563"))} 
                      strokeWidth="2.5"
                    />
                    <path 
                      d="m21 21-4.3-4.3" 
                      stroke={(searchQuery && filteredListItems.length === 0) ? '#ef4444' : ((searchQuery || isSearchFocused) ? '#00c4a7' : (isDarkMode ? "#9CA3AF" : "#4B5563"))} 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className={`ml-8 text-5xl font-black italic ${isDarkMode ? 'text-white' : 'text-black'} tracking-tighter`}>{searchQuery ? filteredListItems.length : listItemsCount}</div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className={`w-full max-w-md px-6 py-1 rounded-full border pointer-events-auto transition-all duration-300 ${
                    (searchQuery && filteredListItems.length === 0)
                      ? 'border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                      : (searchQuery || isSearchFocused) 
                        ? 'border-[#00c4a7] shadow-[0_0_12px_rgba(0,196,167,0.5)]' 
                        : (isDarkMode ? 'border-[#1e293b]' : 'border-[#cbd5e1]')
                  } ${isDarkMode ? 'bg-[#111827]' : 'bg-white'}`}>
                    <input 
                      type="text" 
                      placeholder={searchPlaceholder}
                      onFocus={() => { setSearchPlaceholder(""); setHasSearchBeenClicked(true); setIsSearchFocused(true); }}
                      onBlur={() => { setSearchPlaceholder("Search by Name or ID"); setIsSearchFocused(false); }}
                      value={searchQuery}
                      onChange={(e) => { handleSearchChange(e); setHasSearchBeenClicked(true); }}
                      className={`w-full bg-transparent text-center text-2xl font-bold outline-none ${isDarkMode ? 'text-gray-400 placeholder-gray-500' : 'text-gray-600 placeholder-gray-500'}`}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex h-[calc(100vh-320px)] min-h-[500px]">
              <div ref={scrollListRef} onScroll={handleScroll} className={`w-fit flex flex-col px-5 pb-5 pt-0 overflow-y-auto hide-scrollbar ${isDarkMode ? 'bg-[#111827]' : 'bg-white'}`}>
                <div className="flex flex-col gap-1 pt-5">
                  {filteredListItems.map((id) => {
                    const ring = ringsMap[id];
                    return (
                    <div key={id} data-id={id} onClick={() => handleListItemClick(id)} className={`grid grid-cols-[4rem_17rem_1fr] items-center text-4xl font-black italic tracking-widest py-1 px-4 cursor-pointer transition-colors ${id === selectedListItem ? 'text-[#38bdf8]' : (isDarkMode ? 'text-white' : 'text-black')}`}>
                      <span className="truncate shrink-0">{id}</span>
                      <span className="tracking-[0.1em] truncate shrink-0">
                        {highlightMatch(String(ring?.code ?? id), searchQuery)}
                      </span>
                      <div className="flex items-center gap-4 shrink-0 justify-self-start">
                        <button onClick={(e) => { e.stopPropagation(); setInfoRing(ring); }} className="text-[#10b981] italic font-black text-3xl hover:opacity-70 transition-opacity">i</button>
                        {userEmail && <button onClick={(e) => { e.stopPropagation(); downloadRingFilesZip(ring); }} className={`opacity-70 hover:opacity-100 transition-opacity ${isDarkMode ? 'text-white' : 'text-black'}`}><Download size={28} strokeWidth={2} /></button>}
                      </div>
                    </div>
                    );
                  })}
                  {filteredListItems.length === 0 && (
                    <div className={`px-4 py-2 text-sm italic ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No found</div>
                  )}
                </div>
              </div>
              <div 
                ref={scrollTrackRef} 
                onMouseDown={handleTrackMouseDown}
                className={`w-6 border-l border-r flex flex-col items-center shrink-0 ${isDarkMode ? 'bg-[#0b0f19] border-[#1e293b]' : 'bg-[#f1f5f9] border-[#cbd5e1]'} relative cursor-pointer`}>
                 <button 
                   onMouseDown={(e) => e.stopPropagation()}
                   onClick={(e) => { e.stopPropagation(); handleScrollUp(); }}
                   className={`absolute top-1 z-20 hover:opacity-70 transition-opacity ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                 >
                   <ChevronUp size={22} strokeWidth={3} />
                 </button>

                 <div 
                   onMouseDown={handleThumbMouseDown} 
                   style={{ top: `${thumbTop}px`, position: 'absolute' }} 
                   className={`w-4 h-32 rounded-full transform z-10 ${
                     isDraggingThumb 
                       ? 'bg-[#00c4a7] scale-x-110 shadow-[0_0_10px_rgba(0,196,167,0.4)]' 
                       : (isDarkMode ? 'bg-gray-600 hover:bg-[#00c4a7] hover:scale-x-110' : 'bg-gray-300 hover:bg-[#00c4a7] hover:scale-x-110')
                   } ${isDraggingThumb ? 'cursor-grabbing' : 'cursor-grab'}`}
                 >
                   <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                     <div className={`w-1.5 h-0.5 rounded-full transition-colors ${isDraggingThumb ? 'bg-white' : (isDarkMode ? 'bg-gray-400' : 'bg-gray-500')}`} />
                     <div className={`w-1.5 h-0.5 rounded-full transition-colors ${isDraggingThumb ? 'bg-white' : (isDarkMode ? 'bg-gray-400' : 'bg-gray-500')}`} />
                     <div className={`w-1.5 h-0.5 rounded-full transition-colors ${isDraggingThumb ? 'bg-white' : (isDarkMode ? 'bg-gray-400' : 'bg-gray-500')}`} />
                   </div>
                 </div>

                 <button 
                   onMouseDown={(e) => e.stopPropagation()}
                   onClick={(e) => { e.stopPropagation(); handleScrollDown(); }}
                   className={`absolute bottom-1 z-20 hover:opacity-70 transition-opacity ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                 >
                   <ChevronDown size={22} strokeWidth={3} />
                 </button>
              </div>
              <div className={`flex-1 flex flex-col relative overflow-hidden p-1 group ${isDarkMode ? 'bg-[#111827]' : 'bg-[#f1f5f9]'}`}>
                 <div
                   id="main-photo-viewport"
                   className={`w-full h-full flex items-center justify-center border ${isDarkMode ? 'border-[#1e293b] bg-[#111827]' : 'border-gray-100 bg-[#f1f5f9]'} relative cursor-default group transition-none overflow-hidden`}
                 >
                    {activePreviewTab === 'STL' && ringStl ? (
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
                    {activePreviewTab === 'IMAGE' && ringImages.length > 1 && ringImages.indexOf(selectedImage ?? '') > 0 && (
                      <button onClick={() => { const i = ringImages.indexOf(selectedImage ?? ''); setSelectedImage(ringImages[i - 1]); }} className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'} transition-colors opacity-70 hover:opacity-100`}><ChevronLeft size={64} strokeWidth={1.5} /></button>
                    )}
                    {activePreviewTab === 'IMAGE' && (() => { const i = ringImages.indexOf(selectedImage ?? ''); return i !== -1 && i < ringImages.length - 1; })() && (
                      <button onClick={() => { const i = ringImages.indexOf(selectedImage ?? ''); setSelectedImage(ringImages[i + 1]); }} className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'} transition-colors opacity-70 hover:opacity-100`}><ChevronRight size={64} strokeWidth={1.5} /></button>
                    )}
                 </div>
                 {(ringImages.length > 0 || ringStl) && (
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
      const isTypeSel = isShankTypeSelected;
      const isTextureSel = selectedShankItems.some(item => menuData[19].includes(item));
      const isProfileSel = isShankProfileSelected;
      const sectionBtnClass = (sel: boolean, blink: boolean) =>
        `whitespace-nowrap text-3xl tracking-tighter text-center leading-[1.1] transition-opacity ` +
        `${sel ? 'font-black' : 'font-bold opacity-80 hover:opacity-100'} ` +
        `${blink ? 'red-mist-glow' : ''} ` +
        `${!sel ? (isDarkMode ? 'text-[#9ca3af]' : 'text-[#111827]') : ''}`;
      return (
        <div className="flex flex-col items-center justify-start w-full relative min-h-[calc(100vh-160px)] pt-4 overflow-x-hidden pb-12">
          <h2 className={`text-6xl font-black tracking-tight text-center uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-black'}`}>SHANK</h2>

          {/* Section tabs */}
          <div className="flex gap-16 mb-10">
            <button onClick={() => setHeadGemPickerField('shank_type')} className={sectionBtnClass(isTypeSel, !isTypeSel)}>
              TYPE
            </button>
            <button onClick={() => { setIsShankSubflow(true); setHeadGemPickerField('shank_texture'); }} className={sectionBtnClass(isTextureSel, false)}>
              Texture&amp;Details
            </button>
            <button onClick={() => setHeadGemPickerField('profile')} className={sectionBtnClass(isProfileSel, !isProfileSel)}>
              PROFILE
            </button>
          </div>

          {/* GEMS label + ADD GEMS */}
          <h2 className={`text-2xl font-black tracking-[0.15em] text-center uppercase mb-4 mt-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>GEMS</h2>
          <button
            onClick={() => setShankGems(prev => [...prev, mkShankGem()])}
            className={`mb-2 text-xl font-black italic uppercase tracking-widest px-6 py-1 border transition-colors ${isDarkMode ? 'border-[#374151] text-gray-300 hover:text-white hover:border-white' : 'border-gray-300 text-gray-600 hover:text-black hover:border-black'}`}
          >+ ADD GEMS</button>

          {/* Gem rows */}
          <div className="flex flex-col items-center justify-start w-full pt-0">
            {shankGems.map((gem, rowIdx) => (
              <div key={rowIdx} className="grid grid-cols-5 w-full px-10 gap-x-4 mt-12">
                <div className="flex flex-col items-center">
                  <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SETTINGS</span>
                  <div className="flex flex-col items-center gap-y-1 mb-1 min-h-[24px]">{gem.settings ? <div className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{gem.settings}</span></div> : null}</div>
                  <div onClick={() => { setShankPickerRow(rowIdx); setShankPickerField('settings'); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SHAPE</span>
                  <div className="flex flex-col items-center gap-y-1 mb-1 min-h-[24px]">{gem.shapes ? <div className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{gem.shapes}</span></div> : null}</div>
                  <div onClick={() => { setShankPickerRow(rowIdx); setShankPickerField('shapes'); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>DIRECTION</span>
                  <div className="flex flex-col items-center gap-y-1 mb-1 min-h-[24px]">{gem.directions ? <div className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{gem.directions}</span></div> : null}</div>
                  <div onClick={() => { setShankPickerRow(rowIdx); setShankPickerField('directions'); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
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

          {/* Inline picker modal */}
          {shankPickerField !== null && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShankPickerField(null)}>
              <div style={{ background: isDarkMode ? '#0f1b2b' : '#fff', padding: '24px', borderRadius: '8px', minWidth: '320px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {shankPickerField === 'settings'
                    ? (lookups?.shank_stone_settings || []).map((item, i) => (
                        <div key={i} onClick={() => { updateShankGem(shankPickerRow, { settings: item.name, settingId: item.id }); setShankPickerField(null); }} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]'}`}>{item.name}</div>
                      ))
                    : shankPickerField === 'shapes'
                    ? (lookups?.stone_shapes || []).map((item, i) => (
                        <div key={i} onClick={() => { updateShankGem(shankPickerRow, { shapes: item.name }); setShankPickerField(null); }} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]'}`}>{item.name}</div>
                      ))
                    : (lookups?.directions || []).map((item, i) => (
                        <div key={i} onClick={() => { updateShankGem(shankPickerRow, { directions: item.name }); setShankPickerField(null); }} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]'}`}>{item.name}</div>
                      ))
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      );
    } else if (currentIdx === 5) {
      const placeholders = ["SET", "SHP", "DIR", "SIZ", "COU"];
      const isHeadSel = isHeadTypeSelected;
      const isTextureSel = selectedHeadItems.some(item => menuData[19].includes(item));
      const sectionBtnClass = (sel: boolean, blink: boolean) =>
        `whitespace-nowrap text-3xl tracking-tighter text-center leading-[1.1] transition-opacity ` +
        `${sel ? 'font-black' : 'font-bold opacity-80 hover:opacity-100'} ` +
        `${blink ? 'red-mist-glow' : ''} ` +
        `${!sel ? (isDarkMode ? 'text-[#9ca3af]' : 'text-[#111827]') : ''}`;
      return (
        <div className="flex flex-col items-center justify-start w-full relative min-h-[calc(100vh-160px)] pt-4 overflow-x-hidden pb-12">
          <h2 className={`text-6xl font-black tracking-tight text-center uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-black'}`}>HEAD</h2>

          {/* Section tabs */}
          <div className="flex gap-24 mb-10">
            <button onClick={() => setHeadGemPickerField('head_setting')} className={sectionBtnClass(isHeadSel, !isHeadSel)}>
              HEAD
            </button>
            <button onClick={() => { setIsShankSubflow(false); setHeadGemPickerField('head_texture'); }} className={sectionBtnClass(isTextureSel, false)}>
              Texture&amp;Details
            </button>
          </div>

          {/* MAIN GEM label */}
          <span className={`text-2xl font-black tracking-[0.15em] uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-black'}`}>MAIN GEM</span>

          {/* 5-field row */}
          <div className="flex justify-center w-full gap-8">
            <div className="flex flex-col items-center">
              <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SETTINGS</span>
              <div className="flex flex-col items-center gap-y-3 mb-1 min-h-[24px]">
                {mainGemsSettings.map((item, i) => <div key={i} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${placeholders.includes(item) ? 'text-[#ef4444]' : (isDarkMode ? 'text-white' : 'text-black')}`}>{item}</span></div>)}
              </div>
              <div onClick={() => { gemPickerSetterRef.current = setMainGemsSettings; setHeadGemPickerField('settings'); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors rounded-full ${isDarkMode ? 'bg-[#121c2e] hover:bg-[#1a263d]' : 'bg-[#f8fafc] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
            </div>
            <div className="flex flex-col items-center">
              <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SHAPE</span>
              <div className="flex flex-col items-center gap-y-3 mb-1 min-h-[24px]">
                {mainGemsShapes.map((item, i) => <div key={i} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${placeholders.includes(item) ? 'text-[#ef4444]' : (isDarkMode ? 'text-white' : 'text-black')}`}>{item}</span></div>)}
              </div>
              <div onClick={() => { gemPickerSetterRef.current = setMainGemsShapes; setHeadGemPickerField('shapes'); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors rounded-full ${isDarkMode ? 'bg-[#121c2e] hover:bg-[#1a263d]' : 'bg-[#f8fafc] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
            </div>
            <div className="flex flex-col items-center">
              <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>DIRECTION</span>
              <div className="flex flex-col items-center gap-y-3 mb-1 min-h-[24px]">
                {mainGemsDirections.map((item, i) => <div key={i} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${placeholders.includes(item) ? 'text-[#ef4444]' : (isDarkMode ? 'text-white' : 'text-black')}`}>{item}</span></div>)}
              </div>
              <div onClick={() => { gemPickerSetterRef.current = setMainGemsDirections; setHeadGemPickerField('directions'); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors rounded-full ${isDarkMode ? 'bg-[#121c2e] hover:bg-[#1a263d]' : 'bg-[#f8fafc] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
            </div>
            <div className="flex flex-col items-center">
              <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>SIZE</span>
              <div className="h-6 mb-1" />
              <div className={`w-72 h-14 flex items-center justify-center rounded-full ${isDarkMode ? 'bg-[#121c2e]' : 'bg-[#f8fafc]'}`}>
                <input type="text" value={mainGemsSize} onChange={(e) => { const val = e.target.value.replace(/[^0-9xX.]/g, ''); setMainGemsSize(val); }} placeholder="0x0x0" className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center placeholder-gray-600 ${isDarkMode ? 'text-white' : 'text-black'}`} />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>COUNT</span>
              <div className="h-6 mb-1" />
              <div className={`w-72 h-14 flex items-center justify-center rounded-full ${isDarkMode ? 'bg-[#121c2e]' : 'bg-[#f8fafc]'}`}>
                <input type="text" value={mainGemsCount} onChange={(e) => handleNumericCountChange(e.target.value, setMainGemsCount)} placeholder="1" className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center placeholder-gray-600 ${isDarkMode ? 'text-white' : 'text-black'}`} />
              </div>
            </div>
          </div>

          <div className="absolute bottom-12 right-16">
            <button onClick={handleAcceptMainGems} className={`text-5xl font-black uppercase tracking-[0.2em] transition-opacity hover:opacity-70 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>ACCEPT</button>
          </div>
        </div>
      );
    } else {
      const buttonGridClass = currentIdx === 5
        ? 'grid-cols-2 gap-y-40 gap-x-24 max-w-[800px] mx-auto'
        : currentIdx === 16
        ? 'grid-cols-2 gap-y-40 gap-x-24 max-w-[800px] mx-auto'
        : [2, 3, 7, 8, 11, 12, 13, 14, 15, 18, 19].includes(currentIdx) 
        ? 'grid-cols-3 gap-y-12 gap-x-44' 
        : currentIdx === 1 
          ? 'grid-cols-2 gap-y-12 gap-x-32' 
          : 'grid-cols-3 gap-y-12 gap-x-12';

      return (
        <div className="flex flex-col items-center justify-start w-full max-full relative min-h-[calc(100vh-160px)] pt-4 overflow-x-hidden pb-12">
          <h2 className={`text-6xl font-black tracking-tight text-center shrink-0 uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-black'}`}>{currentTitle}</h2>
          <div className="flex-1 flex items-center justify-center w-full">
            <div className={`grid ${buttonGridClass} w-full justify-items-center px-4 ${currentIdx === 1 ? '-mt-32' : ''}`}>
            {currentList.map((type, index) => {
              if (type === "") return <div key={`spacer-${index}`} className="w-full h-full" />;
              
              const isNav = (currentIdx === 0 && type === "Rings") || (currentIdx === 1 && ["Rings", "Bands"].includes(type)) || (currentIdx === 5 && ["MineGem", "HEAD", "GEMS", "Texture&Details"].includes(type)) || (currentIdx === 16 && ["TYPE", "PROFILE", "GEMS", "Texture&Details"].includes(type));
              
              let isSelected = false;
              let isBlinking = false;
              
              if (isNav) {
                if (currentIdx === 5) {
                  if (type === "MineGem") {
                    isSelected = isMineGemSelected && !isMainGemsIncomplete;
                    isBlinking = !isMineGemSelected || isMainGemsIncomplete;
                  }
                  if (type === "HEAD") {
                    isSelected = isHeadTypeSelected;
                    isBlinking = !isHeadTypeSelected;
                  }
                  if (type === "GEMS") {
                    const hasSecGems = selectedHeadItems.some(item => item.startsWith("SEC_"));
                    const isIncomplete = selectedHeadItems.some(item => item.startsWith("SEC_") && isIncompleteCode(item));
                    isSelected = hasSecGems && !isIncomplete;
                    isBlinking = isIncomplete;
                  }
                  if (type === "Texture&Details") {
                    isSelected = selectedHeadItems.some(item => menuData[19].includes(item));
                  }
                }
                if (currentIdx === 16) {
                  if (type === "TYPE") {
                    isSelected = isShankTypeSelected;
                    isBlinking = !isShankTypeSelected;
                  }
                  if (type === "PROFILE") {
                    isSelected = isShankProfileSelected;
                    isBlinking = !isShankProfileSelected;
                  }
                  if (type === "GEMS") {
                    const hasSecGems = selectedShankItems.some(item => item.startsWith("SEC_"));
                    const isIncomplete = selectedShankItems.some(item => item.startsWith("SEC_") && isIncompleteCode(item));
                    isSelected = hasSecGems && !isIncomplete;
                    isBlinking = isIncomplete;
                  }
                  if (type === "Texture&Details") {
                    isSelected = selectedShankItems.some(item => menuData[19].includes(item));
                  }
                }
              } else {
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
              const textColClass = `${isBlinking ? 'red-mist-glow' : ''} ${!isSelected ? (isDarkMode ? 'text-[#9ca3af]' : 'text-[#111827]') : ''}`;
              const finalBtnClass = `${sizeClass} tracking-tighter text-center leading-[1.1] ${opacityClass} ${textColClass}`;

              return (
                <div key={`type-${index}`} className={`flex flex-col items-center justify-center gap-2 break-inside-avoid ${currentIdx === 0 && ["Necklace", "Body Jewelry", "Accessories"].includes(type) ? 'mt-8' : ''}`}>
                  <button disabled={isRestricted} onClick={() => !isRestricted && toggleOption(currentIdx, type, isSelected)} className={finalBtnClass}>
                    {type}
                  </button>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center relative overflow-hidden ${isDarkMode ? 'bg-[#111827] text-[#f9fafb]' : 'bg-[#ffffff] text-[#1f2937]'}`}>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
      <input type="file" ref={fileInput3DMRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) { console.log('[3DM debug] name:', f.name, '| path:', (f as any).path, '| webkitRelativePath:', f.webkitRelativePath); setFile3dm(f); setUploadedAssets(prev => ({ ...prev, '3DM': true })); if (!jobName) setJobName(f.name.replace(/\.3dm$/i, '')); } e.target.value = ''; }} className="hidden" accept=".3dm" />
      <input type="file" ref={fileInputSTLRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFileStl(f); setUploadedAssets(prev => ({ ...prev, 'STL': true })); } e.target.value = ''; }} className="hidden" accept=".stl" />
      <input type="file" ref={fileInputMediaRef} onChange={(e) => { const files = e.target.files; if (files && files.length > 0) { setFileMedia(prev => [...prev, ...Array.from(files)]); setUploadedAssets(prev => ({ ...prev, 'MEDIA': true })); } e.target.value = ''; }} className="hidden" accept="image/*" multiple />
      <div className={`w-full flex flex-col items-center duration-0 ${isAnyModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <header className={`fixed top-0 left-0 right-0 h-10 flex items-center justify-between px-0 z-50 transform ${isDarkMode ? 'bg-[#1f2937]' : 'bg-[#e5e7eb] border-b border-[#d1d5db]'} shadow-sm`}>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <h1 
              onClick={() => navigate('/jewelry-type')}
              className="text-xl font-black uppercase tracking-[0.35em] leading-none text-gray-500 transition-all duration-300 cursor-pointer pointer-events-auto hover:opacity-70"
            >
              SLS LIBRARY
            </h1>
          </div>
          <div className="flex items-center h-full pr-4 z-10 ml-auto gap-3">
            {userEmail ? (
              <>
                <span className={`text-xs font-bold tracking-wider truncate max-w-[160px] ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{userEmail}</span>
                <button onClick={() => { clearAuthToken(); setUserEmail(null); navigate('/jewelry-type'); }} title="Logout" className={`opacity-60 hover:opacity-100 transition-opacity ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}><LogOut size={14} /></button>
              </>
            ) : (
              <button onClick={() => navigate('/login')} className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 border ${isDarkMode ? 'border-gray-600 text-gray-400 hover:text-white' : 'border-gray-400 text-gray-600 hover:text-black'}`}>Login</button>
            )}
            <div onClick={() => setIsDarkMode(!isDarkMode)} className={`relative flex items-center w-12 h-6 rounded-full border p-0.5 cursor-pointer transition-colors ${isDarkMode ? 'bg-[#111827] border-[#1e293b]' : 'bg-[#ffffff] border-[#cbd5e1]'} shadow-sm`}>
              <div className={`absolute w-4 h-4 rounded-full transform flex items-center justify-center shadow-md transition-transform duration-200 ${isDarkMode ? 'translate-x-0 bg-[#374151] text-white' : 'translate-x-7 bg-white text-[#f59e0b]'}`}>{isDarkMode ? <Moon size={10} /> : <Sun size={10} />}</div>
            </div>
          </div>
        </header>
        {!isSerchExpanded && (
          <div className="w-full flex-1 flex flex-col items-center justify-start pt-8 px-4 overflow-y-auto hide-scrollbar min-h-[calc(100vh-40px)] mt-10 relative">
            {activeMenuIndex !== 0 && activeMenuIndex !== null && ( 
              <> 
                <button onClick={handleOldSchemeBack} onContextMenu={(e) => { e.preventDefault(); handleHistoryBack(); }} className={`fixed left-10 top-14 flex items-center justify-center transition-opacity hover:opacity-70 z-50 ${isDarkMode ? 'text-white' : 'text-black'}`}><ArrowLeft size={32} strokeWidth={2.5} /></button> 
                <button onClick={() => setIsResetModalOpen(true)} className={`fixed right-10 top-14 flex items-center justify-center transition-all hover:opacity-70 z-50 ${isDarkMode ? 'text-white' : 'text-black'} rounded-full p-1 shadow-[0_0_12px_rgba(156,163,175,0.3)] border border-transparent hover:border-gray-500`}><X size={32} strokeWidth={2.5} /></button> 
              </> 
            )}
            {renderCurrentView()}
          </div>
        )}
      </div>

      {isAnyModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
          <div className={`w-[96vw] h-[94vh] rounded-lg shadow-2xl relative flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#1f2937] text-white' : 'bg-white text-black'}`}>
            <div className="pt-4 px-8 pb-4 flex flex-col h-full overflow-hidden">
              <div ref={libModalRef} className={`flex-1 flex flex-col ${libSectionGap} p-2 overflow-y-auto custom-scrollbar ${isDarkMode ? '[&::-webkit-scrollbar-thumb]:bg-gray-600' : '[&::-webkit-scrollbar-thumb]:bg-gray-300'}`}>
                {(() => {
                  const displayedSections = [
                    {
                      title: "| Jewelry",
                      columns: [
                        { label: "TYPE", selections: [activeJewelryType === 'ring' ? 'Ring' : 'Band'], index: 0 },
                        { label: "RING TYPE", selections: activeJewelryType === 'ring' ? (selectedOptions[2] || []) : (selectedOptions[3] || []), index: activeJewelryType === 'ring' ? 2 : 3 },
                        { label: "US SIZE", selections: selectedSizeItems.length > 0 ? [selectedSizeItems[0]] : [], index: 4 },
                      ]
                    },
                    {
                      title: "| CUSTOMER",
                      columns: [
                        { label: jobName || "Job Name", selections: [], index: -1 },
                      ]
                    },
                    {
                      title: "| HEAD",
                      columns: [
                        { label: "TYPE", selections: selectedOptions[7] || [], index: 7 },
                        { label: "MAIN GEM", selections: selectedHeadItems.filter(item => item.startsWith("M_")), index: 5 },
                        { label: "GEMS", selections: selectedHeadItems.filter(item => item.startsWith("SEC_")), index: 9 },
                        { label: "Texture&Details", selections: selectedHeadItems.filter(item => (selectedOptions[19] || []).includes(item)), index: 19 },
                      ]
                    },
                    {
                      title: "| SHANK",
                      columns: [
                        { label: "TYPE", selections: selectedOptions[14] || [], index: 14 },
                        { label: "PROFILE", selections: selectedProfileItems, index: 15 },
                        { label: "GEMS", selections: selectedShankItems.filter(item => item.startsWith("SEC_")).sort(sortGemsBySizeDesc), index: 9 },
                        { label: "Texture&Details", selections: selectedShankItems.filter(item => (selectedOptions[19] || []).includes(item)), index: 19 },
                      ]
                    }
                  ].filter(section => activeJewelryType === 'ring' || section.title !== "| HEAD");

                  const jewelrySection = displayedSections.find(s => s.title === "| Jewelry");
                  const customerSection = displayedSections.find(s => s.title === "| CUSTOMER");
                  const otherSections = displayedSections.filter(s => s.title !== "| Jewelry" && s.title !== "| CUSTOMER");

                  return (
                    <div className="flex flex-col gap-y-8">
                      {/* Row 1: Jewelry and Customer */}
                      <div className="grid grid-cols-4 gap-x-8">
                        {jewelrySection && (
                          <div className="col-span-3 flex flex-col gap-y-0.5">
                            <div className={`${libTitleSize} font-black uppercase tracking-widest text-[#00c4a7] opacity-80`}>
                              {jewelrySection.title}
                            </div>
                            <div className="grid grid-cols-3 gap-x-8">
                              {jewelrySection.columns.map((col, cIdx) => (
                                <div key={cIdx} className="flex flex-col">
                                  <div className={`${libItemHeight} flex items-end pb-0.5`}>
                                    <div className={`${libLabelSize} font-extrabold uppercase tracking-tight text-left ${
                                      ((col.label === "RING TYPE" || col.label === "US SIZE") && col.selections.length === 0) 
                                        ? 'text-[#ef4444]' 
                                        : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                                    }`}>
                                      {col.label}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-y-0">
                                    {col.selections.map((item, iIdx) => (
                                      <div key={iIdx} className={`${libItemHeight} flex items-center`}>
                                        <span className={`${libTextSize} font-bold leading-none whitespace-nowrap ${isDarkMode ? 'text-white' : 'text-black'}`}>
                                          {item}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {customerSection && (
                          <div className="col-span-1 flex flex-col gap-y-0.5">
                            <div className={`${libTitleSize} font-black uppercase tracking-widest opacity-80`}>
                              <span className={selectedCustomer ? 'text-[#00c4a7]' : 'text-[#ef4444]'}>|</span> <span className={selectedCustomer ? 'text-white' : 'text-[#ef4444]'}>{selectedCustomer || 'CUSTOMER'}</span>
                            </div>
                            <div className="flex flex-col">
                              {customerSection.columns.map((col, cIdx) => (
                                <div key={cIdx} className="flex flex-col">
                                  <div className={`${libItemHeight} flex items-end pb-0.5`}>
                                    <div className={`${libLabelSize} font-extrabold uppercase tracking-tight text-left ${jobName ? 'text-white' : 'text-[#ef4444]'}`}>
                                      {col.label}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-y-0">
                                    {col.selections.map((item, iIdx) => (
                                      <div key={iIdx} className={`${libItemHeight} flex items-center`}>
                                        <span className={`${libTextSize} font-bold leading-none whitespace-nowrap text-[#ef4444]`}>
                                          {item}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Other Sections: HEAD, SHANK */}
                      {otherSections.map((section, sIdx) => (
                        <div key={sIdx} className="flex flex-col gap-y-0.5">
                          <div className={`${libTitleSize} font-black uppercase tracking-widest text-[#00c4a7] opacity-80`}>
                            {section.title}
                          </div>
                          <div className="grid grid-cols-4 gap-x-8">
                            {section.columns.map((col, cIdx) => {
                              const uniqueSelections = Array.from(new Set(col.selections.filter(item => !["HEAD", "MineGem", "GEMS", "TYPE", "Texture&Details", "Head Setting"].includes(item))));
                              const isEmpty = uniqueSelections.length === 0;
                              const isGems = col.label === "GEMS" || col.label === "MAIN GEM";
                              const hasIncomplete = uniqueSelections.some(isIncompleteCode);
                              const isCore = !["Texture&Details", "Customer", "Name", "GEMS", "MAIN GEM"].includes(col.label);
                              
                              // Special coloring based on image
                              const isRedLabel = (section.title === "| HEAD" && (col.label === "TYPE" || col.label === "MAIN GEM")) && (isEmpty || hasIncomplete);

                              return (
                                <div key={cIdx} className="flex flex-col">
                                  <div className={`${libItemHeight} flex items-end pb-0.5`}>
                                    <div 
                                      className={`${libLabelSize} font-extrabold uppercase tracking-tight text-left ${
                                        isRedLabel ? 'text-[#ef4444]' :
                                        isGems 
                                          ? (hasIncomplete ? 'text-red-500' : (isDarkMode ? 'text-gray-400' : 'text-gray-500'))
                                          : (isEmpty && isCore ? 'text-red-500' : (isDarkMode ? 'text-gray-400' : 'text-gray-500'))
                                      }`}
                                    >
                                      {col.label}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-y-0">
                                    {uniqueSelections.map((item: string, iIdx: number) => (
                                      <div key={iIdx} className={`${libItemHeight} flex items-center`}>
                                        <span className={`${libTextSize} font-bold leading-none whitespace-nowrap ${isDarkMode ? 'text-white' : 'text-black'}`}>
                                          {item.includes('_') ? renderInteractiveCode(item, true) : (item.startsWith("SEC_") ? item.replace("SEC_", "") : item)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              {isSaveModalOpen && (() => {
                const displayedSections = [
                  {
                    title: "| Jewelry",
                    columns: [
                      { label: "TYPE", selections: [activeJewelryType === 'ring' ? 'Ring' : 'Band'], index: 0 },
                      { label: "RING TYPE", selections: activeJewelryType === 'ring' ? (selectedOptions[2] || []) : (selectedOptions[3] || []), index: activeJewelryType === 'ring' ? 2 : 3 },
                      { label: "US SIZE", selections: selectedSizeItems.length > 0 ? [selectedSizeItems[0]] : [], index: 4 },
                      { label: "Customer", selections: selectedCustomer ? [selectedCustomer] : [], index: -1 },
                      { label: "Name", selections: jobName ? [jobName] : [], index: -1 },
                    ]
                  },
                  {
                    title: "| HEAD",
                    columns: [
                      { label: "TYPE", selections: selectedOptions[7] || [], index: 7 },
                      { label: "MAIN GEM", selections: selectedHeadItems.filter(item => item.startsWith("M_")), index: 5 },
                      { label: "GEMS", selections: selectedHeadItems.filter(item => item.startsWith("SEC_")), index: 9 },
                      { label: "Texture&Details", selections: selectedHeadItems.filter(item => (selectedOptions[19] || []).includes(item)), index: 19 },
                    ]
                  },
                  {
                    title: "| SHANK",
                    columns: [
                      { label: "TYPE", selections: selectedOptions[14] || [], index: 14 },
                      { label: "PROFILE", selections: selectedProfileItems, index: 15 },
                      { label: "GEMS", selections: selectedShankItems.filter(item => item.startsWith("SEC_")).sort(sortGemsBySizeDesc), index: 9 },
                      { label: "Texture&Details", selections: selectedShankItems.filter(item => (selectedOptions[19] || []).includes(item)), index: 19 },
                    ]
                  }
                ].filter(section => activeJewelryType === 'ring' || section.title !== "| HEAD");

                const isAllCoreSelected = displayedSections.every(section => {
                  return section.columns.every(col => {
                    const uniqueSelections = Array.from(new Set(col.selections.filter(item => !["HEAD", "MineGem", "GEMS", "TYPE", "Texture&Details", "Head Setting"].includes(item)))); 
                    const isEmpty = uniqueSelections.length === 0;
                    const isGems = col.label === "GEMS" || col.label === "MAIN GEM";
                    const hasIncomplete = uniqueSelections.some(isIncompleteCode);
                    const isCore = !["Texture&Details", "Customer", "Name", "GEMS", "MAIN GEM"].includes(col.label);
                    
                    if (isGems) return !hasIncomplete;
                    if (isCore) return !isEmpty && !hasIncomplete;
                    return true;
                  });
                });

                const isReadyToAccept = isAllCoreSelected;

                return (
                  <div className="mt-0 mb-6 w-full shrink-0 px-10 grid grid-cols-[150px_1fr_auto] items-center">
                    <div className="col-start-1 flex items-center">
                      <button onClick={() => setIsSaveModalOpen(false)} className="hover:opacity-80 transition-opacity cursor-pointer">
                        <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="100" height="100" rx="20" fill="#00c4a7"/>
                          <path d="M60 30L40 50L60 70" stroke="#111827" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                    <div className="col-start-2 flex flex-col items-center gap-1">
                      <div className="flex gap-16 text-xl font-black uppercase tracking-widest">
                        <span className={uploadedAssets['3DM'] ? 'text-white' : 'text-[#ef4444]'}>3DM</span>
                        <span className={uploadedAssets['STL'] ? 'text-white' : 'text-[#ef4444]'}>STL</span>
                        <span className={uploadedAssets['MEDIA'] ? 'text-white' : 'text-[#ef4444]'}>MEDIA</span>
                      </div>
                      {!isReadyToAccept ? (
                        <div className="text-[#d66b6b] text-xl font-bold">Incomplete information must be filled in.</div>
                      ) : null}
                      {uploadError && (
                        <div className="text-[#d66b6b] text-sm font-bold mt-1 max-w-xs truncate" title={uploadError}>{uploadError}</div>
                      )}
                    </div>
                    <div className="col-start-3 flex items-center">
                      <button
                        onClick={handleAccept}
                        className={`px-12 py-2 border-2 rounded-full text-3xl font-black uppercase tracking-[0.1em] transition-all border-[#00c4a7] text-[#00c4a7] hover:bg-[#00c4a7]/10 ${uploadStatus === 'uploading' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={uploadStatus === 'uploading'}
                      >
                        {uploadStatus === 'uploading' ? '…' : 'SAVE'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}


      {infoRing && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setInfoRing(null)}>
          <div style={{ background: '#0f1b2b', padding: '24px', borderRadius: '8px', minWidth: '320px', color: '#fff' }} onClick={(e) => e.stopPropagation()}>
            {(activeJewelryType === 'band' || activeJewelryType === 'bands') ? (<>
              <div style={{ fontSize: '18px', marginBottom: '12px' }}>Band Info</div>
              <div><span style={{ color: 'red', fontWeight: 700 }}>TYPE: </span>{infoRing.band_names?.join(', ') || '—'}</div>
              <div><span style={{ color: 'red', fontWeight: 700 }}>PROFILE: </span>{infoRing.profile_names?.join(', ') || '—'}</div>
              <div><span style={{ color: 'red', fontWeight: 700 }}>US SIZE: </span>{infoRing.finger_size || '—'}</div>
            </>) : (<>
              <div style={{ fontSize: '18px', marginBottom: '12px' }}>Ring Info</div>
              <div><span style={{ color: 'red', fontWeight: 700 }}>TYPE: </span>{infoRing.ring_type_names?.join(', ') || '—'}</div>
              <div><span style={{ color: 'red', fontWeight: 700 }}>HEAD SETTINGS: </span>{infoRing.head_setting_names?.join(', ') || '—'}</div>
              <div><span style={{ color: 'red', fontWeight: 700 }}>HEAD TEXTURES: </span>{infoRing.head_texture_names?.join(', ') || '—'}</div>
              <div><span style={{ color: 'red', fontWeight: 700 }}>SHANK TYPES: </span>{infoRing.shank_type_names?.join(', ') || '—'}</div>
              <div><span style={{ color: 'red', fontWeight: 700 }}>SHANK TEXTURES: </span>{infoRing.shank_texture_names?.join(', ') || '—'}</div>
              <div><span style={{ color: 'red', fontWeight: 700 }}>PROFILE: </span>{infoRing.profile_names?.join(', ') || '—'}</div>
              <div><span style={{ color: 'red', fontWeight: 700 }}>US SIZE: </span>{infoRing.finger_size || '—'}</div>
              <div><span style={{ color: 'red', fontWeight: 700 }}>MAIN GEM: </span>{infoRing.head_gem ? [infoRing.head_gem.settings, infoRing.head_gem.shape, infoRing.head_gem.direction, infoRing.head_gem.size && `sz:${infoRing.head_gem.size}`, `×${infoRing.head_gem.count}`].filter(Boolean).join(' / ') : '—'}</div>
              <div style={{ display: 'flex' }}><span style={{ color: 'red', fontWeight: 700, marginRight: 5, flexShrink: 0 }}>SHANK GEM: </span><div>{infoRing.shank_gems?.length ? infoRing.shank_gems.map((g, i) => <div key={i}>{[g.settings, g.shape, g.direction, g.size && `sz:${g.size}`, `×${g.count}`].filter(Boolean).join(' / ')}</div>) : '—'}</div></div>
            </>)}
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button onClick={() => setInfoRing(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {isResetModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4">
          <div className={`w-96 p-8 rounded-lg shadow-2xl flex flex-col items-center text-center ${isDarkMode ? 'bg-[#1f2937] text-white' : 'bg-white text-black'}`}>
            <h3 className="text-2xl font-black uppercase tracking-widest mb-4">Warning</h3>
            <p className="text-lg mb-8 opacity-80">Are you sure you want to clear all data?</p>
            <div className="flex gap-4 w-full">
              <button onClick={() => setIsResetModalOpen(false)} className={`flex-1 py-3 rounded-full font-bold uppercase tracking-widest transition-all border ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 border-gray-600' : 'bg-gray-200 hover:bg-gray-300 border-gray-300'}`}>NO</button>
              <button onClick={() => { resetAll(); setIsResetModalOpen(false); }} className="flex-1 py-3 rounded-full font-bold uppercase tracking-widest bg-red-600 hover:bg-red-500 text-white transition-all border border-[#ef4444]">YES</button>
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

      {showSkipWarning && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
          <div className={`w-[96vw] h-[92vh] rounded-lg shadow-2xl relative flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#1f2937] text-white' : 'bg-white text-black'}`}>
            
            <div className="flex-1 flex flex-col items-center justify-center p-10">
              <h2 className="text-6xl font-black uppercase tracking-widest mb-8 text-center">WARNING</h2>
              <div className="text-3xl font-bold mb-8 text-center">
                The following sections are not selected:
                <div className="mt-8 flex flex-col gap-4">
                  {missingSections.map((section, idx) => (
                    <span key={idx} className="text-[#ef4444] uppercase text-4xl font-black italic">{section}</span>
                  ))}
                </div>
              </div>
              
              <div className="mt-12 flex items-center gap-3 cursor-pointer" onClick={() => setIsSkipChecked(!isSkipChecked)}>
                <div className={`w-6 h-6 rounded-sm border-2 flex items-center justify-center transition-all ${isDarkMode ? 'border-gray-400 bg-transparent' : 'border-gray-500 bg-transparent'}`}>
                  {isSkipChecked && <Check size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} strokeWidth={4} />}
                </div>
                <span className={`text-xl font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Never ask me again</span>
              </div>
            </div>
            
            <div className="absolute bottom-10 left-10">
              <button 
                onClick={() => { setShowSkipWarning(false); setIsSkipChecked(false); }}
                className="w-24 h-24 bg-[#00c4a7] hover:bg-[#00a08a] rounded-xl flex items-center justify-center transition-all shadow-[0_0_15px_rgba(0,196,167,0.6)] border border-[#00c4a7]"
              >
                <ChevronLeft size={64} className="text-[#111827]" strokeWidth={2} />
              </button>
            </div>
            
            <div className="absolute bottom-10 right-10">
              <button 
                onClick={() => {
                  if (onSkipConfirm) onSkipConfirm();
                  setShowSkipWarning(false);
                }}
                className="px-10 py-6 bg-[#00c4a7] hover:bg-[#00a08a] rounded-xl flex items-center justify-center transition-all shadow-[0_0_15px_rgba(0,196,167,0.6)] border border-[#00c4a7] text-[#111827] text-5xl font-black uppercase tracking-widest"
              >
                SKIP
              </button>
            </div>
          </div>
        </div>
      )}
      <div className={`fixed bottom-0 left-0 right-0 h-[3px] ${isDarkMode ? 'bg-[#1f2937]' : 'bg-[#e5e7eb]'} z-[60]`} />

      {/* ── headGemPickerField popups (old-frontend style) ── */}
      {headGemPickerField === 'ring_type' && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setHeadGemPickerField(null)}>
          <div style={{ background: isDarkMode ? '#0f1b2b' : '#fff', padding: '24px', borderRadius: '8px', minWidth: '320px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') setHeadGemPickerField(null); }}>
            <input ref={typePickerInputRef} value={typePickerQuery} onChange={e => setTypePickerQuery(e.target.value)} placeholder="Search..." style={{ width: '100%', marginBottom: '12px', padding: '8px 10px', borderRadius: '4px', border: isDarkMode ? '1px solid #374151' : '1px solid #d1d5db', background: isDarkMode ? '#0a1628' : '#f9fafb', color: isDarkMode ? '#fff' : '#000', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {(() => {
                const filtered = menuData[2].filter(x => x.toLowerCase().includes(typePickerQuery.trim().toLowerCase()));
                if (filtered.length === 0) return <div style={{ gridColumn: '1/-1', textAlign: 'center', opacity: 0.5, padding: '12px' }}>No results</div>;
                return filtered.map((item, i) => {
                  const sel = selectedDetailItems.includes(item);
                  return <div key={i} onClick={() => setSelectedDetailItems(prev => sel ? prev.filter(x => x !== item) : [...prev, item])} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${sel ? (isDarkMode ? 'text-white border-white bg-[#1f2937]' : 'text-black border-black bg-[#e2e8f0]') : (isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]')}`}>{sel ? '✓ ' : ''}{item}</div>;
                });
              })()}
            </div>
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button onClick={() => setHeadGemPickerField(null)} className={`text-sm font-black uppercase tracking-widest px-6 py-2 border ${isDarkMode ? 'border-[#374151] text-gray-300 hover:text-white hover:border-white' : 'border-gray-300 text-gray-600 hover:text-black hover:border-black'}`}>DONE</button>
            </div>
          </div>
        </div>
      )}
      {headGemPickerField === 'band_type' && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setHeadGemPickerField(null)}>
          <div style={{ background: isDarkMode ? '#0f1b2b' : '#fff', padding: '24px', borderRadius: '8px', minWidth: '320px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') setHeadGemPickerField(null); }}>
            <input ref={typePickerInputRef} value={typePickerQuery} onChange={e => setTypePickerQuery(e.target.value)} placeholder="Search..." style={{ width: '100%', marginBottom: '12px', padding: '8px 10px', borderRadius: '4px', border: isDarkMode ? '1px solid #374151' : '1px solid #d1d5db', background: isDarkMode ? '#0a1628' : '#f9fafb', color: isDarkMode ? '#fff' : '#000', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {(() => {
                const filtered = menuData[3].filter(x => x.toLowerCase().includes(typePickerQuery.trim().toLowerCase()));
                if (filtered.length === 0) return <div style={{ gridColumn: '1/-1', textAlign: 'center', opacity: 0.5, padding: '12px' }}>No results</div>;
                return filtered.map((item, i) => {
                  const sel = selectedDetailItems.includes(item);
                  return <div key={i} onClick={() => setSelectedDetailItems(prev => sel ? prev.filter(x => x !== item) : [...prev, item])} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${sel ? (isDarkMode ? 'text-white border-white bg-[#1f2937]' : 'text-black border-black bg-[#e2e8f0]') : (isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]')}`}>{sel ? '✓ ' : ''}{item}</div>;
                });
              })()}
            </div>
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button onClick={() => setHeadGemPickerField(null)} className={`text-sm font-black uppercase tracking-widest px-6 py-2 border ${isDarkMode ? 'border-[#374151] text-gray-300 hover:text-white hover:border-white' : 'border-gray-300 text-gray-600 hover:text-black hover:border-black'}`}>DONE</button>
            </div>
          </div>
        </div>
      )}
      {headGemPickerField !== null && headGemPickerField !== 'ring_type' && headGemPickerField !== 'band_type' && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setHeadGemPickerField(null)}>
          <div style={{ background: isDarkMode ? '#0f1b2b' : '#fff', padding: '24px', borderRadius: '8px', minWidth: '320px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') setHeadGemPickerField(null); }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {headGemPickerField === 'head_setting'
                ? menuData[7].map((item, i) => {
                    const sel = selectedHeadItems.includes(item);
                    return <div key={i} onClick={() => { setSelectedHeadItems(prev => sel ? prev.filter(x => x !== item) : [...prev, item]); setSelectedOptions(prev => ({ ...prev, [7]: sel ? (prev[7] || []).filter(x => x !== item) : [...(prev[7] || []), item] })); }} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${sel ? (isDarkMode ? 'text-white border-white bg-[#1f2937]' : 'text-black border-black bg-[#e2e8f0]') : (isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]')}`}>{sel ? '✓ ' : ''}{item}</div>;
                  })
                : headGemPickerField === 'head_texture'
                ? menuData[19].map((item, i) => {
                    const sel = selectedHeadItems.includes(item);
                    return <div key={i} onClick={() => { setSelectedHeadItems(prev => sel ? prev.filter(x => x !== item) : [...prev, item]); }} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${sel ? (isDarkMode ? 'text-white border-white bg-[#1f2937]' : 'text-black border-black bg-[#e2e8f0]') : (isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]')}`}>{sel ? '✓ ' : ''}{item}</div>;
                  })
                : headGemPickerField === 'shank_type'
                ? menuData[14].map((item, i) => {
                    const sel = selectedShankItems.includes(item);
                    return <div key={i} onClick={() => { setSelectedShankItems(prev => sel ? prev.filter(x => x !== item) : [...prev, item]); setSelectedOptions(prev => ({ ...prev, [14]: sel ? (prev[14] || []).filter(x => x !== item) : [...(prev[14] || []), item] })); }} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${sel ? (isDarkMode ? 'text-white border-white bg-[#1f2937]' : 'text-black border-black bg-[#e2e8f0]') : (isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]')}`}>{sel ? '✓ ' : ''}{item}</div>;
                  })
                : headGemPickerField === 'profile'
                ? menuData[15].map((item, i) => {
                    const sel = selectedProfileItems.includes(item);
                    return <div key={i} onClick={() => { setSelectedProfileItems(prev => sel ? prev.filter(x => x !== item) : [...prev, item]); setSelectedOptions(prev => ({ ...prev, [15]: sel ? (prev[15] || []).filter(x => x !== item) : [...(prev[15] || []), item] })); }} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${sel ? (isDarkMode ? 'text-white border-white bg-[#1f2937]' : 'text-black border-black bg-[#e2e8f0]') : (isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]')}`}>{sel ? '✓ ' : ''}{item}</div>;
                  })
                : headGemPickerField === 'shank_texture'
                ? menuData[19].map((item, i) => {
                    const sel = selectedShankItems.includes(item);
                    return <div key={i} onClick={() => { setSelectedShankItems(prev => sel ? prev.filter(x => x !== item) : [...prev, item]); }} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${sel ? (isDarkMode ? 'text-white border-white bg-[#1f2937]' : 'text-black border-black bg-[#e2e8f0]') : (isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]')}`}>{sel ? '✓ ' : ''}{item}</div>;
                  })
                : (headGemPickerField === 'settings' || headGemPickerField === 'shapes' || headGemPickerField === 'directions')
                ? (headGemPickerField === 'settings' ? menuData[11] : headGemPickerField === 'shapes' ? menuData[12] : menuData[13]).map((opt, i) => (
                    <div key={i} onClick={() => { gemPickerSetterRef.current?.([opt]); setHeadGemPickerField(null); }} className={`px-2 py-3 text-xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]'}`}>{opt}</div>
                  ))
                : null}
            </div>
            {(headGemPickerField !== 'settings' && headGemPickerField !== 'shapes' && headGemPickerField !== 'directions') && (
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <button onClick={() => setHeadGemPickerField(null)} className={`text-sm font-black uppercase tracking-widest px-6 py-2 border ${isDarkMode ? 'border-[#374151] text-gray-300 hover:text-white hover:border-white' : 'border-gray-300 text-gray-600 hover:text-black hover:border-black'}`}>DONE</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
