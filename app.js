const STORAGE_KEY = "travel-tool-v1";
const CHECKLIST_KEY = "travel-tool-checklist-v1";
const SYNC_KEY = "travel-tool-sync-v1";

function makeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneData(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

const typeOrder = ["全部", "景點", "餐廳", "住宿", "交通", "票券", "購物", "其他"];
const defaultChecklist = [
  "護照、簽證、身分證件",
  "機票、訂房、票券截圖",
  "行動電源、轉接頭、充電線",
  "常用藥品、保險資料",
  "把行程匯出備份一次"
];

const starterTrip = {
  name: "我的旅程",
  startDate: new Date().toISOString().slice(0, 10),
  currency: "TWD",
  note: "先把重要地址、票券、訂房資料放進來。",
  days: [
    { id: makeId(), title: "Day 1" },
    { id: makeId(), title: "Day 2" },
    { id: makeId(), title: "Day 3" }
  ],
  items: [
    {
      id: makeId(),
      dayIndex: 0,
      time: "09:00",
      type: "交通",
      name: "出發",
      address: "",
      url: "",
      cost: "",
      currency: "TWD",
      note: "可以把航班、車票或集合地點寫在這裡。"
    },
    {
      id: makeId(),
      dayIndex: 0,
      time: "12:00",
      type: "餐廳",
      name: "午餐候選",
      address: "",
      url: "",
      cost: "",
      currency: "TWD",
      note: "貼上餐廳地址後，可以直接開地圖導航。"
    }
  ]
};

let state = loadState();
let selectedDay = 0;
let activeFilter = "全部";
let toastTimer;

const els = {
  tripTitle: document.querySelector("#tripTitle"),
  tripMeta: document.querySelector("#tripMeta"),
  todayCount: document.querySelector("#todayCount"),
  totalCost: document.querySelector("#totalCost"),
  backupStatus: document.querySelector("#backupStatus"),
  dayTabs: document.querySelector("#dayTabs"),
  addDayButton: document.querySelector("#addDayButton"),
  addItemButton: document.querySelector("#addItemButton"),
  syncButton: document.querySelector("#syncButton"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  searchInput: document.querySelector("#searchInput"),
  filterRow: document.querySelector("#filterRow"),
  selectedDayTitle: document.querySelector("#selectedDayTitle"),
  sortButton: document.querySelector("#sortButton"),
  timeline: document.querySelector("#timeline"),
  checklist: document.querySelector("#checklist"),
  toast: document.querySelector("#toast"),
  itemDialog: document.querySelector("#itemDialog"),
  itemForm: document.querySelector("#itemForm"),
  itemDialogTitle: document.querySelector("#itemDialogTitle"),
  itemId: document.querySelector("#itemId"),
  itemName: document.querySelector("#itemName"),
  itemType: document.querySelector("#itemType"),
  itemDay: document.querySelector("#itemDay"),
  itemTime: document.querySelector("#itemTime"),
  itemAddress: document.querySelector("#itemAddress"),
  itemCost: document.querySelector("#itemCost"),
  itemCurrency: document.querySelector("#itemCurrency"),
  itemUrl: document.querySelector("#itemUrl"),
  itemNote: document.querySelector("#itemNote"),
  deleteItemButton: document.querySelector("#deleteItemButton"),
  editTripButton: document.querySelector("#editTripButton"),
  tripDialog: document.querySelector("#tripDialog"),
  tripForm: document.querySelector("#tripForm"),
  tripNameInput: document.querySelector("#tripNameInput"),
  startDateInput: document.querySelector("#startDateInput"),
  currencyInput: document.querySelector("#currencyInput"),
  tripNoteInput: document.querySelector("#tripNoteInput"),
  syncDialog: document.querySelector("#syncDialog"),
  syncForm: document.querySelector("#syncForm"),
  tripIdInput: document.querySelector("#tripIdInput"),
  tripPinInput: document.querySelector("#tripPinInput"),
  apiBaseInput: document.querySelector("#apiBaseInput"),
  syncStatusText: document.querySelector("#syncStatusText"),
  generatePairButton: document.querySelector("#generatePairButton"),
  pushSyncButton: document.querySelector("#pushSyncButton"),
  pullSyncButton: document.querySelector("#pullSyncButton")
};

let syncConfig = loadSyncConfig();

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return cloneData(starterTrip);
  try {
    const parsed = JSON.parse(stored);
    return normalizeTrip(parsed);
  } catch {
    return cloneData(starterTrip);
  }
}

function normalizeTrip(trip) {
  const days = Array.isArray(trip.days) && trip.days.length ? trip.days : starterTrip.days;
  return {
    name: trip.name || "我的旅程",
    startDate: trip.startDate || "",
    currency: trip.currency || "TWD",
    note: trip.note || "",
    days: days.map((day, index) => ({
      id: day.id || makeId(),
      title: day.title || `Day ${index + 1}`
    })),
    items: Array.isArray(trip.items)
      ? trip.items.map((item) => ({
          id: item.id || makeId(),
          dayIndex: Number.isInteger(item.dayIndex) ? item.dayIndex : 0,
          time: item.time || "",
          type: item.type || "景點",
          name: item.name || "未命名行程",
          address: item.address || "",
          url: item.url || "",
          cost: item.cost || "",
          currency: item.currency || trip.currency || "TWD",
          note: item.note || ""
        }))
      : []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  els.backupStatus.textContent = "已儲存";
}

function loadSyncConfig() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSyncConfig() {
  localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig));
}

