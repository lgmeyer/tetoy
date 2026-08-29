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

const defaultSpreadsheetRows = [
  { category: "SN CONTABILIDADE", direction: "debit", values: {} },
  { category: "ASAAS MARKETING", direction: "debit", values: {} },
  { category: "ASAAS ROYALTIES", direction: "debit", values: {} },
  { category: "SLS LOC OFICINA", direction: "debit", values: {} },
  { category: "PREF.SOROCABA", direction: "debit", values: {} },
  { category: "SLS - GESTÃO DA FROTA", direction: "debit", values: {} },
  { category: "ASAAS - ADESÃO DAS MOTOS", direction: "debit", values: {} },
  { category: "RECEITA", direction: "credit", values: {} },
  { category: "OUTRO", direction: "debit", values: {} },
];

let spreadsheetRows = defaultSpreadsheetRows.map((row) => ({ ...row }));

const fallbackStorageKey = "tetoy-local-entries";
const fallbackCategoryStorageKey = "tetoy-category-options";
const viabilityStorageKey = "tetoy-viability-scenarios";
const supabaseQueryTimeoutMs = 5000;
const supabaseConfig = {
  url: "https://wlrsieftnfqhwblklaat.supabase.co",
  publishableKey: "sb_publishable_YdKXt7020dV8YNjS3K6wiA_UCVAShra",
};

let supabaseClient = null;

const state = {
  appReady: false,
  activeView: null,
  selectedMonth: "ago",
  entries: [],
  storageMode: "browser",
  categoryStorageMode: "browser",
  scenarioStorageMode: "browser",
  scenarioStorageError: "",
  editingEntryId: null,
  asaasImportData: null,
  asaasImportFileName: "",
  viabilityScenarios: [],
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

const {
  positiveAmount,
  signedEntryAmount,
  summarizeEntries,
  calculateViability,
} = globalThis.DashboardCalculations;

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

function entrySignature(entry) {
  return [
    normalizeCategoryName(entry.category).toLocaleLowerCase("pt-BR"),
    Number(entry.value),
    entry.direction,
    entry.date,
    String(entry.note || "").trim(),
  ].join("|");
}

function mergeStoredEntries(primaryEntries, browserEntries) {
  const primaryIds = new Set(primaryEntries.map((entry) => String(entry.id)));
  const primarySignatures = new Set(primaryEntries.map(entrySignature));
  const browserOnlyEntries = browserEntries.filter(
    (entry) =>
      !primaryIds.has(String(entry.id)) && !primarySignatures.has(entrySignature(entry)),
  );

  return { entries: [...primaryEntries, ...browserOnlyEntries], browserOnlyEntries };
}

function loadFallbackCategoryOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(fallbackCategoryStorageKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveFallbackCategoryOptions() {
  const defaultNames = new Set(
    defaultSpreadsheetRows.map((row) => row.category.toLocaleLowerCase("pt-BR")),
  );
  const customOptions = spreadsheetRows
    .filter((row) => !defaultNames.has(row.category.toLocaleLowerCase("pt-BR")))
    .map((row) => ({ name: row.category, direction: row.direction }));
  localStorage.setItem(fallbackCategoryStorageKey, JSON.stringify(customOptions));
}

function loadViabilityScenarios() {
  try {
    const saved = JSON.parse(localStorage.getItem(viabilityStorageKey) || "[]");
    if (!Array.isArray(saved)) return [];

    return saved.map((scenario) => ({
      ...scenario,
      residualValue: Number(scenario.residualValue || 0),
      actualMonthlyFlows: Array.isArray(scenario.actualMonthlyFlows)
        ? scenario.actualMonthlyFlows
        : actualMonthlyFlowsFor(Number(scenario.months)),
    }));
  } catch {
    return [];
  }
}

function saveViabilityScenarios() {
  localStorage.setItem(viabilityStorageKey, JSON.stringify(state.viabilityScenarios));
}

function normalizeSupabaseScenario(scenario) {
  return {
    id: scenario.id,
    name: scenario.name,
    initialInvestment: Number(scenario.initial_investment),
    annualRate: Number(scenario.annual_rate),
    months: Number(scenario.months),
    monthlyNetInflow: Number(scenario.monthly_net_inflow),
    residualValue: Number(scenario.residual_value || 0),
    actualMonthlyFlows: Array.isArray(scenario.actual_monthly_flows)
      ? scenario.actual_monthly_flows
      : [],
    createdAt: scenario.created_at,
  };
}

function serializeSupabaseScenario(scenario) {
  return {
    id: scenario.id,
    name: scenario.name,
    initial_investment: scenario.initialInvestment,
    annual_rate: scenario.annualRate,
    months: scenario.months,
    monthly_net_inflow: scenario.monthlyNetInflow,
    residual_value: scenario.residualValue || 0,
    actual_monthly_flows: scenario.actualMonthlyFlows || [],
    created_at: scenario.createdAt,
  };
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), supabaseQueryTimeoutMs);
    let data;
    let error;

    try {
      ({ data, error } = await supabaseClient
        .from("entries")
        .select("id, category, value, direction, date, note, created_at")
        .order("date", { ascending: false })
        .order("id", { ascending: false })
        .abortSignal(controller.signal));
    } catch (requestError) {
      error = requestError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (error || !Array.isArray(data)) {
      console.warn("Erro ao carregar Supabase:", error);
      await loadEntriesWithoutSupabase();
      return;
    }

    const remoteEntries = data.map(normalizeSupabaseEntry);
    const browserEntries = loadFallbackEntries();

    if (!remoteEntries.length && browserEntries.length) {
      console.warn("Supabase sem lançamentos; recuperando os dados deste navegador.");
      state.storageMode = "browser";
      state.entries = browserEntries;
      return;
    }

    const merged = mergeStoredEntries(remoteEntries, browserEntries);
    state.entries = merged.entries;
    if (merged.browserOnlyEntries.length) state.storageMode = "browser";
    saveFallbackEntries();
    return;
  }

  await loadEntriesWithoutSupabase();
}

async function loadEntriesWithoutSupabase() {
  const browserEntries = loadFallbackEntries();

  if (window.location.protocol === "file:") {
    state.storageMode = "browser";
    state.entries = browserEntries;
    return;
  }

  try {
    const response = await fetch("/api/entries");
    if (!response.ok) throw new Error(`API retornou ${response.status}`);

    const payload = await response.json();
    const apiEntries = Array.isArray(payload.entries) ? payload.entries : [];

    if (!apiEntries.length && browserEntries.length) {
      state.storageMode = "browser";
      state.entries = browserEntries;
      return;
    }

    const merged = mergeStoredEntries(apiEntries, browserEntries);
    state.storageMode = merged.browserOnlyEntries.length ? "browser" : "api";
    state.entries = merged.entries;
    saveFallbackEntries();
  } catch (error) {
    console.warn("Usando armazenamento local do navegador:", error);
    state.storageMode = "browser";
    state.entries = browserEntries;
  }
}

