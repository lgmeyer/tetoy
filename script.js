const months = [
  { key: "jan", label: "JAN", monthIndex: 0 },
  { key: "fev", label: "FEV", monthIndex: 1 },
  { key: "mar", label: "MAR", monthIndex: 2 },
  { key: "abr", label: "ABR", monthIndex: 3 },
  { key: "mai", label: "MAI", monthIndex: 4 },
  { key: "jun", label: "JUN", monthIndex: 5 },
  { key: "jul", label: "JUL", monthIndex: 6 },
  { key: "ago", label: "AGO", monthIndex: 7 },
  { key: "set", label: "SET", monthIndex: 8 },
  { key: "out", label: "OUT", monthIndex: 9 },
  { key: "nov", label: "NOV", monthIndex: 10 },
  { key: "dez", label: "DEZ", monthIndex: 11 },
];

const spreadsheetRows = [
  { category: "SN CONTABILIDADE", values: {} },
  { category: "ASAAS MARKETING", values: {} },
  { category: "ASAAS ROYALTIES", values: {} },
  { category: "SLS LOC OFICINA", values: {} },
  { category: "PREF.SOROCABA", values: {} },
  { category: "SLS - GESTÃO DA FROTA", values: {} },
  { category: "ASAAS - ADESÃO DAS MOTOS", values: {} },
  { category: "RECEITA", values: {} },
  { category: "OUTRO", values: {} },
];

const fallbackStorageKey = "tetoy-local-entries";
const supabaseConfig = {
  url: "https://wlrsieftnfqhwblklaat.supabase.co",
  publishableKey: "sb_publishable_YdKXt7020dV8YNjS3K6wiA_UCVAShra",
};

let supabaseClient = null;