function formatDate(index) {
  if (!state.startDate) return "";
  const date = new Date(`${state.startDate}T00:00:00`);
  date.setDate(date.getDate() + index);
  return date.toLocaleDateString("zh-Hant-TW", { month: "numeric", day: "numeric", weekday: "short" });
}

function formatMoney(value, currency = state.currency) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return `${currency || state.currency} ${number.toLocaleString("zh-Hant-TW")}`;
}

function render() {
  selectedDay = Math.min(selectedDay, state.days.length - 1);
  renderHeader();
  renderDays();
  renderFilters();
  renderTimeline();
  renderChecklist();
}

function renderHeader() {
  const total = state.items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
  const dayItems = state.items.filter((item) => item.dayIndex === selectedDay);
  els.tripTitle.textContent = state.name;
  els.tripMeta.textContent = [
    state.startDate ? `出發：${state.startDate}` : "",
    `${state.days.length} 天`,
    state.note
  ].filter(Boolean).join(" · ");
  els.todayCount.textContent = dayItems.length.toString();
  els.totalCost.textContent = total ? `${state.currency} ${total.toLocaleString("zh-Hant-TW")}` : "$0";
}

function renderDays() {
  els.dayTabs.innerHTML = "";
  state.days.forEach((day, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-tab${index === selectedDay ? " is-active" : ""}`;
    button.innerHTML = `<strong>${escapeHtml(day.title)}</strong><span>${escapeHtml(formatDate(index) || "未設定")}</span>`;
    button.addEventListener("click", () => {
      selectedDay = index;
      render();
    });
    els.dayTabs.append(button);
  });

  els.itemDay.innerHTML = "";
  state.days.forEach((day, index) => {
    const option = document.createElement("option");
    option.value = index.toString();
    option.textContent = `${day.title}${formatDate(index) ? ` · ${formatDate(index)}` : ""}`;
    els.itemDay.append(option);
  });
}

function renderFilters() {
  els.filterRow.innerHTML = "";
  typeOrder.forEach((type) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip${type === activeFilter ? " is-active" : ""}`;
    button.textContent = type;
    button.addEventListener("click", () => {
      activeFilter = type;
      renderTimeline();
      renderFilters();
    });
    els.filterRow.append(button);
  });
}

