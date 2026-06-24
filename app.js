const DATA = window.LEADS_DATA || { leads: [], categories: [], counties: [] };
const STORAGE_KEY = "sales-leads-state-v2";
const PAGE_SIZE = 50;
const STATUSES = ["Nealocat", "De contactat", "Contactat", "Calificat", "Oferta", "Pierdut"];
const PRIORITIES = ["Medie", "Ridicata", "Scazuta"];
const DEFAULT_REPS = ["Andrei", "Bianca", "Cristian", "Diana"];

const state = loadState();
let filtered = [];
let selected = new Set();
let page = 1;

const els = {
  search: document.querySelector("#searchInput"),
  category: document.querySelector("#categoryFilter"),
  county: document.querySelector("#countyFilter"),
  owner: document.querySelector("#ownerFilter"),
  status: document.querySelector("#statusFilter"),
  priority: document.querySelector("#priorityFilter"),
  clearFilters: document.querySelector("#clearFilters"),
  repList: document.querySelector("#repList"),
  addRepBtn: document.querySelector("#addRepBtn"),
  rows: document.querySelector("#leadRows"),
  template: document.querySelector("#rowTemplate"),
  totalCount: document.querySelector("#totalCount"),
  visibleCount: document.querySelector("#visibleCount"),
  selectedCount: document.querySelector("#selectedCount"),
  unassignedCount: document.querySelector("#unassignedCount"),
  hotCount: document.querySelector("#hotCount"),
  selectVisibleBtn: document.querySelector("#selectVisibleBtn"),
  clearSelectionBtn: document.querySelector("#clearSelectionBtn"),
  autoDistributeBtn: document.querySelector("#autoDistributeBtn"),
  batchOwner: document.querySelector("#batchOwner"),
  assignSelectedBtn: document.querySelector("#assignSelectedBtn"),
  batchStatus: document.querySelector("#batchStatus"),
  statusSelectedBtn: document.querySelector("#statusSelectedBtn"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  exportBackupBtn: document.querySelector("#exportBackupBtn"),
  importBackupInput: document.querySelector("#importBackupInput"),
  prevPage: document.querySelector("#prevPage"),
  nextPage: document.querySelector("#nextPage"),
  pageInfo: document.querySelector("#pageInfo"),
};

function loadState() {
  const fallback = { reps: DEFAULT_REPS, leads: {} };
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.reps) || typeof parsed.leads !== "object") return fallback;
    return {
      reps: parsed.reps.length ? parsed.reps : DEFAULT_REPS,
      leads: parsed.leads || {},
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function recordFor(id) {
  if (!state.leads[id]) {
    state.leads[id] = {
      owner: "",
      status: "Nealocat",
      priority: "Medie",
      note: "",
      updatedAt: "",
    };
  }
  return state.leads[id];
}

function formatNumber(value) {
  return new Intl.NumberFormat("ro-RO").format(value);
}

function fillSelect(select, values, placeholder) {
  select.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  select.append(first);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function fillStaticFilters() {
  fillSelect(els.category, DATA.categories, "Toate categoriile");
  fillSelect(els.county, DATA.counties, "Toate judetele");
}

function renderRepList() {
  els.repList.innerHTML = "";
  state.reps.forEach((rep, index) => {
    const item = document.createElement("div");
    item.className = "rep-item";

    const input = document.createElement("input");
    input.value = rep;
    input.setAttribute("aria-label", `Agent ${index + 1}`);
    input.addEventListener("change", () => {
      const previous = state.reps[index];
      const next = input.value.trim();
      if (!next) {
        input.value = previous;
        return;
      }
      state.reps[index] = next;
      Object.values(state.leads).forEach((record) => {
        if (record.owner === previous) record.owner = next;
      });
      saveState();
      refreshOwnerControls();
      applyFilters();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "x";
    remove.title = "Sterge agent";
    remove.addEventListener("click", () => {
      if (state.reps.length === 1) return;
      const removed = state.reps.splice(index, 1)[0];
      Object.values(state.leads).forEach((record) => {
        if (record.owner === removed) record.owner = "";
      });
      saveState();
      renderRepList();
      refreshOwnerControls();
      applyFilters();
    });

    item.append(input, remove);
    els.repList.append(item);
  });
}

function refreshOwnerControls() {
  const ownerValues = ["Nealocat", ...state.reps];
  fillSelect(els.owner, ownerValues, "Toti agentii");
  fillSelect(els.batchOwner, state.reps, "Alege agent...");
}

function currentRecord(lead) {
  return recordFor(lead.id);
}

function passesFilters(lead) {
  const record = currentRecord(lead);
  const query = els.search.value.trim().toLowerCase();
  if (query && !lead.searchable.includes(query) && !record.note.toLowerCase().includes(query)) return false;
  if (els.category.value && lead.category !== els.category.value) return false;
  if (els.county.value && lead.county !== els.county.value) return false;
  if (els.priority.value && record.priority !== els.priority.value) return false;
  if (els.status.value) {
    if (els.status.value === "Nealocat" && record.owner) return false;
    if (els.status.value !== "Nealocat" && record.status !== els.status.value) return false;
  }
  if (els.owner.value) {
    if (els.owner.value === "Nealocat" && record.owner) return false;
    if (els.owner.value !== "Nealocat" && record.owner !== els.owner.value) return false;
  }
  return true;
}

function applyFilters(resetPage = true) {
  filtered = DATA.leads.filter(passesFilters);
  if (resetPage) page = 1;
  const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  page = Math.min(page, maxPage);
  renderRows();
  renderStats();
}

function renderStats() {
  const unassigned = DATA.leads.filter((lead) => !currentRecord(lead).owner).length;
  const hot = DATA.leads.filter((lead) => currentRecord(lead).priority === "Ridicata").length;
  els.totalCount.textContent = formatNumber(DATA.leads.length);
  els.visibleCount.textContent = formatNumber(filtered.length);
  els.selectedCount.textContent = formatNumber(selected.size);
  els.unassignedCount.textContent = formatNumber(unassigned);
  els.hotCount.textContent = formatNumber(hot);
}

function optionList(values, selectedValue) {
  return values
    .map((value) => `<option value="${escapeHtml(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function ownerOptions(selectedOwner) {
  return `<option value="">Nealocat</option>${optionList(state.reps, selectedOwner)}`;
}

function renderRows() {
  els.rows.innerHTML = "";
  const start = (page - 1) * PAGE_SIZE;
  const pageLeads = filtered.slice(start, start + PAGE_SIZE);

  pageLeads.forEach((lead) => {
    const record = currentRecord(lead);
    const row = els.template.content.firstElementChild.cloneNode(true);
    row.dataset.id = lead.id;

    const checkbox = row.querySelector(".row-select");
    checkbox.checked = selected.has(lead.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selected.add(lead.id);
      else selected.delete(lead.id);
      renderStats();
    });

    row.querySelector(".client-name").textContent = lead.name || lead.operator || "Fara nume";
    row.querySelector(".client-meta").textContent = [lead.operator, lead.cui].filter(Boolean).join(" | ");
    row.querySelector(".location").textContent = [lead.city, lead.county].filter(Boolean).join(", ") || "-";
    row.querySelector(".address").textContent = lead.address || "-";
    row.querySelector(".category").textContent = lead.category;
    row.querySelector(".product").textContent = lead.product || "-";
    row.querySelector(".capacity").textContent = lead.capacity || "-";

    const owner = row.querySelector(".owner-select");
    owner.innerHTML = ownerOptions(record.owner);
    owner.value = record.owner;
    owner.addEventListener("change", () => updateLead(lead.id, { owner: owner.value }));

    const status = row.querySelector(".status-select");
    status.innerHTML = optionList(STATUSES, record.status);
    status.value = record.status;
    status.addEventListener("change", () => updateLead(lead.id, { status: status.value }));

    const priority = row.querySelector(".priority-select");
    priority.innerHTML = optionList(PRIORITIES, record.priority);
    priority.value = record.priority;
    priority.addEventListener("change", () => updateLead(lead.id, { priority: priority.value }));

    const note = row.querySelector(".note-input");
    note.value = record.note;
    note.addEventListener("change", () => updateLead(lead.id, { note: note.value.trim() }));

    els.rows.append(row);
  });

  const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  els.pageInfo.textContent = `Pagina ${page} din ${maxPage}`;
  els.prevPage.disabled = page <= 1;
  els.nextPage.disabled = page >= maxPage;
}

function updateLead(id, patch) {
  const record = recordFor(id);
  Object.assign(record, patch, { updatedAt: new Date().toISOString() });
  if (patch.owner && record.status === "Nealocat") record.status = "De contactat";
  if (!record.owner && record.status === "De contactat") record.status = "Nealocat";
  saveState();
  renderStats();
}

function selectedLeads() {
  return DATA.leads.filter((lead) => selected.has(lead.id));
}

function assignSelected() {
  if (!els.batchOwner.value || !selected.size) return;
  selected.forEach((id) => updateLead(id, { owner: els.batchOwner.value, status: "De contactat" }));
  applyFilters(false);
}

function statusSelected() {
  if (!els.batchStatus.value || !selected.size) return;
  selected.forEach((id) => updateLead(id, { status: els.batchStatus.value }));
  applyFilters(false);
}

function autoDistributeSelected() {
  const reps = state.reps.filter(Boolean);
  const leads = selectedLeads();
  if (!reps.length || !leads.length) return;
  leads.forEach((lead, index) => {
    updateLead(lead.id, { owner: reps[index % reps.length], status: "De contactat" });
  });
  applyFilters(false);
}

function resetFilters() {
  els.search.value = "";
  els.category.value = "";
  els.county.value = "";
  els.owner.value = "";
  els.status.value = "";
  els.priority.value = "";
  applyFilters();
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n\r;]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function exportCsv() {
  const headers = [
    "Nume",
    "Operator",
    "CUI",
    "Categorie",
    "Produs",
    "Oras",
    "Judet",
    "Adresa",
    "Capacitate",
    "Agent",
    "Status",
    "Prioritate",
    "Note",
    "Fisier sursa",
    "Rand sursa",
  ];
  const rows = filtered.map((lead) => {
    const record = currentRecord(lead);
    return [
      lead.name,
      lead.operator,
      lead.cui,
      lead.category,
      lead.product,
      lead.city,
      lead.county,
      lead.address,
      lead.capacity,
      record.owner || "Nealocat",
      record.status,
      record.priority,
      record.note,
      lead.source,
      lead.row,
    ];
  });
  downloadText("leads-vanzari-export.csv", [headers, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\n"), "text/csv;charset=utf-8");
}

function exportBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    reps: state.reps,
    leads: state.leads,
  };
  downloadText("backup-alocari-leads.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed.reps) || typeof parsed.leads !== "object") {
        alert("Fisierul nu pare sa fie un backup valid.");
        return;
      }
      state.reps = parsed.reps;
      state.leads = parsed.leads;
      saveState();
      renderRepList();
      refreshOwnerControls();
      selected.clear();
      applyFilters();
    } catch {
      alert("Nu am putut citi backup-ul.");
    }
  };
  reader.readAsText(file, "utf-8");
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function bindEvents() {
  [els.search, els.category, els.county, els.owner, els.status, els.priority].forEach((el) => {
    el.addEventListener("input", () => applyFilters());
    el.addEventListener("change", () => applyFilters());
  });

  els.clearFilters.addEventListener("click", resetFilters);
  els.addRepBtn.addEventListener("click", () => {
    state.reps.push(`Agent ${state.reps.length + 1}`);
    saveState();
    renderRepList();
    refreshOwnerControls();
  });
  els.selectVisibleBtn.addEventListener("click", () => {
    filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).forEach((lead) => selected.add(lead.id));
    renderRows();
    renderStats();
  });
  els.clearSelectionBtn.addEventListener("click", () => {
    selected.clear();
    renderRows();
    renderStats();
  });
  els.autoDistributeBtn.addEventListener("click", autoDistributeSelected);
  els.assignSelectedBtn.addEventListener("click", assignSelected);
  els.statusSelectedBtn.addEventListener("click", statusSelected);
  els.exportCsvBtn.addEventListener("click", exportCsv);
  els.exportBackupBtn.addEventListener("click", exportBackup);
  els.importBackupInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) importBackup(file);
    event.target.value = "";
  });
  els.prevPage.addEventListener("click", () => {
    page = Math.max(1, page - 1);
    renderRows();
  });
  els.nextPage.addEventListener("click", () => {
    page += 1;
    applyFilters(false);
  });
}

fillStaticFilters();
renderRepList();
refreshOwnerControls();
bindEvents();
applyFilters();