const state = {
  activeView: null,
  selectedMonth: "ago",
  entries: [],
  storageMode: "browser",
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function loadFallbackEntries() {
  try {
    const saved = JSON.parse(localStorage.getItem(fallbackStorageKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveFallbackEntries() {
  localStorage.setItem(fallbackStorageKey, JSON.stringify(state.entries));
}

async function setupSupabase() {
  if (!window.supabase?.createClient) {
    state.storageMode = "browser";
    return;
  }

  supabaseClient = window.supabase.createClient(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
  );

  state.storageMode = "supabase";
}

async function loadEntries() {
  if (state.storageMode === "supabase") {
    const { data, error } = await supabaseClient
      .from("entries")
      .select("id, category, value, direction, date, note, created_at")
      .order("date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      console.warn("Erro ao carregar Supabase:", error);
      state.entries = [];
      return;
    }

    state.entries = data.map(normalizeSupabaseEntry);
    return;
  }

  if (window.location.protocol === "file:") {
    state.entries = loadFallbackEntries();
    return;
  }

  try {
    const response = await fetch("/api/entries");
    if (!response.ok) throw new Error(`API retornou ${response.status}`);

    const payload = await response.json();
    state.storageMode = "api";
    state.entries = Array.isArray(payload.entries) ? payload.entries : [];
  } catch (error) {
    console.warn("Usando armazenamento local do navegador:", error);
    state.storageMode = "browser";
    state.entries = loadFallbackEntries();
  }
}

function normalizeSupabaseEntry(entry) {
  return {
    id: entry.id,
    category: entry.category,
    value: Number(entry.value),
    direction: entry.direction,
    date: entry.date,
    note: entry.note || "",
    createdAt: entry.created_at,
  };
}

function categoryOptions() {
  return spreadsheetRows.map((row) => row.category);
}

function getMonthFromDate(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  return months.find((month) => month.monthIndex === date.getMonth())?.key || "jan";
}

function baseValueFor(category, monthKey) {
  return spreadsheetRows.find((row) => row.category === category)?.values[monthKey] || 0;
}

function entryValueFor(category, monthKey) {
  return state.entries
    .filter((entry) => entry.category === category && getMonthFromDate(entry.date) === monthKey)
    .reduce((total, entry) => total + entry.value, 0);
}

function valueFor(category, monthKey) {
  return baseValueFor(category, monthKey) + entryValueFor(category, monthKey);
}

function rowTotal(category) {
  return months.reduce((total, month) => total + valueFor(category, month.key), 0);
}

function monthTotal(monthKey) {
  return spreadsheetRows.reduce((total, row) => total + valueFor(row.category, monthKey), 0);
}

function annualTotal() {
  return months.reduce((total, month) => total + monthTotal(month.key), 0);
}

function insertedTotal(direction) {
  return state.entries
    .filter((entry) => entry.direction === direction)
    .reduce((total, entry) => total + entry.value, 0);
}

function showHome() {
  state.activeView = null;
  document.querySelector("#homeView").classList.remove("is-hidden");
  document.querySelector("#workspaceView").classList.add("is-hidden");
}

function showWorkspaceView(viewId) {
  state.activeView = viewId;
  document.querySelector("#homeView").classList.add("is-hidden");
  document.querySelector("#workspaceView").classList.remove("is-hidden");

  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.id !== viewId);
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.viewTarget === viewId);
  });

  render();
}

function populateControls() {
  const monthFilter = document.querySelector("#monthFilter");
  monthFilter.innerHTML = months
    .map((month) => `<option value="${month.key}">${month.label}</option>`)
    .join("");
  monthFilter.value = state.selectedMonth;

  const categorySelect = document.querySelector("#entryCategory");
  categorySelect.innerHTML = categoryOptions()
    .map((category) => `<option value="${category}">${category}</option>`)
    .join("");

  document.querySelector("#entryDate").value = new Date().toISOString().slice(0, 10);
}

function render() {
  renderAuth();
  renderMetrics();
  renderSpreadsheet();
  renderCharts();
  renderEntryHistory();
}

function renderAuth() {
  const isSupabase = state.storageMode === "supabase";

  document.querySelector("#authStatus").textContent = isSupabase
    ? "Acesso direto: visualize e insira dados sem login."
    : "Modo local temporário: os dados ficam neste navegador.";

  document.querySelector("#storageLabel").textContent = isSupabase ? "Supabase" : "Local";
  document.querySelector("#storageDetail").textContent = isSupabase
    ? "Dados persistentes sem login nesta versão."
    : "Fallback temporário no navegador.";

  const formFields = document.querySelectorAll("#entryForm input, #entryForm select, #entryForm button");
  formFields.forEach((field) => {
    field.disabled = false;
  });
}

function renderMetrics() {
  const selectedMonth = months.find((month) => month.key === state.selectedMonth);
  document.querySelector("#selectedMonthTotal").textContent = currency.format(
    monthTotal(state.selectedMonth),
  );
  document.querySelector("#selectedMonthLabel").textContent = `Total de ${selectedMonth.label}`;
  document.querySelector("#annualTotal").textContent = currency.format(annualTotal());
  document.querySelector("#creditTotal").textContent = currency.format(insertedTotal("credit"));
  document.querySelector("#debitTotal").textContent = currency.format(insertedTotal("debit"));

  const entryText = state.entries.length === 1 ? "1 lançamento inserido" : `${state.entries.length} lançamentos inseridos`;
  document.querySelector("#entryCount").textContent = entryText;
}

function renderSpreadsheet() {
  document.querySelector("#spreadsheetHead").innerHTML = `
    <tr>
      <th>Opção</th>
      ${months.map((month) => `<th class="amount-cell">${month.label}</th>`).join("")}
      <th class="amount-cell">TOTAL</th>
    </tr>
  `;

  document.querySelector("#spreadsheetRows").innerHTML = spreadsheetRows
    .map((row) => `
      <tr>
        <th>${row.category}</th>
        ${months
          .map((month) => {
            const value = valueFor(row.category, month.key);
            const highlight = month.key === state.selectedMonth ? " selected-month" : "";
            return `<td class="amount-cell${highlight}">${formatTableValue(value)}</td>`;
          })
          .join("")}
        <td class="amount-cell total-cell">${formatTableValue(rowTotal(row.category))}</td>
      </tr>
    `)
    .join("");

  document.querySelector("#spreadsheetFoot").innerHTML = `
    <tr>
      <th>Total</th>
      ${months
        .map((month) => {
          const highlight = month.key === state.selectedMonth ? " selected-month" : "";
          return `<td class="amount-cell total-cell${highlight}">${formatTableValue(monthTotal(month.key))}</td>`;
        })
        .join("")}
      <td class="amount-cell grand-total">${formatTableValue(annualTotal())}</td>
    </tr>
  `;
}

function renderCharts() {
  renderMonthlyChart();
  renderCategoryChart();
}

function renderMonthlyChart() {
  const canvas = document.querySelector("#monthlyChart");
  const items = months.map((month) => ({
    label: month.label,
    value: monthTotal(month.key),
    selected: month.key === state.selectedMonth,
  }));

  drawBarChart(canvas, items, {
    color: "#2c6fbb",
    selectedColor: "#17202a",
    maxBars: 12,
  });
}

function renderCategoryChart() {
  const canvas = document.querySelector("#categoryChart");
  const items = spreadsheetRows
    .map((row) => ({ label: compactLabel(row.category), value: Math.abs(rowTotal(row.category)) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  drawBarChart(canvas, items, {
    color: "#11875d",
    selectedColor: "#11875d",
    maxBars: 7,
  });
}

function drawBarChart(canvas, items, options) {
  const context = canvas.getContext("2d");
  const pixelRatio = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();
  const chartHeight = 260;

  canvas.width = Math.max(1, bounds.width * pixelRatio);
  canvas.height = chartHeight * pixelRatio;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, bounds.width, chartHeight);

  if (!items.length) {
    context.fillStyle = "#657384";
    context.font = "700 13px Inter, system-ui, sans-serif";
    context.fillText("Sem dados para exibir", 18, 34);
    return;
  }

  const padding = { top: 18, right: 18, bottom: 46, left: 58 };
  const width = bounds.width - padding.left - padding.right;
  const height = chartHeight - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...items.map((item) => item.value)) * 1.16;
  const groupWidth = width / Math.min(options.maxBars, items.length);
  const barWidth = Math.min(34, groupWidth * 0.48);
  const zeroY = padding.top + height;

  drawGrid(context, padding, width, height, maxValue);

  items.forEach((item, index) => {
    const groupX = padding.left + index * groupWidth + groupWidth / 2;
    const barHeight = (item.value / maxValue) * height;

    context.fillStyle = item.selected ? options.selectedColor : options.color;
    context.globalAlpha = item.selected ? 1 : 0.72;
    roundRect(context, groupX - barWidth / 2, zeroY - barHeight, barWidth, barHeight, 5);
    context.fill();
    context.globalAlpha = 1;

    context.fillStyle = "#657384";
    context.font = "700 11px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText(item.label, groupX, 242);
  });
}

function drawGrid(context, padding, width, height, maxValue) {
  context.strokeStyle = "#d9e0e8";
  context.lineWidth = 1;
  context.fillStyle = "#657384";
  context.font = "700 11px Inter, system-ui, sans-serif";
  context.textAlign = "right";

  for (let step = 0; step <= 4; step += 1) {
    const y = padding.top + (height / 4) * step;
    const value = maxValue - (maxValue / 4) * step;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(padding.left + width, y);
    context.stroke();
    context.fillText(compactCurrency(value), padding.left - 10, y + 4);
  }
}

function renderEntryHistory() {
  const rows = document.querySelector("#entryRows");
  document.querySelector("#localEntryCount").textContent =
    state.entries.length === 1 ? "1 registro" : `${state.entries.length} registros`;

  if (!state.entries.length) {
    rows.innerHTML = `
      <tr>
        <td colspan="5" class="empty-table-cell">Nenhum lançamento inserido ainda.</td>
      </tr>
    `;
    return;
  }

  rows.innerHTML = [...state.entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((entry) => {
      const typeLabel = entry.direction === "credit" ? "Crédito" : "Débito";
      const amountClass = entry.direction === "credit" ? "amount-income" : "amount-expense";
      return `
        <tr>
          <td>${shortDate.format(new Date(`${entry.date}T12:00:00`))}</td>
          <td>${entry.category}</td>
          <td><span class="status ${entry.direction === "credit" ? "ok" : "missing"}">${typeLabel}</span></td>
          <td class="amount-cell ${amountClass}">${currency.format(entry.value)}</td>
          <td>${entry.note || "-"}</td>
        </tr>
      `;
    })
    .join("");
}

async function handleEntrySubmit(event) {
  event.preventDefault();

  const value = Number(document.querySelector("#entryValue").value);
  if (!Number.isFinite(value) || value <= 0) return;

  const entry = {
    category: document.querySelector("#entryCategory").value,
    value,
    direction: document.querySelector("#entryDirection").value,
    date: document.querySelector("#entryDate").value,
    note: document.querySelector("#entryNote").value.trim(),
  };

  if (state.storageMode === "supabase") {
    const { data, error } = await supabaseClient
      .from("entries")
      .insert(entry)
      .select("id, category, value, direction, date, note, created_at")
      .single();

    if (error) {
      console.warn("Erro ao salvar no Supabase:", error);
      return;
    }

    state.entries.push(normalizeSupabaseEntry(data));
  } else if (state.storageMode === "api") {
    const response = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });

    if (!response.ok) return;

    const payload = await response.json();
    state.entries.push(payload.entry);
  } else {
    state.entries.push({
      id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()),
      ...entry,
    });
    saveFallbackEntries();
  }

  event.target.reset();
  document.querySelector("#entryDate").value = new Date().toISOString().slice(0, 10);
  showWorkspaceView("viewData");
}