function normalizeCategoryName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function mergeCategoryOptions(options = []) {
  const merged = [];
  const names = new Set();
  const candidates = [
    ...defaultSpreadsheetRows.map((row) => ({ name: row.category, direction: row.direction })),
    ...options,
    ...state.entries.map((entry) => ({ name: entry.category, direction: entry.direction })),
  ];

  candidates.forEach((option) => {
    const name = normalizeCategoryName(option?.name);
    const comparisonName = name.toLocaleLowerCase("pt-BR");
    if (!name || names.has(comparisonName)) return;
    names.add(comparisonName);
    merged.push({
      category: name,
      direction: option?.direction === "credit" ? "credit" : "debit",
      values: {},
    });
  });

  spreadsheetRows = merged;
}

async function loadCategoryOptions() {
  const browserOptions = loadFallbackCategoryOptions();

  if (state.storageMode === "supabase") {
    const { data, error } = await supabaseClient
      .from("category_options")
      .select("name, direction")
      .order("created_at", { ascending: true });

    if (!error) {
      state.categoryStorageMode = "supabase";
      mergeCategoryOptions([...(data || []), ...browserOptions]);
      return;
    }

    console.warn("Opções personalizadas serão salvas neste navegador:", error);
  } else if (state.storageMode === "api") {
    try {
      const response = await fetch("/api/category-options");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || `API retornou ${response.status}`);
      state.categoryStorageMode = "api";
      mergeCategoryOptions(payload.options);
      return;
    } catch (error) {
      console.warn("Opções personalizadas serão salvas neste navegador:", error);
    }
  }

  state.categoryStorageMode = "browser";
  mergeCategoryOptions(browserOptions);
}

async function loadStoredViabilityScenarios() {
  const browserScenarios = loadViabilityScenarios();

  if (state.storageMode === "supabase") {
    const { data, error } = await supabaseClient
      .from("viability_scenarios")
      .select("id, name, initial_investment, annual_rate, months, monthly_net_inflow, residual_value, actual_monthly_flows, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Erro ao carregar cenários do Supabase:", error);
      state.scenarioStorageMode = "unavailable";
      state.scenarioStorageError =
        "A tabela de cenários ainda não está disponível no Supabase. Aplique a migração antes de salvar em produção.";
      state.viabilityScenarios = browserScenarios;
      return;
    }

    state.scenarioStorageMode = "supabase";
    state.scenarioStorageError = "";
    const remoteScenarios = data.map(normalizeSupabaseScenario);
    const remoteIds = new Set(remoteScenarios.map((scenario) => String(scenario.id)));
    const localOnlyScenarios = browserScenarios.filter(
      (scenario) => !remoteIds.has(String(scenario.id)),
    );

    if (localOnlyScenarios.length) {
      const { data: migratedData, error: migrationError } = await supabaseClient
        .from("viability_scenarios")
        .upsert(localOnlyScenarios.map(serializeSupabaseScenario), { onConflict: "id" })
        .select("id, name, initial_investment, annual_rate, months, monthly_net_inflow, residual_value, actual_monthly_flows, created_at");

      if (migrationError) {
        console.warn("Erro ao migrar cenários locais para o Supabase:", migrationError);
        state.scenarioStorageError =
          "Os cenários da base foram carregados, mas alguns cenários deste navegador não puderam ser migrados.";
      } else {
        remoteScenarios.push(...migratedData.map(normalizeSupabaseScenario));
        localStorage.removeItem(viabilityStorageKey);
      }
    }

    state.viabilityScenarios = remoteScenarios.sort(
      (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
    );
    return;
  }

  if (state.storageMode === "api") {
    try {
      const response = await fetch("/api/viability-scenarios");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || `API retornou ${response.status}`);
      state.scenarioStorageMode = "api";
      state.scenarioStorageError = "";
      state.viabilityScenarios = Array.isArray(payload.scenarios) ? payload.scenarios : [];
      return;
    } catch (error) {
      console.warn("Erro ao carregar cenários da API:", error);
      state.scenarioStorageError = "Não foi possível acessar o armazenamento de cenários.";
    }
  }

  state.scenarioStorageMode = "browser";
  state.viabilityScenarios = browserScenarios;
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

function signedBaseValueFor(category, monthKey) {
  const row = spreadsheetRows.find((item) => item.category === category);
  const amount = positiveAmount(row?.values[monthKey]);
  return row?.direction === "debit" ? -amount : amount;
}

function entryValueFor(category, monthKey) {
  return state.entries
    .filter((entry) => entry.category === category && getMonthFromDate(entry.date) === monthKey)
    .reduce((total, entry) => total + signedEntryAmount(entry), 0);
}

function entriesForCell(category, monthKey) {
  return state.entries.filter(
    (entry) => entry.category === category && getMonthFromDate(entry.date) === monthKey,
  );
}

function valueFor(category, monthKey) {
  return signedBaseValueFor(category, monthKey) + entryValueFor(category, monthKey);
}

function rowTotal(category) {
  return months.reduce((total, month) => total + valueFor(category, month.key), 0);
}

function monthTotal(monthKey) {
  return spreadsheetRows.reduce((total, row) => total + valueFor(row.category, monthKey), 0);
}

function monthHasData(monthKey) {
  const hasBaseValue = spreadsheetRows.some(
    (row) => positiveAmount(baseValueFor(row.category, monthKey)) > 0,
  );
  return hasBaseValue || state.entries.some((entry) => getMonthFromDate(entry.date) === monthKey);
}

function actualMonthlyFlowsFor(term) {
  return Array.from({ length: term }, (_, index) => {
    const month = months[index];
    return month && monthHasData(month.key) ? monthTotal(month.key) : null;
  });
}

function projectPeriodLabel(index) {
  const date = new Date(2026, index, 1);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(date)
    .replace(".", "");
  return `${monthLabel}/${String(date.getFullYear()).slice(-2)}`;
}

function monthBreakdown(monthKey) {
  const entries = state.entries.filter((entry) => getMonthFromDate(entry.date) === monthKey);
  const summary = summarizeEntries(entries);

  spreadsheetRows.forEach((row) => {
    const amount = positiveAmount(baseValueFor(row.category, monthKey));
    if (!amount) return;

    summary[row.direction] += amount;
    summary.net += row.direction === "debit" ? -amount : amount;
  });

  return summary;
}

function annualTotal() {
  return months.reduce((total, month) => total + monthTotal(month.key), 0);
}

function insertedTotal(direction) {
  return state.entries
    .filter((entry) => entry.direction === direction)
    .reduce((total, entry) => total + positiveAmount(entry.value), 0);
}

function showHome() {
  state.activeView = null;
  document.querySelector("#homeView").classList.remove("is-hidden");
  document.querySelector("#workspaceView").classList.add("is-hidden");
}

function showWorkspaceView(viewId) {
  if (!state.appReady) return;

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

function setAppLoading(isLoading) {
  const homeView = document.querySelector("#homeView");
  const loadingStatus = document.querySelector("#appLoadingStatus");

  homeView.setAttribute("aria-busy", String(isLoading));
  loadingStatus.classList.toggle("is-hidden", !isLoading);
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.disabled = isLoading;
  });
}

function populateControls() {
  const monthFilter = document.querySelector("#monthFilter");
  monthFilter.innerHTML = months
    .map((month) => `<option value="${month.key}">${month.label}</option>`)
    .join("");
  monthFilter.value = state.selectedMonth;

  refreshCategoryControls();

  document.querySelector("#entryDate").value = new Date().toISOString().slice(0, 10);
}