function renderTimeline() {
  els.selectedDayTitle.textContent = `${state.days[selectedDay]?.title || "Day"} ${formatDate(selectedDay) || ""}`;
  const query = els.searchInput.value.trim().toLowerCase();
  const items = state.items
    .filter((item) => item.dayIndex === selectedDay)
    .filter((item) => activeFilter === "全部" || item.type === activeFilter)
    .filter((item) => {
      if (!query) return true;
      return [item.name, item.address, item.note, item.type].join(" ").toLowerCase().includes(query);
    })
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

  els.timeline.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = query || activeFilter !== "全部" ? "沒有符合條件的行程。" : "這一天還沒有行程，先新增一筆。";
    els.timeline.append(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "timeline-card";
    const mapQuery = encodeURIComponent(item.address || item.name);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
    const money = formatMoney(item.cost, item.currency);
    card.innerHTML = `
      <div class="time-block">${escapeHtml(item.time || "未定")}</div>
      <div class="card-main">
        <div class="card-title-row">
          <h3>${escapeHtml(item.name)}</h3>
          <span class="type-pill">${escapeHtml(item.type)}</span>
        </div>
        ${item.address ? `<p class="card-detail">📍 ${escapeHtml(item.address)}</p>` : ""}
        ${money ? `<p class="card-detail">花費：${escapeHtml(money)}</p>` : ""}
        ${item.note ? `<p class="card-detail">${escapeHtml(item.note)}</p>` : ""}
        <div class="card-actions">
          <a href="${mapsUrl}" target="_blank" rel="noreferrer">地圖</a>
          ${item.url ? `<a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">連結</a>` : ""}
          <button type="button" data-edit="${escapeAttribute(item.id)}">編輯</button>
        </div>
      </div>
    `;
    card.querySelector("[data-edit]").addEventListener("click", () => openItemDialog(item));
    els.timeline.append(card);
  });
}

function renderChecklist() {
  const stored = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "[]");
  const checklist = defaultChecklist.map((label, index) => ({
    label,
    checked: stored[index] === true
  }));
  els.checklist.innerHTML = "";
  checklist.forEach((item, index) => {
    const label = document.createElement("label");
    label.className = "check-item";
    label.innerHTML = `<input type="checkbox"${item.checked ? " checked" : ""}><span>${escapeHtml(item.label)}</span>`;
    label.querySelector("input").addEventListener("change", (event) => {
      stored[index] = event.target.checked;
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(stored));
    });
    els.checklist.append(label);
  });
}

function openItemDialog(item = null) {
  els.itemDialogTitle.textContent = item ? "編輯行程" : "新增行程";
  els.itemId.value = item?.id || "";
  els.itemName.value = item?.name || "";
  els.itemType.value = item?.type || "景點";
  els.itemDay.value = String(item?.dayIndex ?? selectedDay);
  els.itemTime.value = item?.time || "";
  els.itemAddress.value = item?.address || "";
  els.itemCost.value = item?.cost || "";
  els.itemCurrency.value = item?.currency || state.currency || "TWD";
  els.itemUrl.value = item?.url || "";
  els.itemNote.value = item?.note || "";
  els.deleteItemButton.hidden = !item;
  showSheet(els.itemDialog);
  setTimeout(() => els.itemName.focus(), 80);
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
    return;
  }
  dialog.removeAttribute("open");
}

function showSheet(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }
  dialog.setAttribute("open", "");
}

function handleItemSubmit(event) {
  event.preventDefault();
  const id = els.itemId.value || makeId();
  const nextItem = {
    id,
    dayIndex: Number(els.itemDay.value),
    time: els.itemTime.value,
    type: els.itemType.value,
    name: els.itemName.value.trim(),
    address: els.itemAddress.value.trim(),
    cost: els.itemCost.value,
    currency: els.itemCurrency.value.trim() || state.currency,
    url: els.itemUrl.value.trim(),
    note: els.itemNote.value.trim()
  };

  if (!nextItem.name) {
    showToast("請先輸入名稱");
    return;
  }

  const index = state.items.findIndex((item) => item.id === id);
  if (index >= 0) {
    state.items[index] = nextItem;
  } else {
    state.items.push(nextItem);
  }

  selectedDay = nextItem.dayIndex;
  saveState();
  closeDialog(els.itemDialog);
  render();
  showToast("行程已儲存");
}

function deleteCurrentItem() {
  const id = els.itemId.value;
  if (!id) return;
  state.items = state.items.filter((item) => item.id !== id);
  saveState();
  closeDialog(els.itemDialog);
  render();
  showToast("已刪除行程");
}

function addDay() {
  state.days.push({ id: makeId(), title: `Day ${state.days.length + 1}` });
  selectedDay = state.days.length - 1;
  saveState();
  render();
  showToast("已新增一天");
}

function sortSelectedDay() {
  const untouched = state.items.filter((item) => item.dayIndex !== selectedDay);
  const sorted = state.items
    .filter((item) => item.dayIndex === selectedDay)
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  state.items = [...untouched, ...sorted];
  saveState();
  renderTimeline();
  showToast("已依時間排序");
}

function exportTrip() {
  const data = JSON.stringify({ exportedAt: new Date().toISOString(), trip: state }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.name || "trip"}-backup.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("備份檔已建立");
}

async function importTrip(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    state = normalizeTrip(parsed.trip || parsed);
    selectedDay = 0;
    saveState();
    render();
    showToast("匯入完成");
  } catch {
    showToast("匯入失敗，請確認 JSON 檔");
  } finally {
    els.importInput.value = "";
  }
}

function openTripDialog() {
  els.tripNameInput.value = state.name;
  els.startDateInput.value = state.startDate;
  els.currencyInput.value = state.currency;
  els.tripNoteInput.value = state.note;
  showSheet(els.tripDialog);
}

function openSyncDialog() {
  ensurePairCode();
  els.tripIdInput.value = syncConfig.tripId;
  els.tripPinInput.value = syncConfig.pin;
  els.apiBaseInput.value = syncConfig.apiBase || location.origin;
  updateSyncStatus(syncConfig.lastSyncedAt ? `上次同步：${new Date(syncConfig.lastSyncedAt).toLocaleString("zh-Hant-TW")}` : "尚未同步");
  showSheet(els.syncDialog);
}

function ensurePairCode() {
  if (!syncConfig.tripId) syncConfig.tripId = `trip_${makeId().replace(/[^a-z0-9]/gi, "").slice(0, 8)}`;
  if (!syncConfig.pin) syncConfig.pin = Math.floor(100000 + Math.random() * 900000).toString();
  saveSyncConfig();
}

function generatePairCode() {
  syncConfig = {
    ...syncConfig,
    tripId: `trip_${makeId().replace(/[^a-z0-9]/gi, "").slice(0, 8)}`,
    pin: Math.floor(100000 + Math.random() * 900000).toString()
  };
  saveSyncConfig();
  openSyncDialog();
  showToast("已產生新的配對碼");
}

function getApiBase() {
  const value = els.apiBaseInput.value.trim().replace(/\/$/, "");
  syncConfig.apiBase = value || location.origin;
  saveSyncConfig();
  return syncConfig.apiBase;
}

function updateSyncStatus(message) {
  els.syncStatusText.textContent = message;
}

async function pushTripToCloud() {
  ensurePairCode();
  const apiBase = getApiBase();
  updateSyncStatus("正在上傳...");
  try {
    const response = await fetch(`${apiBase}/.netlify/functions/trip`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId: syncConfig.tripId,
        pin: syncConfig.pin,
        trip: state
      })
    });
    if (!response.ok) throw new Error("sync failed");
    const data = await response.json();
    syncConfig.lastSyncedAt = data.updatedAt || new Date().toISOString();
    saveSyncConfig();
    updateSyncStatus(`已上傳：${new Date(syncConfig.lastSyncedAt).toLocaleString("zh-Hant-TW")}`);
    showToast("行程已同步給 GPT");
  } catch {
    updateSyncStatus("上傳失敗，確認部署網址是否正確");
    showToast("同步失敗");
  }
}

async function pullTripFromCloud() {
  ensurePairCode();
  const apiBase = getApiBase();
  updateSyncStatus("正在抓回...");
  try {
    const url = new URL(`${apiBase}/.netlify/functions/trip`);
    url.searchParams.set("tripId", syncConfig.tripId);
    url.searchParams.set("pin", syncConfig.pin);
    const response = await fetch(url);
    if (!response.ok) throw new Error("sync failed");
    const data = await response.json();
    state = normalizeTrip(data.trip);
    syncConfig.lastSyncedAt = data.updatedAt || new Date().toISOString();
    saveState();
    saveSyncConfig();
    closeDialog(els.syncDialog);
    render();
    showToast("已套用 GPT 更新");
  } catch {
    updateSyncStatus("抓回失敗，確認 Trip ID、PIN、API 網址");
    showToast("抓回失敗");
  }
}

function handleTripSubmit(event) {
  event.preventDefault();
  state.name = els.tripNameInput.value.trim() || "我的旅程";
  state.startDate = els.startDateInput.value;
  state.currency = els.currencyInput.value.trim() || "TWD";
  state.note = els.tripNoteInput.value.trim();
  state.items = state.items.map((item) => ({ ...item, currency: item.currency || state.currency }));
  saveState();
  closeDialog(els.tripDialog);
  render();
  showToast("旅程設定已更新");
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 2200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {
    els.backupStatus.textContent = "本機";
  });
}

els.addItemButton.addEventListener("click", () => openItemDialog());
els.syncButton.addEventListener("click", openSyncDialog);
els.addDayButton.addEventListener("click", addDay);
els.sortButton.addEventListener("click", sortSelectedDay);
els.exportButton.addEventListener("click", exportTrip);
els.importInput.addEventListener("change", (event) => importTrip(event.target.files[0]));
els.searchInput.addEventListener("input", renderTimeline);
els.itemForm.addEventListener("submit", handleItemSubmit);
els.deleteItemButton.addEventListener("click", deleteCurrentItem);
els.editTripButton.addEventListener("click", openTripDialog);
els.tripForm.addEventListener("submit", handleTripSubmit);
els.syncForm.addEventListener("submit", (event) => {
  event.preventDefault();
  closeDialog(els.syncDialog);
});
els.generatePairButton.addEventListener("click", generatePairCode);
els.pushSyncButton.addEventListener("click", pushTripToCloud);
els.pullSyncButton.addEventListener("click", pullTripFromCloud);

render();
saveState();
registerServiceWorker();
