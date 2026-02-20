// backend/static/app.js

// -------------------------
// UI helpers
// -------------------------
function makeSelect(options, name, placeholderText = "Select...") {
  const sel = document.createElement("select");
  sel.name = name;

  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholderText;
  ph.disabled = true;
  ph.selected = true;
  sel.appendChild(ph);

  (options || []).forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = o.name;
    sel.appendChild(opt);
  });

  return sel;
}

function makeInput(name, placeholder, type = "text") {
  const inp = document.createElement("input");
  inp.name = name;
  inp.placeholder = placeholder;
  inp.type = type;
  return inp;
}

// -------------------------
// Gems rows (Head/Shank/Bands)
// -------------------------
function gemRow(containerId) {
  const row = document.createElement("div");
  row.className = "row";

  let settingOptions = [];
  let settingFieldName = "";

  if (containerId === "headGems") {
    settingOptions = window.__head_stone_settings || [];
    settingFieldName = "head_stone_setting_id";
  } else {
    // shankGems + bandGems
    settingOptions = window.__shank_bands_stone_settings || [];
    settingFieldName = "shank_bands_stone_setting_id";
  }

  const ss = makeSelect(settingOptions, settingFieldName, "Stone setting");
  const sh = makeSelect(window.__stone_shapes || [], "stone_shape_id", "Stone shape");
  const dr = makeSelect(window.__directions || [], "directions_id", "Direction");

  const size = makeInput("stone_size", "0x0x0");

  const cnt = makeInput("stone_count", "count", "number");
  cnt.min = "1";
  cnt.value = "1";

  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "Remove";
  del.onclick = () => row.remove();

  row.appendChild(ss);
  row.appendChild(sh);
  row.appendChild(dr);
  row.appendChild(size);
  row.appendChild(cnt);
  row.appendChild(del);

  const box = document.getElementById(containerId);
  if (box) box.appendChild(row);
}


// Public helpers for buttons
window.addHeadGemRow = () => gemRow("headGems");
window.addShankGemRow = () => gemRow("shankGems");
window.addBandGemRow  = () => gemRow("bandGems");

// -------------------------
// Collect gems -> JSON
// -------------------------
function collectGems(containerId) {
  const box = document.getElementById(containerId);
  if (!box) return [];

  const rows = box.querySelectorAll(".row");
  const out = [];

  const settingKey =
    containerId === "headGems"
      ? "head_stone_setting_id"
      : "shank_bands_stone_setting_id";

  rows.forEach((r) => {
    const getVal = (n) => (r.querySelector(`[name="${n}"]`)?.value || "").trim();

    const setting_id = getVal(settingKey);
    const stone_shape_id = getVal("stone_shape_id");
    const directions_id = getVal("directions_id");
    const stone_size = getVal("stone_size");
    const stone_count = getVal("stone_count");

    if (!setting_id && !stone_shape_id && !directions_id && !stone_size && !stone_count) return;
    if (!setting_id || !stone_shape_id || !directions_id || !stone_size) return;

    let cnt = Number(stone_count || 1);
    if (!Number.isFinite(cnt) || cnt <= 0) cnt = 1;

    const obj = {
      stone_shape_id: Number(stone_shape_id),
      directions_id: Number(directions_id),
      stone_size: stone_size,
      stone_count: cnt,
    };

    obj[settingKey] = Number(setting_id);

    out.push(obj);
  });

  return out;
}

// Fill hidden JSON fields before submit
window.beforeSubmit = () => {
  const head = collectGems("headGems");
  const shank = collectGems("shankGems");
  const band = collectGems("bandGems");

  const hg = document.getElementById("head_gems_json");
  const sg = document.getElementById("shank_gems_json");
  const bg = document.getElementById("bands_gems_json");

  if (hg) hg.value = JSON.stringify(head);
  if (sg) sg.value = JSON.stringify(shank);
  if (bg) bg.value = JSON.stringify(band);
};

// -------------------------
// Live search (debounced)
// -------------------------
function getMultiSelectedValues(selectName) {
  const sel = document.querySelector(`select[name="${selectName}"]`);
  if (!sel) return [];
  return Array.from(sel.selectedOptions).map(o => Number(o.value)).filter(Boolean);
}