async function clearEntries() {
  if (!state.entries.length) return;

  if (state.storageMode === "supabase") {
    const { error } = await supabaseClient.from("entries").delete().neq("id", 0);
    if (error) {
      console.warn("Erro ao limpar Supabase:", error);
      return;
    }
  } else if (state.storageMode === "api") {
    const response = await fetch("/api/entries", { method: "DELETE" });
    if (!response.ok) return;
  }

  state.entries = [];
  saveFallbackEntries();
  render();
}

function formatTableValue(value) {
  if (!value) return "-";
  return currency.format(value);
}

function compactCurrency(value) {
  if (value >= 1000) return `R$ ${Math.round(value / 1000)} mil`;
  return currency.format(value);
}

function compactLabel(label) {
  return label
    .replace("ASAAS - ", "")
    .replace("SLS ", "")
    .slice(0, 12);
}

function roundRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, Math.max(0, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

document.querySelectorAll("[data-view-target]").forEach((button) => {
  button.addEventListener("click", () => showWorkspaceView(button.dataset.viewTarget));
});

document.querySelector("#backHomeButton").addEventListener("click", showHome);

document.querySelector("#monthFilter").addEventListener("change", (event) => {
  state.selectedMonth = event.target.value;
  render();
});

document.querySelector("#entryForm").addEventListener("submit", handleEntrySubmit);
document.querySelector("#clearEntriesButton").addEventListener("click", clearEntries);
window.addEventListener("resize", () => {
  if (state.activeView === "viewData") renderCharts();
});

async function initializeApp() {
  await setupSupabase();
  await loadEntries();
  populateControls();
  showHome();
}

initializeApp();
