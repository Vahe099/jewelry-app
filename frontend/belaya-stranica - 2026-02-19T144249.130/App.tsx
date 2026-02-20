import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fetchLookups, searchRings, type Ring, type Lookups } from './api/jewelry';
import { Pencil, X, Moon, Sun, Search, ArrowLeft, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

// Custom Folder Icon component - Updated to be slightly smaller and ignore blue highlight on selection
const CustomFolderIcon: React.FC<{ size?: number; isActive?: boolean; isDarkMode?: boolean }> = ({ size = 50, isActive = false, isDarkMode = true }) => {
  const iconColor = isDarkMode ? '#ffffff' : '#1f2937';
  return (
    <div 
      style={{ 
        width: size, 
        height: size * 0.75, 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease'
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
         <path 
           d="M2 6.5C2 5.39543 2.89543 4.5 4 4.5H12C12.5 4.5 13.5 4.5 14.5 6C15.5 7.5 16 7.5 17 7.5H20C21.1046 7.5 22 8.39543 22 9.5V18.5C22 19.6046 21.1046 20.5 20 20.5H4C2.89543 20.5 2 19.6046 2 18.5V6.5Z" 
           fill={iconColor} 
         />
      </svg>
    </div>
  );
};

// Define constants for ring sizes and menu labels
const VALID_SIZES = [
  "1", "1.25", "1.5", "1.75", "2", "2.25", "2.5", "2.75", "3", "3.25", "3.5", "3.75",
  "4", "4.25", "4.5", "4.75", "5", "5.25", "5.5", "5.75", "6", "6.25", "6.5", "6.75",
  "7", "7.25", "7.5", "7.75", "8", "8.25", "8.5", "8.75", "9", "9.25", "9.5", "9.75",
  "10", "10.25", "10.5", "10.75", "11", "11.25", "11.5", "11.75", "12", "12.25", "12.5", "12.75",
  "13", "13.25", "13.5", "13.75", "14", "14.25", "14.5", "14.75", "15", "15.25", "15.5", "15.75", "16"
];

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

const App: React.FC = () => {
  const detailsDropdownRef = useRef<HTMLDivElement>(null);
  const scrollListRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(0);
  const [menuHistory, setMenuHistory] = useState<number[]>([0]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isSerchExpanded, setIsSerchExpanded] = useState(false);
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

  const listItemsCount = rings.length;
  const thumbHeight = 128; // h-32 in Tailwind is 8rem = 128px
  
  // Adjusted gaps: top is 2px, bottom is reduced to -2px to be strictly smaller and flush
  const topPadding = 2; 
  const bottomPadding = -2; 

  const [thumbTop, setThumbTop] = useState(topPadding);
  const [isDraggingThumb, setIsDraggingThumb] = useState(false);

  const [selectedListItem, setSelectedListItem] = useState<number | null>(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(DEFAULT_PRODUCT_IMAGE);
  const [libraryImages, setLibraryImages] = useState<Record<number, string>>({});

  const [showSummaryOverlay, setShowSummaryOverlay] = useState<boolean>(false);
  const [overlayPage, setOverlayPage] = useState<number>(0);
  const [isFullScreenImage, setIsFullScreenImage] = useState<boolean>(false);

  const menuData: Record<number, string[]> = {
    0: ["Rings", "Earrings", "Bracelets", "Necklace", "Body Jewelry", "Accessories"],
    1: ["Rings", "Bands"],
    2: ["ENG Solitaire", "ENG Solitaire with Diamonds", "ENG Halo", "ENG Hidden Halo", "ENG Three-Stone", "ENG Two Stone", "ENG SET", "ENG Accent", "ENG Fancy", "Signet Ring", "Dome Rings", "Cocktail Ring", "Stackable Rings", "", "Open Rings"],
    3: ["Wedding Bands", "Eternity Bands", "Plain Bands", "Domed Bands", "Twisted Bands", "Split Bands"],
    5: ["HEAD", "MineGem", "GEMS", "", "Texture&Details", ""], 
    7: ["Simple", "design", "fancy", "basket", "Lucida", "tulip"],
    8: ["Bezel", "Half bezel", "Three Prongs", "Four Prongs", "Five Prongs", "Six Prongs", "Double Prong", "Burnish", "Peg"],
    9: ["Secondary Settings", "Shape", "Direction", "Size", "Count"],
    11: ["Bezel", "Half bezel", "Three Prongs", "Four Prongs", "Five Prongs", "Six Prongs", "Double Prong", "Burnish", "Peg"],
    12: ["Round", "Asscher", "Cushion", "Emerald", "Marquise", "Oval", "Pear", "Princess", "Radiant", "Radiant SQ", "Cushion SQ", "heart", "Baguette", "Tapered Baguette", "hexagon", "Kite", "Trillion", "Half Moon"],
    13: ["North-South", "Slanted", "Alternating", "Est-West", "not directed"], 
    14: ["Classic Shank", "Knife-Edge", "Cathedral", "Tapered Shank", "Split Shank", "Twisted (Infinity)", "Bypass Shank", "Euro Shank", "Cathedral & Tapered Shank", "Open", "Fancy"],
    15: ["Rectangular", "Roundish", "Half-Roundish", "Arch, D-Shape", "Knife-Edge", "Knife-Arch", "Fancy", "Rectangular Comfort", "Roundish Comfort", "Half-Roundish Comfort", "Arch, D-Shape Comfort", "Knife-Edge Comfort", "Knife-Arch Comfort", "Fancy Comfort"],
    16: ["TYPE", "", "GEMS", "", "Texture&Details", ""], 
    18: ["Prong Setting", "Flush Setting", "French Pave", "Bezel Setting", "Channel Setting", "Pavé Setting", "Micro Pavé", "Tension Setting", "Bar Setting", "Cluster Setting", "Invisible Setting", "Burnish Setting"],
    19: ["Milgrain", "Filigree", "Hammered", "Beveled Edge", "Comfort Fit", "Engraved", "Brushed", "Matte", "Rope"]
  };

  // Fetch lookup tables once on mount
  useEffect(() => {
    fetchLookups().then(setLookups).catch(console.error);
  }, []);

  // Re-run search whenever lookups are ready or any filter changes (debounced 300 ms)
  useEffect(() => {
    if (!lookups) return;
    const headTextureItems  = (selectedOptions[19] || []).filter(t => !selectedShankItems.includes(t));
    const shankTextureItems = (selectedOptions[19] || []).filter(t =>  selectedShankItems.includes(t));
    const timer = setTimeout(() => {
      searchRings(
        { selectedDetailItems, selectedHeadItems, selectedShankItems, selectedProfileItems, headTextureItems, shankTextureItems },
        lookups,
      ).then(data => { setRings(data.items); setTotalCount(data.count); })
        .catch(console.error);
    }, 300);
    return () => clearTimeout(timer);
  }, [lookups, selectedDetailItems, selectedHeadItems, selectedShankItems, selectedProfileItems, selectedOptions]);

  const navigateTo = (idx: number | null) => {
    const target = idx === null ? 0 : idx;
    if (target === activeMenuIndex) return;
    setMenuHistory(prev => [...prev, target]);
    setActiveMenuIndex(target);
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
    setIsSaveModalOpen(false); 
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
    setSelectedOptions({}); setHistory([]); setRedoStack([]); setActiveMenuIndex(0); setMenuHistory([0]); setIsSaveModalOpen(false); setIsDarkMode(true); setIsShiftPressed(false); setIsSerchExpanded(false); setSelectedDetailItems([]); setSelectedHeadItems([]); setSelectedShankItems([]); setSelectedProfileItems([]); setSelectedSizeItems([]); setMainGemsSize(""); setMainGemsCount(""); setMainGemsSettings([]); setMainGemsShapes([]); setMainGemsDirections([]); setHeadSecSettings([]); setHeadSecShapes([]); setHeadSecDirections([]); setHeadSecSize(""); setHeadSecCount(""); setShankSecSettings([]); setShankSecShapes([]); setShankSecDirections([]); setShankSecSize(""); setShankSecCount(""); setSizeInputBuffer(""); setActiveDropdown(null); setShowSuffixMenu(false); setIsShankSubflow(false); setGemBuilderType('main'); setIsInteractiveMode(false); setEditingItemCode(null); setRingStore(initialConfig()); setBandStore(initialConfig()); setActiveJewelryType('ring'); setShowSummaryOverlay(false); setOverlayPage(0); setIsFullScreenImage(false); setSelectedListItem(1); setSelectedImage(DEFAULT_PRODUCT_IMAGE);
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

  const handlePhotoAreaClick = () => { fileInputRef.current?.click(); };

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
    const existing = libraryImages[num];
    setSelectedImage(existing || DEFAULT_PRODUCT_IMAGE);
  }, [libraryImages]);

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
      if (isSaveModalOpen) return;
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
  }, [handleUndo, handleRedo, isSaveModalOpen, resetAll, activeDropdown, showSuffixMenu, activeMenuIndex, handleAcceptMainGems, handleAcceptSecondaryGems, showSummaryOverlay, isFullScreenImage, handlePrevListItem, handleNextListItem, overlayPage]);

  useEffect(() => { saveCurrentToStore(); }, [saveCurrentToStore]);

  const toggleOption = (categoryIndex: number, option: string, isRemoval: boolean) => {
    if (!option) return;
    if (categoryIndex === 0 && option === "Rings") { navigateTo(1); return; }
    if (categoryIndex === 1) { 
      const newType = (option === "Rings") ? 'ring' : 'band'; 
      const newTarget = (option === "Rings") ? 2 : 3; 
      if (newType !== activeJewelryType) { setActiveJewelryType(newType); setTargetCategoryIndex(newTarget); loadFromStore(newType); } 
      else setTargetCategoryIndex(newTarget); 
      navigateTo(4); 
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
  const handleSizeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const val = e.target.value.replace(/[^0-9.]/g, ''); const parts = val.split('.'); if (parts.length > 2) return; setSizeInputBuffer(val); const isInteger = /^\d+$/.test(val); if (isInteger && parseInt(val) <= 16) setShowSuffixMenu(true); else setShowSuffixMenu(false); if (VALID_SIZES.includes(val)) setSelectedSizeItems([val]); };
  const handleSizeInputBlur = () => { if (!VALID_SIZES.includes(sizeInputBuffer)) setSizeInputBuffer(selectedSizeItems[0] || ""); };
  const handleSizeInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { setShowSuffixMenu(false); const val = e.currentTarget.value; if (VALID_SIZES.includes(val)) { setSelectedSizeItems([val]); e.currentTarget.blur(); } else { setSizeInputBuffer(selectedSizeItems[0] || ""); e.currentTarget.blur(); } } };

  const currentIdx = activeMenuIndex !== null ? activeMenuIndex : 0; 
  const currentList = menuData[currentIdx] || []; 
  const currentTitle = menuLabels[currentIdx] || "Jewelry Type"; 
  const isAnyModalOpen = isSaveModalOpen || isShiftPressed; 
  const isBand = targetCategoryIndex === 3;

  const renderBuilder = (title: string, type: 'main' | 'secondary', settings: string[], setSettings: (v: any) => void, shapes: string[], setShapes: (v: any) => void, directions: string[], setDirections: (v: any) => void, size: string, setSize: (v: string) => void, count: string, setCount: (v: string) => void, onAccept: () => void, settingsIndex: number) => (
    <div className="flex flex-col items-center justify-start w-full max-full pt-0 h-full min-h-[calc(100vh-160px)]">
      <h2 className={`text-2xl font-black tracking-[0.15em] text-center uppercase mb-4 -mt-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>{title}</h2>
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
          <div className={`w-72 h-12 flex items-center justify-center transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><input type="text" value={size} onChange={(e) => setSize(e.target.value)} className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center ${isDarkMode ? 'text-white' : 'text-black'}`} /></div>
        </div>
        <div className="flex flex-col items-center">
          <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>COUNT</span>
          <div className="flex flex-col items-center h-6 mb-1" />
          <div className={`w-72 h-12 flex items-center justify-center transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><input type="text" value={count} onChange={(e) => handleNumericCountChange(e.target.value, setCount)} className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center ${isDarkMode ? 'text-white' : 'text-black'}`} /></div>
        </div>
      </div>
      <div className="absolute bottom-12 right-16"><button onClick={onAccept} className={`text-5xl font-black uppercase tracking-[0.2em] transition-opacity hover:opacity-70 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>ACCEPT</button></div>
    </div>
  );

  const renderCurrentView = () => {
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
             <div className="flex justify-center"><div className={`px-6 py-1 border cursor-pointer hover:opacity-80 transition-opacity ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><span className={`text-2xl font-black italic tracking-widest uppercase ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>3DM</span></div></div>
             <div className="flex justify-center"><div className={`px-6 py-1 border cursor-pointer hover:opacity-80 transition-opacity ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><span className={`text-2xl font-black italic tracking-widest uppercase ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>STL</span></div></div>
             <div className="flex justify-center" onClick={() => { setShowSummaryOverlay(true); setOverlayPage(1); }}><div className={`px-6 py-1 border cursor-pointer hover:opacity-80 transition-opacity ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><span className={`text-2xl font-black italic tracking-widest uppercase ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>IMAGE</span></div></div>
          </div>
          <div className={`grid ${isBand ? 'grid-cols-3' : 'grid-cols-5'} w-full px-10 gap-x-4 mb-4`}>
            <div className="flex flex-col items-center">
              <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>TYPE</span>
              <div className="flex flex-col items-center gap-y-1">{selectedDetailItems.filter(item => menuData[targetCategoryIndex].includes(item)).map((item, idx) => ( <div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{(isInteractiveMode && item.includes('_')) ? renderInteractiveCode(item) : item}</span><div className="flex items-center gap-2 ml-2"><button onClick={() => toggleOption(targetCategoryIndex, item, true)} className="opacity-60 hover:opacity-100 transition-opacity"><X size={14} /></button><button onClick={(e) => { e.preventDefault(); handleEditItem(targetCategoryIndex, item); }} onContextMenu={(e) => { e.preventDefault(); setIsInteractiveMode(!isInteractiveMode); }} className={`opacity-60 hover:opacity-100 transition-opacity`}><Pencil size={14} color={isInteractiveMode ? "#16a34a" : "currentColor"} /></button></div></div> ))}</div>
              <div onClick={() => { setGemBuilderType('main'); setEditingItemCode(null); navigateTo(targetCategoryIndex); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner mt-1 ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
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
              <div className="flex flex-col items-center gap-y-1">{selectedProfileItems.map((item, idx) => ( <div key={idx} className="flex items-center h-6"><span className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{(isInteractiveMode && item.includes('_')) ? renderInteractiveCode(item) : item}</span><div className="flex items-center gap-2 ml-2"><button onClick={() => removeItemGlobally(15, item)} className="opacity-60 hover:opacity-100 transition-opacity"><X size={14} /></button><button onClick={(e) => { e.preventDefault(); handleEditItem(15, item); }} onContextMenu={(e) => { e.preventDefault(); setIsInteractiveMode(!isInteractiveMode); }} className={`opacity-60 hover:opacity-100 transition-opacity`}><Pencil size={14} color={isInteractiveMode ? "#16a34a" : "currentColor"} /></button></div></div> ))}</div>
              <div onClick={() => { setGemBuilderType('main'); setEditingItemCode(null); navigateTo(15); }} className={`w-72 h-12 flex items-center justify-center cursor-pointer transition-colors border shadow-inner mt-1 ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421] hover:bg-[#1a263d]' : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f1f5f9]'}`}><span className={`text-4xl font-light ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</span></div>
            </div>
            <div className="flex flex-col items-center">
              <span className={`text-2xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>US SIZE</span>
              <div className="relative mt-1" ref={detailsDropdownRef}>
                <div className={`w-72 h-12 flex items-center justify-between px-4 transition-colors border shadow-inner ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}><input type="text" value={sizeInputBuffer || selectedSizeItems[0] || ""} onChange={handleSizeInputChange} onKeyDown={handleSizeInputKeyDown} onBlur={handleSizeInputBlur} className={`w-full h-full bg-transparent text-2xl font-black italic uppercase tracking-wider outline-none text-center ${isDarkMode ? 'text-white' : 'text-black'}`} /><button onClick={() => { setActiveDropdown(activeDropdown === 'details-size' ? null : 'details-size'); setShowSuffixMenu(false); }} className="ml-2 h-full flex items-center justify-center"><ChevronDown className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} ${activeDropdown === 'details-size' ? 'rotate-180' : ''} transition-transform`} size={20} /></button></div>
                {activeDropdown === 'details-size' && (<div className={`absolute top-full right-0 w-[420px] z-[60] border shadow-2xl p-1 ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-white border-[#e2e8f0]'} grid grid-cols-6 gap-1`}>{INTEGER_SIZE_OPTIONS.map((opt) => (<div key={opt} onClick={() => handleBaseSizeSelect(opt)} className={`px-1 py-3 text-2xl font-black italic uppercase tracking-wider cursor-pointer border text-center transition-colors ${isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]'}`}>{opt}</div>))}</div>)}
                {showSuffixMenu && !activeDropdown && (<div className={`absolute top-full right-0 w-72 z-[70] border shadow-2xl flex flex-col ${isDarkMode ? 'bg-[#121c2e] border-[#0d1421]' : 'bg-white border-[#e2e8f0]'}`}>{SUFFIX_OPTIONS.map((suf) => (<div key={suf} onClick={() => handleSuffixSelect(suf)} className={`px-6 py-3 text-2xl font-black italic uppercase tracking-wider cursor-pointer border-b last:border-0 ${isDarkMode ? 'text-white border-[#1f2937] hover:bg-[#1f2937]' : 'text-black border-[#f1f5f9] hover:bg-[#f1f5f9]'}`}>{suf}</div>))}<div onClick={() => setShowSuffixMenu(false)} className={`px-6 py-2 text-sm font-bold uppercase text-center cursor-pointer ${isDarkMode ? 'text-gray-400 hover:text-black' : 'text-gray-500 hover:text-white'}`}>CLOSE</div></div>)}
              </div>
            </div>
          </div>
          
          <div className={`grid ${isBand ? 'grid-cols-3' : 'grid-cols-5'} w-full px-10 gap-x-4 mb-4 mt-2 shrink-0`}>
            <div className={isBand ? "col-span-2" : "col-span-4"} />
            <div className="flex items-center justify-center">
              <button onClick={() => setIsSaveModalOpen(true)} className="bg-[#166534] hover:bg-[#14532d] text-white px-10 py-2 rounded-sm text-2xl font-black uppercase tracking-[0.1em] transition-all transform active:scale-95 shadow-lg whitespace-nowrap">ADD TO LIB</button>
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
                          <div className="flex flex-col items-center justify-start w-full h-full pt-16">
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
                                <div className="flex flex-col items-center gap-y-1">{(currentDbItem ? currentDbItem.profile : selectedProfileItems).map((item, idx) => ( <span key={idx} className={`text-xl font-black italic uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-black'}`}>{item}</span> ))}</div>
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
            <div className="flex h-[calc(100vh-320px)] min-h-[500px]">
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
                      <div key={ring.id} onClick={() => handleListItemClick(num)} className={`grid grid-cols-[4rem_13rem_1fr] items-center text-4xl font-black italic tracking-widest py-1 px-4 cursor-pointer transition-colors ${num === selectedListItem ? 'text-[#38bdf8]' : (isDarkMode ? 'text-white' : 'text-black')}`}>
                        <span className="truncate shrink-0">{ring.id}</span>
                        <span className="tracking-[0.1em] truncate shrink-0">{ring.code}</span>
                        <div className="flex items-center gap-4 shrink-0 justify-self-start">
                          <button onClick={(e) => { e.stopPropagation(); handleListItemClick(num); setShowSummaryOverlay(true); setOverlayPage(0); }} className="text-[#10b981] italic font-black text-3xl hover:opacity-70 transition-opacity">i</button>
                          <div onClick={(e) => { e.stopPropagation(); handlePhotoAreaClick(); }} className="cursor-pointer hover:opacity-70 transition-opacity">
                            <CustomFolderIcon size={50} isActive={num === selectedListItem} isDarkMode={isDarkMode} />
                          </div>
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
              <div className={`flex-1 flex flex-col relative overflow-hidden p-1 group ${isDarkMode ? 'bg-[#111827]' : 'bg-[#f1f5f9]'}`}>
                 <div 
                   id="main-photo-viewport"
                   onClick={handlePhotoAreaClick} 
                   className={`w-full h-full flex items-center justify-center border ${isDarkMode ? 'border-[#1e293b] bg-[#111827]' : 'border-gray-100 bg-[#f1f5f9]'} relative cursor-pointer group transition-none overflow-hidden`}
                 >
                    {selectedImage ? ( 
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
                  <button disabled={isRestricted} onClick={() => !isRestricted && toggleOption(currentIdx, type, isSelected)} className={finalBtnClass}>
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
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><h1 className="text-xl font-black uppercase tracking-[0.35em] leading-none text-gray-500 transition-all duration-300">SLS LIBRARY</h1></div>
          <div className="flex items-center h-full pr-4 z-10 ml-auto">
            <div onClick={() => setIsDarkMode(!isDarkMode)} className={`relative flex items-center w-12 h-6 rounded-full border p-0.5 cursor-pointer transition-colors ${isDarkMode ? 'bg-[#111827] border-[#374151]' : 'bg-[#ffffff] border-[#cbd5e1]'} shadow-sm`}>
              <div className={`absolute w-4 h-4 rounded-full transform flex items-center justify-center shadow-md transition-transform duration-200 ${isDarkMode ? 'translate-x-0 bg-[#374151] text-white' : 'translate-x-7 bg-white text-[#f59e0b]'}`}>{isDarkMode ? <Moon size={10} /> : <Sun size={10} />}</div>
            </div>
          </div>
        </header>
        <footer className={`fixed bottom-0 left-0 right-0 h-3 z-50 transform ${isDarkMode ? 'bg-[#1f2937]' : 'bg-[#e5e7eb] border-t border-[#d1d5db]'} shadow-sm`} />
        {!isSerchExpanded && (
          <div className="w-full flex-1 flex flex-col items-center justify-start pt-8 px-4 overflow-y-auto hide-scrollbar min-h-[calc(100vh-40px)] mt-10 relative">
            {activeMenuIndex !== 0 && activeMenuIndex !== null && ( 
              <> 
                <button onClick={handleOldSchemeBack} onContextMenu={(e) => { e.preventDefault(); handleHistoryBack(); }} className={`fixed left-10 top-14 flex items-center justify-center transition-opacity hover:opacity-70 z-50 ${isDarkMode ? 'text-white' : 'text-black'}`}><ArrowLeft size={32} strokeWidth={2.5} /></button> 
                <button onClick={() => resetAll()} className={`fixed right-10 top-14 flex items-center justify-center transition-opacity hover:opacity-70 z-50 ${isDarkMode ? 'text-white' : 'text-black'}`}><X size={32} strokeWidth={2.5} /></button> 
              </> 
            )}
            {renderCurrentView()}
          </div>
        )}
      </div>

      {isAnyModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
          <div className={`w-[96vw] h-[92vh] rounded-lg shadow-2xl relative flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#1f2937] text-white' : 'bg-white text-black'}`}>
            {isSaveModalOpen && (<button onClick={() => setIsSaveModalOpen(false)} className="absolute top-4 right-4 text-[#ef4444] p-1 z-[110]"><X size={28} strokeWidth={3} /></button>)}
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
              {isSaveModalOpen && (<div className="mt-6 flex justify-center shrink-0"><button onClick={resetAll} className="px-20 py-4 bg-gray-500 text-white rounded-md text-sm font-bold uppercase tracking-[0.2em] hover:bg-gray-600 shadow-lg">OK</button></div>)}
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

export default App;