function renderSearchResult(data) {
  const countEl = document.getElementById("searchCount");
  const listEl = document.getElementById("searchList");

  if (countEl) countEl.textContent = `Count: ${data?.count ?? 0}`;
  if (!listEl) return;

  const items = data?.items || [];
  if (!items.length) {
    listEl.innerHTML = "<div style='color:#666;'>No results</div>";
    return;
  }

  listEl.innerHTML = items.map(r => {
      return `
        <div class="result-row">
          <div><b>ID:</b> ${r.id} &nbsp; <b>Code:</b> ${r.code}</div>
          <div style="color:#666; font-size:13px; word-break:break-all;">
            ${r.path_3dm}
          </div>
        </div>
      `;
    }).join("");
}

let searchTimer = null;

async function doLiveSearch() {
  const payload = {
    ring_type_ids: getMultiSelectedValues("ring_type_ids"),
    head_setting_ids: getMultiSelectedValues("head_setting_ids"),
    shank_type_ids: getMultiSelectedValues("shank_type_ids"),
    profiles_ids: getMultiSelectedValues("profiles_ids"),
    head_textures_ids: getMultiSelectedValues("head_textures_ids"),
    shank_textures_ids: getMultiSelectedValues("shank_textures_ids"),
    bands_ids: getMultiSelectedValues("bands_ids"),
    bands_textures_ids: getMultiSelectedValues("bands_textures_ids"),
  };

  try {
    const res = await fetch("/api/rings/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return;
    const data = await res.json();
    renderSearchResult(data);
  } catch (e) {
    // ignore
  }
}

function scheduleLiveSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(doLiveSearch, 250);
}

// -------------------------
// Multi-select toggle (no Ctrl needed)
// FIX: dispatch "change" manually so live search updates
// -------------------------
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('select[multiple]').forEach((select) => {
    select.addEventListener("mousedown", (e) => {
      const option = e.target;
      if (!option || option.tagName !== "OPTION") return;

      e.preventDefault();                 // keep dropdown open
      option.selected = !option.selected; // toggle

      // IMPORTANT: force change event
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
});

// Clear selected (ALL)
window.clearAllMultiSelects = () => {
  document.querySelectorAll("select[multiple]").forEach((select) => {
    Array.from(select.options).forEach((opt) => (opt.selected = false));
    select.dispatchEvent(new Event("change", { bubbles: true })); // update search
  });
};

// -------------------------
// Toast (success/error)
// -------------------------
function showToast(text, isError = false) {
  const t = document.getElementById("toast");
  if (!t) return;

  t.textContent = text;
  t.className = "toast show " + (isError ? "err" : "ok");

  setTimeout(() => {
    t.className = "toast";
  }, 2500);
}

// -------------------------
// Default 1 row on load
// -------------------------
document.addEventListener("DOMContentLoaded", () => {
  window.addHeadGemRow?.();
  window.addShankGemRow?.();
  window.addBandGemRow?.();
});

// -------------------------
// Hook live search to filters
// -------------------------
document.addEventListener("DOMContentLoaded", () => {
  const filterSelects = [
    "ring_type_ids",
    "head_setting_ids",
    "shank_type_ids",
    "profiles_ids",
    "head_textures_ids",
    "shank_textures_ids",
    "bands_ids",
    "bands_textures_ids",
  ];

  filterSelects.forEach((name) => {
    const sel = document.querySelector(`select[name="${name}"]`);
    if (sel) sel.addEventListener("change", scheduleLiveSearch);
  });

  scheduleLiveSearch(); // initial
});

// -------------------------
// AJAX submit (URL stays the same)
// -------------------------
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("ringForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    window.beforeSubmit?.();

    const btn = document.getElementById("saveBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving...";
    }

    try {
      const formData = new FormData(form);

      const res = await fetch("/create-ring", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const t = await res.text();
        showToast(t || "Error saving ring", true);
        return;
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = { ok: true };
      }

      if (data.ok) {
        showToast("✅ OK", false);

        form.reset();
        window.clearAllMultiSelects?.();

        const head = document.getElementById("headGems");
        const shank = document.getElementById("shankGems");
        const band = document.getElementById("bandGems");

        if (head) head.innerHTML = "";
        if (shank) shank.innerHTML = "";
        if (band) band.innerHTML = "";

        window.addHeadGemRow?.();
        window.addShankGemRow?.();
        window.addBandGemRow?.();

        scheduleLiveSearch(); // refresh list after save
      }
    } catch (err) {
      showToast("Server error", true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Save";
      }
    }
  });
});