function refreshCategoryControls(selectedCategory = "") {
  const entryCategory = document.querySelector("#entryCategory");
  const editEntryCategory = document.querySelector("#editEntryCategory");
  const previousEntryCategory = selectedCategory || entryCategory.value;
  const previousEditCategory = editEntryCategory.value;
  const categoryMarkup = categoryOptions()
    .map(
      (category) =>
        `<option value="${escapeAttribute(category)}">${escapeHtml(category)}</option>`,
    )
    .join("");
  entryCategory.innerHTML = categoryMarkup;
  editEntryCategory.innerHTML = categoryMarkup;

  if (categoryOptions().includes(previousEntryCategory)) {
    entryCategory.value = previousEntryCategory;
  }
  if (categoryOptions().includes(previousEditCategory)) {
    editEntryCategory.value = previousEditCategory;
  }
}

function render() {
  renderAuth();
  renderScenarioStorage();
  renderMetrics();
  renderSpreadsheet();
  if (state.activeView === "viewData") renderCharts();
  renderEntryHistory();
  if (state.asaasImportData) renderAsaasPreview();
  renderViability();
  renderSavedScenarios();
}

function renderScenarioStorage() {
  const badge = document.querySelector("#scenarioStorageBadge");
  const labels = {
    supabase: "Cenários salvos no Supabase",
    api: "Cenários salvos no servidor",
    browser: "Cenários salvos neste navegador",
    unavailable: "Configuração do Supabase pendente",
  };
  badge.textContent = labels[state.scenarioStorageMode] || "Armazenamento indisponível";
  badge.dataset.tone = state.scenarioStorageMode === "unavailable" ? "warning" : "success";
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
  document.querySelector("#monthFilter").value = state.selectedMonth;
  setSignedAmount("#selectedMonthTotal", monthTotal(state.selectedMonth));
  document.querySelector("#selectedMonthLabel").textContent = `Total de ${selectedMonth.label}`;
  setSignedAmount("#annualTotal", annualTotal());
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
        <th>${escapeHtml(row.category)}</th>
        ${months
          .map((month) => {
            const value = valueFor(row.category, month.key);
            const highlight = month.key === state.selectedMonth ? " selected-month" : "";
            const amountTone = amountToneClass(value);
            const cellEntries = entriesForCell(row.category, month.key);

            if (!cellEntries.length) {
              return `<td class="amount-cell${highlight}${amountTone}">${formatTableValue(value)}</td>`;
            }

            const entryLabel = cellEntries.length === 1 ? "1 lançamento" : `${cellEntries.length} lançamentos`;
            return `
              <td class="amount-cell editable-spreadsheet-cell${highlight}${amountTone}">
                <button
                  class="spreadsheet-edit-button${amountTone}"
                  type="button"
                  data-category="${escapeAttribute(row.category)}"
                  data-month="${month.key}"
                  aria-label="Editar ${entryLabel} de ${escapeAttribute(row.category)} em ${month.label}"
                >
                  <span>${formatTableValue(value)}</span>
                  <small>${entryLabel}</small>
                </button>
              </td>
            `;
          })
          .join("")}
        <td class="amount-cell total-cell${amountToneClass(rowTotal(row.category))}">${formatTableValue(rowTotal(row.category))}</td>
      </tr>
    `)
    .join("");

  document.querySelector("#spreadsheetFoot").innerHTML = `
    <tr>
      <th>Total</th>
      ${months
        .map((month) => {
          const highlight = month.key === state.selectedMonth ? " selected-month" : "";
          const total = monthTotal(month.key);
          return `<td class="amount-cell total-cell${highlight}${amountToneClass(total)}">${formatTableValue(total)}</td>`;
        })
        .join("")}
      <td class="amount-cell grand-total${amountToneClass(annualTotal())}">${formatTableValue(annualTotal())}</td>
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
    ...monthBreakdown(month.key),
    selected: month.key === state.selectedMonth,
  }));

  canvas.setAttribute(
    "aria-label",
    `Gráfico mensal. ${items
      .map((item) => `${item.label}: crédito ${currency.format(item.credit)}, débito ${currency.format(item.debit)}, resultado ${currency.format(item.net)}`)
      .join("; ")}.`,
  );
  drawMonthlyCashFlowChart(canvas, items);
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

function drawMonthlyCashFlowChart(canvas, items) {
  const context = canvas.getContext("2d");
  const pixelRatio = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();
  const chartHeight = 300;

  if (bounds.width <= 0) return;

  canvas.width = Math.max(1, bounds.width * pixelRatio);
  canvas.height = chartHeight * pixelRatio;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, bounds.width, chartHeight);

  const padding = { top: 32, right: 16, bottom: 42, left: 62 };
  const width = bounds.width - padding.left - padding.right;
  const height = chartHeight - padding.top - padding.bottom;
  const halfHeight = height / 2;
  const zeroY = padding.top + halfHeight;
  const maxMagnitude = Math.max(
    1,
    ...items.flatMap((item) => [item.credit, item.debit, Math.abs(item.net)]),
  ) * 1.14;
  const groupWidth = width / items.length;
  const barWidth = Math.min(12, groupWidth * 0.24);
  const barGap = Math.min(4, groupWidth * 0.08);

  drawSignedGrid(context, padding, width, halfHeight, maxMagnitude, zeroY);

  items.forEach((item, index) => {
    const groupX = padding.left + index * groupWidth + groupWidth / 2;
    const creditHeight = (item.credit / maxMagnitude) * halfHeight;
    const debitHeight = (item.debit / maxMagnitude) * halfHeight;

    context.globalAlpha = item.selected ? 1 : 0.78;
    context.fillStyle = "#11875d";
    roundRect(
      context,
      groupX - barGap / 2 - barWidth,
      zeroY - creditHeight,
      barWidth,
      creditHeight,
      4,
    );
    context.fill();

    context.fillStyle = "#8b2525";
    roundRect(context, groupX + barGap / 2, zeroY, barWidth, debitHeight, 4);
    context.fill();
    context.globalAlpha = 1;

    context.fillStyle = item.selected ? "#17202a" : "#657384";
    context.font = `${item.selected ? 850 : 700} 10px Inter, system-ui, sans-serif`;
    context.textAlign = "center";
    context.fillText(item.label, groupX, chartHeight - 14);
  });

  context.beginPath();
  items.forEach((item, index) => {
    const x = padding.left + index * groupWidth + groupWidth / 2;
    const y = zeroY - (item.net / maxMagnitude) * halfHeight;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = "#17202a";
  context.lineWidth = 2;
  context.stroke();

  items.forEach((item, index) => {
    const x = padding.left + index * groupWidth + groupWidth / 2;
    const y = zeroY - (item.net / maxMagnitude) * halfHeight;

    context.beginPath();
    context.arc(x, y, item.selected ? 4.5 : 3, 0, Math.PI * 2);
    context.fillStyle = item.selected ? "#2c6fbb" : "#17202a";
    context.fill();
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.5;
    context.stroke();

    if (item.credit || item.debit) {
      const labelY = item.net >= 0
        ? Math.max(padding.top + 8, y - 8)
        : Math.min(chartHeight - padding.bottom - 3, y + 14);
      context.fillStyle = item.net < 0 ? "#8b2525" : "#17202a";
      context.font = "800 9px Inter, system-ui, sans-serif";
      context.textAlign = "center";
      context.fillText(compactChartCurrency(item.net), x, labelY);
    }
  });
}

function drawSignedGrid(context, padding, width, halfHeight, maxMagnitude, zeroY) {
  const steps = [1, 0.5, 0, -0.5, -1];

  context.font = "700 10px Inter, system-ui, sans-serif";
  context.textAlign = "right";

  steps.forEach((step) => {
    const y = zeroY - step * halfHeight;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(padding.left + width, y);
    context.strokeStyle = step === 0 ? "#8996a5" : "#d9e0e8";
    context.lineWidth = step === 0 ? 1.5 : 1;
    context.stroke();
    context.fillStyle = step < 0 ? "#8b2525" : "#657384";
    context.fillText(compactCurrency(maxMagnitude * step), padding.left - 9, y + 4);
  });
}

function drawBarChart(canvas, items, options) {
  const context = canvas.getContext("2d");
  const pixelRatio = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();
  const chartHeight = 260;

  if (bounds.width <= 0) return;

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
        <td colspan="6" class="empty-table-cell">Nenhum lançamento inserido ainda.</td>
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
          <td>${escapeHtml(entry.category)}</td>
          <td><span class="status ${entry.direction === "credit" ? "ok" : "missing"}">${typeLabel}</span></td>
          <td class="amount-cell ${amountClass}">${currency.format(entry.value)}</td>
          <td>${escapeHtml(entry.note || "-")}</td>
          <td class="actions-cell">
            <button class="edit-entry-button" type="button" data-entry-id="${escapeAttribute(String(entry.id))}">
              Editar
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function openEntryEditor(entryIds) {
  const entries = entryIds
    .map((entryId) => state.entries.find((entry) => String(entry.id) === String(entryId)))
    .filter(Boolean);

  if (!entries.length) return;

  const pickerField = document.querySelector("#editEntryPickerField");
  const picker = document.querySelector("#editEntryPicker");
  pickerField.classList.toggle("is-hidden", entries.length === 1);
  picker.innerHTML = entries
    .map((entry) => {
      const typeLabel = entry.direction === "credit" ? "Crédito" : "Débito";
      const label = `${formatDate(entry.date)} · ${typeLabel} · ${currency.format(entry.value)}${entry.note ? ` · ${entry.note}` : ""}`;
      return `<option value="${escapeAttribute(String(entry.id))}">${escapeHtml(label)}</option>`;
    })
    .join("");

  fillEntryEditor(entries[0]);
  document.querySelector("#editEntryFeedback").textContent = "";

  const dialog = document.querySelector("#editEntryDialog");
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function fillEntryEditor(entry) {
  state.editingEntryId = entry.id;
  document.querySelector("#editEntryPicker").value = String(entry.id);
  document.querySelector("#editEntryCategory").value = entry.category;
  document.querySelector("#editEntryValue").value = entry.value;
  document.querySelector("#editEntryDirection").value = entry.direction;
  document.querySelector("#editEntryDate").value = entry.date;
  document.querySelector("#editEntryNote").value = entry.note || "";
}

function closeEntryEditor() {
  const dialog = document.querySelector("#editEntryDialog");
  if (dialog.open && typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
    resetEntryEditor();
  }
}

function resetEntryEditor() {
  state.editingEntryId = null;
  document.querySelector("#editEntryForm").reset();
  document.querySelector("#editEntryFeedback").textContent = "";
}

async function handleEditEntrySubmit(event) {
  event.preventDefault();

  const value = Number(document.querySelector("#editEntryValue").value);
  const feedback = document.querySelector("#editEntryFeedback");
  const submitButton = document.querySelector("#saveEditEntryButton");

  if (!state.editingEntryId || !Number.isFinite(value) || value <= 0) {
    feedback.textContent = "Informe um valor maior que zero.";
    return;
  }

  const changes = {
    category: document.querySelector("#editEntryCategory").value,
    value,
    direction: document.querySelector("#editEntryDirection").value,
    date: document.querySelector("#editEntryDate").value,
    note: document.querySelector("#editEntryNote").value.trim(),
  };

  submitButton.disabled = true;
  feedback.textContent = "Salvando alterações…";

  try {
    const updatedEntry = await updateEntry(state.editingEntryId, changes);
    state.entries = state.entries.map((entry) =>
      String(entry.id) === String(updatedEntry.id) ? updatedEntry : entry,
    );

    saveFallbackEntries();

    render();
    closeEntryEditor();
  } catch (error) {
    console.warn("Erro ao atualizar lançamento:", error);
    feedback.textContent = error.message || "Não foi possível salvar as alterações.";
  } finally {
    submitButton.disabled = false;
  }
}

async function updateEntry(entryId, changes) {
  if (state.storageMode === "supabase") {
    const { data, error } = await supabaseClient
      .from("entries")
      .update(changes)
      .eq("id", entryId)
      .select("id, category, value, direction, date, note, created_at")
      .single();

    if (error) throw new Error(error.message || "Não foi possível atualizar no Supabase.");
    return normalizeSupabaseEntry(data);
  }

  if (state.storageMode === "api") {
    const response = await fetch(`/api/entries/${encodeURIComponent(entryId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || "Não foi possível atualizar o lançamento.");
    }

    return payload.entry;
  }

  const currentEntry = state.entries.find((entry) => String(entry.id) === String(entryId));
  if (!currentEntry) throw new Error("Lançamento não encontrado.");
  return { ...currentEntry, ...changes };
}

async function createEntry(entry) {
  if (state.storageMode === "supabase") {
    const { data, error } = await supabaseClient
      .from("entries")
      .insert(entry)
      .select("id, category, value, direction, date, note, created_at")
      .single();

    if (error) throw new Error(error.message || "Não foi possível salvar no Supabase.");
    return normalizeSupabaseEntry(data);
  }

  if (state.storageMode === "api") {
    const response = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || "Não foi possível salvar o lançamento.");
    }

    return payload.entry;
  }

  return {
    id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()),
    ...entry,
  };
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

  try {
    state.entries.push(await createEntry(entry));
    saveFallbackEntries();
  } catch (error) {
    console.warn("Erro ao salvar lançamento:", error);
    return;
  }

  event.target.reset();
  document.querySelector("#entryDate").value = new Date().toISOString().slice(0, 10);
  showWorkspaceView("viewData");
}

function openNewCategoryDialog() {
  const dialog = document.querySelector("#newCategoryDialog");
  document.querySelector("#newCategoryFeedback").textContent = "";
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
  document.querySelector("#newCategoryName").focus();
}

function closeNewCategoryDialog() {
  const dialog = document.querySelector("#newCategoryDialog");
  if (dialog.open && typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
    resetNewCategoryForm();
  }
}

function resetNewCategoryForm() {
  document.querySelector("#newCategoryForm").reset();
  document.querySelector("#newCategoryFeedback").textContent = "";
}

async function createCategoryOption(option) {
  if (state.categoryStorageMode === "supabase") {
    const { data, error } = await supabaseClient
      .from("category_options")
      .insert(option)
      .select("name, direction")
      .single();
    if (error) throw new Error(error.message || "Não foi possível criar a opção no Supabase.");
    return data;
  }

  if (state.categoryStorageMode === "api") {
    const response = await fetch("/api/category-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(option),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "Não foi possível criar a opção.");
    }
    return payload.option;
  }

  return option;
}

async function handleNewCategorySubmit(event) {
  event.preventDefault();

  const name = normalizeCategoryName(document.querySelector("#newCategoryName").value);
  const feedback = document.querySelector("#newCategoryFeedback");
  const submitButton = document.querySelector("#saveNewCategoryButton");
  const existingCategory = categoryOptions().find(
    (category) => category.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
  );

  if (!name || name.length > 80) {
    feedback.textContent = "Informe um nome com até 80 caracteres.";
    return;
  }

  if (existingCategory) {
    refreshCategoryControls(existingCategory);
    closeNewCategoryDialog();
    return;
  }

  submitButton.disabled = true;
  feedback.textContent = "Criando opção…";

  try {
    const option = await createCategoryOption({
      name,
      direction: document.querySelector("#entryDirection").value,
    });
    spreadsheetRows.push({
      category: option.name,
      direction: option.direction === "credit" ? "credit" : "debit",
      values: {},
    });
    if (state.categoryStorageMode === "browser") saveFallbackCategoryOptions();
    refreshCategoryControls(option.name);
    render();
    closeNewCategoryDialog();
  } catch (error) {
    console.warn("Erro ao criar opção da planilha:", error);
    feedback.textContent = error.message || "Não foi possível criar a opção.";
  } finally {
    submitButton.disabled = false;
  }
}

async function handleAsaasFileChange(event) {
  const file = event.target.files?.[0];
  state.asaasImportData = null;
  state.asaasImportFileName = "";
  document.querySelector("#asaasPreview").classList.add("is-hidden");

  if (!file) {
    setAsaasImportFeedback("");
    return;
  }

  setAsaasImportFeedback("Processando o extrato…");

  try {
    if (!globalThis.AsaasCsv?.parseAsaasStatement) {
      throw new Error("O processador de extratos não foi carregado.");
    }

    state.asaasImportData = globalThis.AsaasCsv.parseAsaasStatement(await file.text());
    state.asaasImportFileName = file.name;
    renderAsaasPreview();
  } catch (error) {
    console.warn("Erro ao processar extrato Asaas:", error);
    setAsaasImportFeedback(error.message || "Não foi possível processar o arquivo.", "error");
  }
}

function renderAsaasPreview() {
  const data = state.asaasImportData;
  const preview = document.querySelector("#asaasPreview");
  if (!data) {
    preview.classList.add("is-hidden");
    return;
  }

  preview.classList.remove("is-hidden");
  document.querySelector("#asaasPreviewPeriod").textContent = `Período: ${data.period.label}`;
  document.querySelector("#asaasPreviewFile").textContent = state.asaasImportFileName;
  document.querySelector("#asaasGrossRevenue").textContent = currency.format(data.grossRevenue);
  document.querySelector("#asaasFeesTotal").textContent = `− ${currency.format(data.feesTotal)}`;
  document.querySelector("#asaasNetRevenue").textContent = currency.format(data.netRevenue);
  document.querySelector("#asaasChargeCount").textContent = countLabel(
    data.chargeCount,
    "cobrança",
    "cobranças",
  );
  document.querySelector("#asaasFeeCount").textContent = countLabel(data.feeCount, "taxa", "taxas");
  document.querySelector("#asaasPixIgnored").textContent = `${countLabel(
    data.pixWithdrawalCount,
    "retirada",
    "retiradas",
  )} · ${currency.format(Math.abs(data.pixWithdrawalsTotal))}`;
  document.querySelector("#asaasOtherIgnored").textContent = `${countLabel(
    data.otherMovementCount,
    "movimento",
    "movimentos",
  )} · ${currency.format(Math.abs(data.otherMovementsTotal))}`;

  const existingEntry = findAsaasImportEntry(data.period.key);
  const saveButton = document.querySelector("#saveAsaasRevenueButton");
  saveButton.textContent = existingEntry
    ? "Atualizar receita já lançada"
    : "Lançar receita líquida";
  saveButton.disabled = false;

  if (data.positiveFeeCount) {
    setAsaasImportFeedback(
      "Atenção: há taxas com valor positivo. Elas foram tratadas como custo pelo valor absoluto.",
      "warning",
    );
  } else if (existingEntry) {
    setAsaasImportFeedback(
      "Já existe uma importação deste período. O lançamento existente será atualizado, sem duplicação.",
      "warning",
    );
  } else {
    setAsaasImportFeedback("Extrato processado. Confira a prévia antes de lançar.");
  }
}

async function saveAsaasRevenue() {
  const data = state.asaasImportData;
  if (!data) return;

  const saveButton = document.querySelector("#saveAsaasRevenueButton");
  const existingEntry = findAsaasImportEntry(data.period.key);
  const entry = {
    category: "RECEITA",
    value: data.netRevenue,
    direction: "credit",
    date: data.period.end,
    note: buildAsaasImportNote(data, state.asaasImportFileName),
  };

  saveButton.disabled = true;
  setAsaasImportFeedback(existingEntry ? "Atualizando lançamento…" : "Salvando lançamento…");

  try {
    if (existingEntry) {
      const updatedEntry = await updateEntry(existingEntry.id, entry);
      state.entries = state.entries.map((item) =>
        String(item.id) === String(updatedEntry.id) ? updatedEntry : item,
      );
    } else {
      state.entries.push(await createEntry(entry));
    }

    saveFallbackEntries();

    state.selectedMonth = months[Number(data.period.key.slice(5, 7)) - 1]?.key || state.selectedMonth;
    render();
    setAsaasImportFeedback(
      existingEntry
        ? "Receita líquida atualizada com sucesso, sem criar duplicidade."
        : "Receita líquida lançada com sucesso.",
      "success",
    );
  } catch (error) {
    console.warn("Erro ao salvar receita Asaas:", error);
    setAsaasImportFeedback(error.message || "Não foi possível salvar a receita líquida.", "error");
    saveButton.disabled = false;
  }
}

function findAsaasImportEntry(periodKey) {
  const marker = `Importação Asaas ${periodKey} |`;
  return state.entries.find(
    (entry) => entry.category === "RECEITA"
      && entry.direction === "credit"
      && String(entry.note || "").startsWith(marker),
  );
}

function buildAsaasImportNote(data, fileName) {
  return [
    `Importação Asaas ${data.period.key}`,
    `${data.chargeCount} cobranças: ${currency.format(data.grossRevenue)}`,
    `${data.feeCount} taxas: ${currency.format(data.feesTotal)}`,
    `arquivo: ${fileName}`,
  ].join(" | ");
}

function setAsaasImportFeedback(message, tone = "") {
  const feedback = document.querySelector("#asaasImportFeedback");
  feedback.textContent = message;
  if (tone) {
    feedback.dataset.tone = tone;
  } else {
    delete feedback.dataset.tone;
  }
}

function countLabel(value, singular, plural) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function readViabilityAssumptions() {
  const investmentField = document.querySelector("#initialInvestment");
  const rateField = document.querySelector("#minimumAttractiveRate");
  const termField = document.querySelector("#projectTermMonths");
  const inflowField = document.querySelector("#monthlyNetInflow");
  const residualField = document.querySelector("#residualValue");

  if (
    [investmentField, rateField, termField, inflowField, residualField]
      .some((field) => field.value === "")
  ) {
    return null;
  }

  const term = Number(termField.value);
  const assumptions = {
    initialInvestment: Number(investmentField.value),
    annualRate: Number(rateField.value) / 100,
    months: term,
    monthlyNetInflow: Number(inflowField.value),
    residualValue: Number(residualField.value),
    actualMonthlyFlows: actualMonthlyFlowsFor(term),
  };

  return calculateViability(assumptions) ? assumptions : null;
}

function renderViability() {
  const assumptions = readViabilityAssumptions();
  const result = assumptions ? calculateViability(assumptions) : null;
  const panel = document.querySelector(".viability-results-panel");
  const status = document.querySelector("#viabilityStatus");
  const npv = document.querySelector("#npvValue");

  if (!result) {
    ["#npvValue", "#irrValue", "#paybackValue", "#monthlyRateValue", "#totalNetReturnValue"]
      .forEach((selector) => {
        document.querySelector(selector).textContent = "—";
      });
    status.textContent = "Aguardando dados";
    status.className = "status neutral";
    delete panel.dataset.viable;
    npv.classList.remove("negative-amount");
    document.querySelector("#viabilityExplanation").textContent =
      "Preencha as cinco premissas para calcular a viabilidade deste cenário.";
    renderViabilityCashFlowChart(null, null);
    return;
  }

  const isViable = result.npv >= 0;
  panel.dataset.viable = String(isViable);
  status.textContent = isViable ? "Viável pela TMA" : "Abaixo da TMA";
  status.className = `status ${isViable ? "ok" : "missing"}`;
  npv.textContent = currency.format(result.npv);
  npv.classList.toggle("negative-amount", result.npv < 0);
  document.querySelector("#irrValue").textContent = result.annualIrr === null
    ? "Não calculável"
    : formatPercent(result.annualIrr);
  document.querySelector("#paybackValue").textContent = result.paybackMonths === null
    ? "Não recuperado"
    : formatMonths(result.paybackMonths);
  document.querySelector("#monthlyRateValue").textContent = formatPercent(result.monthlyRate);
  document.querySelector("#totalNetReturnValue").textContent = currency.format(result.totalNetReturn);
  document.querySelector("#viabilityExplanation").textContent = isViable
    ? `O VPL é positivo: este cenário supera a TMA de ${formatPercent(assumptions.annualRate)} ao ano. O cálculo usa ${countLabel(result.actualPeriodCount, "mês realizado", "meses realizados")} e ${countLabel(result.projectedPeriodCount, "mês projetado", "meses projetados")}.`
    : `O VPL é negativo: este cenário não alcança a TMA de ${formatPercent(assumptions.annualRate)} ao ano. O cálculo usa ${countLabel(result.actualPeriodCount, "mês realizado", "meses realizados")} e ${countLabel(result.projectedPeriodCount, "mês projetado", "meses projetados")}.`;
  renderViabilityCashFlowChart(assumptions, result);
}

function renderViabilityCashFlowChart(assumptions, result) {
  const canvas = document.querySelector("#viabilityCashFlowChart");
  const help = document.querySelector("#viabilityChartHelp");

  if (!assumptions || !result) {
    canvas.setAttribute("aria-label", "Fluxo de caixa do projeto aguardando preenchimento");
    help.textContent = "Preencha as premissas para visualizar o fluxo de caixa.";
    clearCanvas(canvas);
    return;
  }

  const basePeriodFlows = result.periodFlows.map((value, index) =>
    index === result.periodFlows.length - 1 ? value - assumptions.residualValue : value,
  );
  const items = [
    { label: "Início", value: -assumptions.initialInvestment, type: "investment" },
    ...basePeriodFlows.map((value, index) => ({
      label: projectPeriodLabel(index),
      value,
      type: assumptions.actualMonthlyFlows[index] === null
        || assumptions.actualMonthlyFlows[index] === undefined
        ? "projected"
        : "actual",
    })),
  ];

  const accessibleItems = items.slice(0, 60).map(
    (item) => `${item.label}: ${currency.format(item.value)} (${cashFlowTypeLabel(item.type)})`,
  );
  const truncatedLabel = items.length > 60 ? `; e mais ${items.length - 60} períodos` : "";
  canvas.setAttribute(
    "aria-label",
    `Fluxo de caixa do projeto. ${accessibleItems.join("; ")}${truncatedLabel}. Valor residual de ${currency.format(assumptions.residualValue)} no último mês.`,
  );
  help.textContent = `${countLabel(result.actualPeriodCount, "mês usa", "meses usam")} dados de “Visualizar dados”; ${countLabel(result.projectedPeriodCount, "mês usa", "meses usam")} a entrada líquida projetada. O residual de ${currency.format(assumptions.residualValue)} entra em ${projectPeriodLabel(assumptions.months - 1)}.`;

  if (state.activeView !== "viabilitySimulation") return;
  drawViabilityCashFlowChart(canvas, items, assumptions.residualValue);
}

function drawViabilityCashFlowChart(canvas, items, residualValue) {
  const context = canvas.getContext("2d");
  const wrapper = canvas.closest(".viability-chart-wrap");
  const pixelRatio = window.devicePixelRatio || 1;
  const safeCanvasWidth = Math.floor(16000 / pixelRatio);
  const cssWidth = Math.max(
    wrapper.clientWidth - 2,
    Math.min(safeCanvasWidth, items.length * 52 + 80),
  );
  const chartHeight = 320;

  canvas.style.width = `${cssWidth}px`;
  canvas.width = Math.max(1, Math.round(cssWidth * pixelRatio));
  canvas.height = chartHeight * pixelRatio;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssWidth, chartHeight);

  const padding = { top: 30, right: 24, bottom: 48, left: 72 };
  const width = cssWidth - padding.left - padding.right;
  const height = chartHeight - padding.top - padding.bottom;
  const lastBaseValue = items.at(-1).value;
  const values = [...items.map((item) => item.value), lastBaseValue + residualValue, 0];
  let minValue = Math.min(...values);
  let maxValue = Math.max(...values);
  const rangePadding = Math.max(1, (maxValue - minValue) * 0.12);
  minValue -= rangePadding;
  maxValue += rangePadding;

  const yForValue = (value) => padding.top + ((maxValue - value) / (maxValue - minValue)) * height;
  const zeroY = yForValue(0);
  const groupWidth = width / items.length;
  const barWidth = Math.max(6, Math.min(26, groupWidth * 0.58));

  [minValue, 0, maxValue].forEach((value) => {
    const y = yForValue(value);
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(padding.left + width, y);
    context.strokeStyle = value === 0 ? "#8996a5" : "#d9e0e8";
    context.lineWidth = value === 0 ? 1.5 : 1;
    context.stroke();
    context.fillStyle = "#657384";
    context.font = "700 10px Inter, system-ui, sans-serif";
    context.textAlign = "right";
    context.fillText(compactCurrency(value), padding.left - 10, y + 4);
  });

  const colors = {
    investment: "#8b2525",
    actual: "#11875d",
    projected: "#2c6fbb",
  };
  const labelStep = Math.max(1, Math.ceil(items.length / 16));

  items.forEach((item, index) => {
    const x = padding.left + groupWidth * index + groupWidth / 2;
    const valueY = yForValue(item.value);
    const barTop = Math.min(zeroY, valueY);
    const barHeight = Math.max(2, Math.abs(zeroY - valueY));

    context.fillStyle = colors[item.type];
    roundRect(context, x - barWidth / 2, barTop, barWidth, barHeight, 4);
    context.fill();

    if (index % labelStep === 0 || index === items.length - 1) {
      context.fillStyle = "#657384";
      context.font = "700 10px Inter, system-ui, sans-serif";
      context.textAlign = "center";
      context.fillText(item.label, x, chartHeight - 17);
    }

    if (items.length <= 24 || index === 0 || index === items.length - 1) {
      const labelY = item.value >= 0 ? Math.max(13, valueY - 7) : Math.min(chartHeight - 42, valueY + 14);
      context.fillStyle = item.value < 0 ? "#8b2525" : "#17202a";
      context.font = "800 9px Inter, system-ui, sans-serif";
      context.textAlign = "center";
      context.fillText(compactChartCurrency(item.value), x, labelY);
    }
  });

  if (residualValue > 0) {
    const lastIndex = items.length - 1;
    const x = padding.left + groupWidth * lastIndex + groupWidth / 2;
    const baseY = yForValue(lastBaseValue);
    const totalY = yForValue(lastBaseValue + residualValue);
    context.beginPath();
    context.moveTo(x, baseY);
    context.lineTo(x, totalY);
    context.strokeStyle = "#ad741f";
    context.lineWidth = 3;
    context.stroke();
    context.beginPath();
    context.arc(x, totalY, 5, 0, Math.PI * 2);
    context.fillStyle = "#ad741f";
    context.fill();
    context.fillStyle = "#ad741f";
    context.font = "800 9px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText(`+${compactChartCurrency(residualValue)}`, x, Math.max(12, totalY - 9));
  }
}

function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  canvas.style.width = "100%";
}

function cashFlowTypeLabel(type) {
  return {
    investment: "investimento inicial",
    actual: "realizado",
    projected: "projetado",
  }[type];
}

function renderSavedScenarios() {
  const grid = document.querySelector("#savedScenarioGrid");
  const count = state.viabilityScenarios.length;
  document.querySelector("#viabilityScenarioCount").textContent =
    count === 1 ? "1 cenário" : `${count} cenários`;

  const storageNotice = state.scenarioStorageError
    ? `<p class="scenario-storage-warning" role="alert">${escapeHtml(state.scenarioStorageError)}</p>`
    : "";

  if (!count) {
    grid.innerHTML = `
      ${storageNotice}
      <p class="saved-scenario-empty">
        Nenhum cenário salvo ainda. Preencha as premissas e salve sua primeira simulação.
      </p>
    `;
    return;
  }

  grid.innerHTML = storageNotice + state.viabilityScenarios
    .map((scenario) => {
      const result = calculateViability(scenario);
      const date = new Date(scenario.createdAt);
      const savedAt = Number.isNaN(date.getTime())
        ? "Data não informada"
        : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

      return `
        <article class="saved-scenario-card">
          <header>
            <h4>${escapeHtml(scenario.name)}</h4>
            <time datetime="${escapeAttribute(scenario.createdAt)}">${escapeHtml(savedAt)}</time>
          </header>
          <div class="saved-scenario-inputs">
            <div><span>Investimento</span><strong>${currency.format(scenario.initialInvestment)}</strong></div>
            <div><span>TMA anual</span><strong>${formatPercent(scenario.annualRate)}</strong></div>
            <div><span>Prazo</span><strong>${scenario.months} meses</strong></div>
            <div><span>Entrada mensal</span><strong>${currency.format(scenario.monthlyNetInflow)}</strong></div>
            <div><span>Valor residual</span><strong>${currency.format(scenario.residualValue || 0)}</strong></div>
            <div><span>Dados realizados</span><strong>${result ? countLabel(result.actualPeriodCount, "mês", "meses") : "—"}</strong></div>
          </div>
          <div class="saved-scenario-results">
            <div><span>VPL</span><strong>${result ? currency.format(result.npv) : "—"}</strong></div>
            <div><span>TIR anual</span><strong>${result?.annualIrr === null || !result ? "—" : formatPercent(result.annualIrr)}</strong></div>
            <div><span>Payback</span><strong>${result?.paybackMonths === null || !result ? "Não recuperado" : formatMonths(result.paybackMonths)}</strong></div>
          </div>
          <div class="saved-scenario-actions">
            <button class="load-scenario-button" type="button" data-scenario-id="${escapeAttribute(scenario.id)}">Carregar</button>
            <button class="delete-scenario-button" type="button" data-scenario-id="${escapeAttribute(scenario.id)}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function createViabilityScenario(scenario) {
  if (state.scenarioStorageMode === "supabase") {
    const { data, error } = await supabaseClient
      .from("viability_scenarios")
      .insert(serializeSupabaseScenario(scenario))
      .select("id, name, initial_investment, annual_rate, months, monthly_net_inflow, residual_value, actual_monthly_flows, created_at")
      .single();

    if (error) throw new Error(error.message || "Não foi possível salvar no Supabase.");
    return normalizeSupabaseScenario(data);
  }

  if (state.scenarioStorageMode === "api") {
    const response = await fetch("/api/viability-scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scenario),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "Não foi possível salvar o cenário.");
    return payload.scenario;
  }

  if (state.scenarioStorageMode === "unavailable") {
    throw new Error(state.scenarioStorageError || "O armazenamento de cenários está indisponível.");
  }

  return scenario;
}

async function handleViabilitySubmit(event) {
  event.preventDefault();

  const assumptions = readViabilityAssumptions();
  const name = document.querySelector("#viabilityScenarioName").value.trim();
  const feedback = document.querySelector("#viabilityFeedback");

  if (!name || !assumptions) {
    feedback.textContent = "Preencha todos os campos com valores válidos antes de salvar.";
    return;
  }

  const submitButton = event.submitter || document.querySelector("#viabilityForm button[type='submit']");
  const scenario = {
    id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()),
    name,
    ...assumptions,
    createdAt: new Date().toISOString(),
  };

  submitButton.disabled = true;
  feedback.textContent = state.scenarioStorageMode === "supabase"
    ? "Salvando cenário na base de dados…"
    : "Salvando cenário…";

  try {
    const savedScenario = await createViabilityScenario(scenario);
    state.viabilityScenarios.unshift(savedScenario);
    if (state.scenarioStorageMode === "browser") saveViabilityScenarios();
    renderSavedScenarios();
    feedback.textContent = state.scenarioStorageMode === "supabase"
      ? "Cenário salvo na base de dados."
      : state.scenarioStorageMode === "api"
        ? "Cenário salvo no servidor."
        : "Cenário salvo neste navegador.";
  } catch (error) {
    console.warn("Erro ao salvar cenário:", error);
    feedback.textContent = error.message || "Não foi possível salvar o cenário.";
  } finally {
    submitButton.disabled = false;
  }
}

function resetViabilityForm() {
  document.querySelector("#viabilityForm").reset();
  document.querySelector("#viabilityFeedback").textContent = "";
  renderViability();
  document.querySelector("#viabilityScenarioName").focus();
}

function loadViabilityScenario(scenarioId) {
  const scenario = state.viabilityScenarios.find((item) => String(item.id) === scenarioId);
  if (!scenario) return;

  document.querySelector("#viabilityScenarioName").value = scenario.name;
  document.querySelector("#initialInvestment").value = scenario.initialInvestment;
  document.querySelector("#minimumAttractiveRate").value = scenario.annualRate * 100;
  document.querySelector("#projectTermMonths").value = scenario.months;
  document.querySelector("#monthlyNetInflow").value = scenario.monthlyNetInflow;
  document.querySelector("#residualValue").value = scenario.residualValue || 0;
  document.querySelector("#viabilityFeedback").textContent =
    "Cenário carregado. Ao salvar, uma nova simulação será criada.";
  renderViability();
  document.querySelector("#viabilitySimulation").scrollIntoView({ behavior: "smooth" });
}

async function deleteViabilityScenario(scenarioId) {
  const scenario = state.viabilityScenarios.find((item) => String(item.id) === scenarioId);
  if (!scenario || !window.confirm(`Excluir o cenário “${scenario.name}”?`)) return;

  try {
    if (state.scenarioStorageMode === "supabase") {
      const { error } = await supabaseClient
        .from("viability_scenarios")
        .delete()
        .eq("id", scenario.id);
      if (error) throw new Error(error.message || "Não foi possível excluir no Supabase.");
    } else if (state.scenarioStorageMode === "api") {
      const response = await fetch(`/api/viability-scenarios/${encodeURIComponent(scenario.id)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Não foi possível excluir o cenário.");
    } else if (state.scenarioStorageMode === "unavailable") {
      throw new Error(state.scenarioStorageError || "O armazenamento de cenários está indisponível.");
    }

    state.viabilityScenarios = state.viabilityScenarios.filter(
      (item) => String(item.id) !== scenarioId,
    );
    if (state.scenarioStorageMode === "browser") saveViabilityScenarios();
    renderSavedScenarios();
  } catch (error) {
    console.warn("Erro ao excluir cenário:", error);
    document.querySelector("#viabilityFeedback").textContent =
      error.message || "Não foi possível excluir o cenário.";
  }
}

function formatPercent(decimalRate) {
  return `${(decimalRate * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatMonths(value) {
  const rounded = Number(value.toFixed(1));
  return `${rounded.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${rounded === 1 ? "mês" : "meses"}`;
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

function amountToneClass(value) {
  if (value < 0) return " amount-expense";
  if (value > 0) return " amount-income";
  return "";
}

function setSignedAmount(selector, value) {
  const element = document.querySelector(selector);
  element.textContent = currency.format(value);
  element.classList.toggle("negative-amount", value < 0);
}

function formatDate(dateValue) {
  return shortDate.format(new Date(`${dateValue}T12:00:00`));
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
  return escapeHtml(value);
}

function compactCurrency(value) {
  if (Math.abs(value) >= 1000) {
    const sign = value < 0 ? "−" : "";
    return `${sign}R$ ${Math.round(Math.abs(value) / 1000)} mil`;
  }
  return currency.format(value);
}

function compactChartCurrency(value) {
  if (Math.abs(value) >= 1000) {
    const rounded = (Math.abs(value) / 1000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    });
    return `${value < 0 ? "−" : ""}${rounded} mil`;
  }

  return Math.round(value).toLocaleString("pt-BR");
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
document.querySelector("#openNewCategoryButton").addEventListener("click", openNewCategoryDialog);
document.querySelector("#newCategoryForm").addEventListener("submit", handleNewCategorySubmit);
document.querySelector("#closeNewCategoryDialogButton").addEventListener("click", closeNewCategoryDialog);
document.querySelector("#cancelNewCategoryButton").addEventListener("click", closeNewCategoryDialog);
document.querySelector("#newCategoryDialog").addEventListener("close", resetNewCategoryForm);
document.querySelector("#clearEntriesButton").addEventListener("click", clearEntries);
document.querySelector("#asaasCsvFile").addEventListener("change", handleAsaasFileChange);
document.querySelector("#saveAsaasRevenueButton").addEventListener("click", saveAsaasRevenue);
document.querySelector("#viabilityForm").addEventListener("submit", handleViabilitySubmit);
document.querySelector("#viabilityForm").addEventListener("input", () => {
  document.querySelector("#viabilityFeedback").textContent = "";
  renderViability();
});
document.querySelector("#resetViabilityButton").addEventListener("click", resetViabilityForm);
document.querySelector("#savedScenarioGrid").addEventListener("click", (event) => {
  const loadButton = event.target.closest(".load-scenario-button");
  const deleteButton = event.target.closest(".delete-scenario-button");
  if (loadButton) loadViabilityScenario(loadButton.dataset.scenarioId);
  if (deleteButton) deleteViabilityScenario(deleteButton.dataset.scenarioId);
});
document.querySelector("#entryRows").addEventListener("click", (event) => {
  const button = event.target.closest(".edit-entry-button");
  if (button) openEntryEditor([button.dataset.entryId]);
});
document.querySelector("#spreadsheetRows").addEventListener("click", (event) => {
  const button = event.target.closest(".spreadsheet-edit-button");
  if (!button) return;

  const entryIds = entriesForCell(button.dataset.category, button.dataset.month).map(
    (entry) => entry.id,
  );
  openEntryEditor(entryIds);
});
document.querySelector("#editEntryPicker").addEventListener("change", (event) => {
  const entry = state.entries.find((item) => String(item.id) === event.target.value);
  if (entry) fillEntryEditor(entry);
});
document.querySelector("#editEntryForm").addEventListener("submit", handleEditEntrySubmit);
document.querySelector("#closeEditDialogButton").addEventListener("click", closeEntryEditor);
document.querySelector("#cancelEditEntryButton").addEventListener("click", closeEntryEditor);
document.querySelector("#editEntryDialog").addEventListener("close", resetEntryEditor);
window.addEventListener("resize", () => {
  if (state.activeView === "viewData") renderCharts();
  if (state.activeView === "viabilitySimulation") renderViability();
});

async function initializeApp() {
  setAppLoading(true);

  try {
    await setupSupabase();
    await loadEntries();
    await loadCategoryOptions();
    await loadStoredViabilityScenarios();
  } catch (error) {
    console.error("Erro ao inicializar o painel:", error);
  } finally {
    populateControls();
    state.appReady = true;
    setAppLoading(false);
    showHome();
  }
}

initializeApp();
