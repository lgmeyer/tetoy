import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const env = await loadEnv();
const port = Number(process.env.PORT || env.PORT || 3000);
const database = await openDatabase();

const asaasBaseUrls = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

const mimeTypes = {
  ".html": "text/html;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".js": "text/javascript;charset=utf-8",
  ".json": "application/json;charset=utf-8",
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/dashboard" && request.method === "GET") {
      await handleDashboard(response);
      return;
    }

    if (url.pathname === "/api/entries" && request.method === "GET") {
      handleListEntries(response);
      return;
    }

    if (url.pathname === "/api/entries" && request.method === "POST") {
      await handleCreateEntry(request, response);
      return;
    }

    const entryMatch = url.pathname.match(/^\/api\/entries\/(\d+)$/);
    if (entryMatch && request.method === "PUT") {
      await handleUpdateEntry(request, response, Number(entryMatch[1]));
      return;
    }

    if (url.pathname === "/api/entries" && request.method === "DELETE") {
      handleDeleteEntries(response);
      return;
    }

    if (url.pathname === "/api/category-options" && request.method === "GET") {
      handleListCategoryOptions(response);
      return;
    }

    if (url.pathname === "/api/category-options" && request.method === "POST") {
      await handleCreateCategoryOption(request, response);
      return;
    }

    if (url.pathname === "/api/viability-scenarios" && request.method === "GET") {
      handleListViabilityScenarios(response);
      return;
    }

    if (url.pathname === "/api/viability-scenarios" && request.method === "POST") {
      await handleCreateViabilityScenario(request, response);
      return;
    }

    const scenarioMatch = url.pathname.match(/^\/api\/viability-scenarios\/([^/]+)$/);
    if (scenarioMatch && request.method === "DELETE") {
      handleDeleteViabilityScenario(response, decodeURIComponent(scenarioMatch[1]));
      return;
    }

    if (url.pathname === "/api/webhooks/asaas" && request.method === "POST") {
      await handleAsaasWebhook(request, response);
      return;
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    await serveStaticFile(url.pathname, response, request.method);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "internal_server_error" });
  }
}).listen(port, () => {
  console.log(`Dashboard disponível em http://localhost:${port}`);
});

async function openDatabase() {
  const dataDir = join(rootDir, "data");
  await mkdir(dataDir, { recursive: true });

  const db = new DatabaseSync(join(dataDir, "tetoy.sqlite"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      value REAL NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('debit', 'credit')),
      date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS viability_scenarios (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      initial_investment REAL NOT NULL,
      annual_rate REAL NOT NULL,
      months INTEGER NOT NULL,
      monthly_net_inflow REAL NOT NULL,
      residual_value REAL NOT NULL DEFAULT 0,
      actual_monthly_flows TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS category_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      direction TEXT NOT NULL DEFAULT 'debit' CHECK(direction IN ('debit', 'credit')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const insertDefaultCategory = db.prepare(`
    INSERT OR IGNORE INTO category_options (name, direction)
    VALUES (?, ?)
  `);
  [
    ["SN CONTABILIDADE", "debit"],
    ["ASAAS MARKETING", "debit"],
    ["ASAAS ROYALTIES", "debit"],
    ["SLS LOC OFICINA", "debit"],
    ["PREF.SOROCABA", "debit"],
    ["SLS - GESTÃO DA FROTA", "debit"],
    ["ASAAS - ADESÃO DAS MOTOS", "debit"],
    ["RECEITA", "credit"],
    ["OUTRO", "debit"],
  ].forEach((option) => insertDefaultCategory.run(...option));

  return db;
}

async function loadEnv() {
  try {
    const raw = await readFile(join(rootDir, ".env"), "utf8");
    return raw.split(/\r?\n/).reduce((values, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return values;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return values;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      values[key] = value.replace(/^["']|["']$/g, "");
      return values;
    }, {});
  } catch {
    return {};
  }
}

function handleListEntries(response) {
  const entries = database
    .prepare(`
      SELECT id, category, value, direction, date, note, created_at AS createdAt
      FROM entries
      ORDER BY date DESC, id DESC
    `)
    .all();

  sendJson(response, 200, { entries });
}

async function handleCreateEntry(request, response) {
  const payload = await readJsonRequest(request);
  const validationError = validateEntryPayload(payload);

  if (validationError) {
    sendJson(response, 400, { error: "invalid_entry", message: validationError });
    return;
  }

  const statement = database.prepare(`
    INSERT INTO entries (category, value, direction, date, note)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = statement.run(
    payload.category.trim(),
    Number(payload.value),
    payload.direction,
    payload.date,
    (payload.note || "").trim(),
  );

  const entry = database
    .prepare(`
      SELECT id, category, value, direction, date, note, created_at AS createdAt
      FROM entries
      WHERE id = ?
    `)
    .get(result.lastInsertRowid);

  sendJson(response, 201, { entry });
}

async function handleUpdateEntry(request, response, entryId) {
  const payload = await readJsonRequest(request);
  const validationError = validateEntryPayload(payload);

  if (!Number.isSafeInteger(entryId) || entryId <= 0) {
    sendJson(response, 400, { error: "invalid_entry_id", message: "Lançamento inválido." });
    return;
  }

  if (validationError) {
    sendJson(response, 400, { error: "invalid_entry", message: validationError });
    return;
  }

  const result = database
    .prepare(`
      UPDATE entries
      SET category = ?, value = ?, direction = ?, date = ?, note = ?
      WHERE id = ?
    `)
    .run(
      payload.category.trim(),
      Number(payload.value),
      payload.direction,
      payload.date,
      (payload.note || "").trim(),
      entryId,
    );

  if (result.changes === 0) {
    sendJson(response, 404, { error: "entry_not_found", message: "Lançamento não encontrado." });
    return;
  }

  const entry = database
    .prepare(`
      SELECT id, category, value, direction, date, note, created_at AS createdAt
      FROM entries
      WHERE id = ?
    `)
    .get(entryId);

  sendJson(response, 200, { entry });
}

function handleDeleteEntries(response) {
  database.prepare("DELETE FROM entries").run();
  sendJson(response, 200, { entries: [] });
}

function handleListCategoryOptions(response) {
  const options = database
    .prepare(`
      SELECT name, direction
      FROM category_options
      ORDER BY id ASC
    `)
    .all();

  sendJson(response, 200, { options });
}

async function handleCreateCategoryOption(request, response) {
  const payload = await readJsonRequest(request);
  const validationError = validateCategoryOptionPayload(payload);

  if (validationError) {
    sendJson(response, 400, { error: "invalid_category_option", message: validationError });
    return;
  }

  const name = payload.name.trim().replace(/\s+/g, " ");

  try {
    database
      .prepare("INSERT INTO category_options (name, direction) VALUES (?, ?)")
      .run(name, payload.direction);
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed")) {
      sendJson(response, 409, {
        error: "category_option_exists",
        message: "Essa opção já existe.",
      });
      return;
    }
    throw error;
  }

  sendJson(response, 201, { option: { name, direction: payload.direction } });
}

function handleListViabilityScenarios(response) {
  const scenarios = database
    .prepare(`
      SELECT id, name, initial_investment AS initialInvestment,
        annual_rate AS annualRate, months, monthly_net_inflow AS monthlyNetInflow,
        residual_value AS residualValue, actual_monthly_flows AS actualMonthlyFlows,
        created_at AS createdAt
      FROM viability_scenarios
      ORDER BY created_at DESC
    `)
    .all()
    .map(normalizeDatabaseScenario);

  sendJson(response, 200, { scenarios });
}

async function handleCreateViabilityScenario(request, response) {
  const payload = await readJsonRequest(request);
  const validationError = validateViabilityScenarioPayload(payload);

  if (validationError) {
    sendJson(response, 400, { error: "invalid_viability_scenario", message: validationError });
    return;
  }

  try {
    database.prepare(`
      INSERT INTO viability_scenarios (
        id, name, initial_investment, annual_rate, months, monthly_net_inflow,
        residual_value, actual_monthly_flows, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.id,
      payload.name.trim(),
      Number(payload.initialInvestment),
      Number(payload.annualRate),
      Number(payload.months),
      Number(payload.monthlyNetInflow),
      Number(payload.residualValue || 0),
      JSON.stringify(payload.actualMonthlyFlows || []),
      payload.createdAt,
    );
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed")) {
      sendJson(response, 409, { error: "scenario_exists", message: "Este cenário já foi salvo." });
      return;
    }
    throw error;
  }

  const scenario = normalizeDatabaseScenario(database.prepare(`
    SELECT id, name, initial_investment AS initialInvestment,
      annual_rate AS annualRate, months, monthly_net_inflow AS monthlyNetInflow,
      residual_value AS residualValue, actual_monthly_flows AS actualMonthlyFlows,
      created_at AS createdAt
    FROM viability_scenarios
    WHERE id = ?
  `).get(payload.id));

  sendJson(response, 201, { scenario });
}

function handleDeleteViabilityScenario(response, scenarioId) {
  if (!scenarioId || scenarioId.length > 100) {
    sendJson(response, 400, { error: "invalid_scenario_id", message: "Cenário inválido." });
    return;
  }

  const result = database.prepare("DELETE FROM viability_scenarios WHERE id = ?").run(scenarioId);
  if (result.changes === 0) {
    sendJson(response, 404, { error: "scenario_not_found", message: "Cenário não encontrado." });
    return;
  }

  sendJson(response, 200, { deleted: true });
}

function normalizeDatabaseScenario(scenario) {
  let actualMonthlyFlows = [];
  try {
    actualMonthlyFlows = JSON.parse(scenario.actualMonthlyFlows || "[]");
  } catch {
    actualMonthlyFlows = [];
  }

  return { ...scenario, actualMonthlyFlows };
}

function validateViabilityScenarioPayload(payload) {
  if (!payload || typeof payload !== "object") return "Dados ausentes.";
  if (!payload.id || typeof payload.id !== "string" || payload.id.length > 100) return "Identificador inválido.";
  if (!payload.name || typeof payload.name !== "string" || payload.name.trim().length > 80) return "Informe um nome válido.";
  if (!Number.isFinite(Number(payload.initialInvestment)) || Number(payload.initialInvestment) <= 0) return "Informe o investimento inicial.";
  if (!Number.isFinite(Number(payload.annualRate)) || Number(payload.annualRate) < 0) return "Informe uma TMA válida.";
  if (!Number.isSafeInteger(Number(payload.months)) || Number(payload.months) < 1 || Number(payload.months) > 600) return "Informe um prazo entre 1 e 600 meses.";
  if (!Number.isFinite(Number(payload.monthlyNetInflow)) || Number(payload.monthlyNetInflow) <= 0) return "Informe a entrada líquida mensal.";
  if (!Number.isFinite(Number(payload.residualValue || 0)) || Number(payload.residualValue || 0) < 0) return "Informe um valor residual válido.";
  if (!Array.isArray(payload.actualMonthlyFlows) || payload.actualMonthlyFlows.length > 600) return "Fluxos mensais inválidos.";
  if (payload.actualMonthlyFlows.some((value) => value !== null && !Number.isFinite(Number(value)))) return "Fluxos mensais inválidos.";
  if (typeof payload.createdAt !== "string" || Number.isNaN(Date.parse(payload.createdAt))) return "Data de criação inválida.";
  return null;
}

function validateEntryPayload(payload) {
  if (!payload || typeof payload !== "object") return "Dados ausentes.";
  if (!payload.category || typeof payload.category !== "string") return "Informe uma opção da planilha.";
  if (!["debit", "credit"].includes(payload.direction)) return "Informe débito ou crédito.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date || "")) return "Informe uma data válida.";

  const value = Number(payload.value);
  if (!Number.isFinite(value) || value <= 0) return "Informe um valor maior que zero.";

  return null;
}

function validateCategoryOptionPayload(payload) {
  if (!payload || typeof payload !== "object") return "Dados ausentes.";
  if (typeof payload.name !== "string") return "Informe o nome da opção.";

  const name = payload.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) return "Informe um nome com até 80 caracteres.";
  if (!["debit", "credit"].includes(payload.direction)) return "Tipo de opção inválido.";

  return null;
}

async function handleDashboard(response) {
  if (!env.ASAAS_API_KEY) {
    sendJson(response, 503, {
      error: "asaas_not_configured",
      message: "Configure ASAAS_API_KEY no .env para carregar dados reais.",
    });
    return;
  }

  const weeks = buildWeeks(new Date());
  const firstWeek = weeks[0];
  const lastWeek = weeks[weeks.length - 1];
  const [payments, subscriptions] = await Promise.all([
    listAsaas("/payments", {
      "dueDate[ge]": firstWeek.start,
      "dueDate[le]": lastWeek.end,
      limit: "100",
    }),
    listAsaas("/subscriptions", {
      limit: "100",
      includeDeleted: "false",
    }),
  ]);

  const transactions = payments
    .map((payment) => normalizePayment(payment, weeks))
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  const recurringPayments = normalizeSubscriptions(subscriptions);
  const selectedWeek = findWeekId(toIsoDate(new Date()), weeks) || weeks.at(-1).id;

  sendJson(response, 200, {
    source: "asaas",
    environment: getAsaasEnvironment(),
    selectedWeek,
    weeks: weeks.map(({ id, label, openingBalance }) => ({ id, label, openingBalance })),
    recurringPayments,
    transactions,
  });
}

async function handleAsaasWebhook(request, response) {
  const expectedToken = env.ASAAS_WEBHOOK_AUTH_TOKEN;
  const receivedToken = request.headers["asaas-access-token"];

  if (expectedToken && receivedToken !== expectedToken) {
    sendJson(response, 401, { error: "invalid_webhook_token" });
    return;
  }

  const body = await readRequestBody(request);
  if (body) {
    console.log("Webhook Asaas recebido:", body);
  }

  response.writeHead(204);
  response.end();
}

async function listAsaas(pathname, params) {
  const firstPage = await requestAsaas(pathname, { ...params, offset: "0" });
  const data = [...(firstPage.data || [])];
  const totalCount = Number(firstPage.totalCount || data.length);
  const limit = Number(params.limit || 100);

  for (let offset = limit; offset < totalCount; offset += limit) {
    const page = await requestAsaas(pathname, { ...params, offset: String(offset) });
    data.push(...(page.data || []));
  }

  return data;
}

async function requestAsaas(pathname, params = {}) {
  const url = new URL(`${asaasBaseUrls[getAsaasEnvironment()]}${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `TetoyDashboard/0.1 (${getAsaasEnvironment()})`,
      access_token: env.ASAAS_API_KEY,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const description = payload.errors?.[0]?.description || response.statusText;
    throw new Error(`Asaas ${response.status}: ${description}`);
  }

  return payload;
}

function normalizePayment(payment, weeks) {
  const date = payment.paymentDate || payment.clientPaymentDate || payment.confirmedDate || payment.dueDate;
  const weekId = date ? findWeekId(date, weeks) : null;

  if (!date || !weekId) return null;

  return {
    week: weekId,
    date,
    description: payment.description || payment.invoiceNumber || payment.id,
    category: payment.subscription ? "Receita recorrente" : "Receita Asaas",
    type: "income",
    amount: Number(payment.netValue ?? payment.value ?? 0),
    status: mapAsaasStatus(payment.status),
    recurringId: payment.subscription || undefined,
  };
}

function normalizeSubscriptions(subscriptions) {
  return subscriptions
    .filter((subscription) => subscription.status !== "INACTIVE")
    .map((subscription) => ({
      id: subscription.id,
      name: subscription.description || subscription.id,
      expected: Number(subscription.value || 0),
      day: subscription.nextDueDate ? weekdayName(subscription.nextDueDate) : "data prevista",
    }));
}

function mapAsaasStatus(status) {
  const statusMap = {
    RECEIVED: "conciliado",
    CONFIRMED: "conciliado",
    RECEIVED_IN_CASH: "conciliado",
    PENDING: "previsto",
    OVERDUE: "revisar",
    REFUNDED: "revisar",
    REFUND_REQUESTED: "revisar",
    CHARGEBACK_REQUESTED: "revisar",
    CHARGEBACK_DISPUTE: "revisar",
  };

  return statusMap[status] || "previsto";
}

function buildWeeks(referenceDate) {
  const monday = startOfWeek(referenceDate);
  const firstMonday = addDays(monday, -21);

  return Array.from({ length: 6 }, (_, index) => {
    const startDate = addDays(firstMonday, index * 7);
    const endDate = addDays(startDate, 6);
    return {
      id: isoWeekId(startDate),
      label: weekLabel(startDate, endDate),
      openingBalance: 0,
      start: toIsoDate(startDate),
      end: toIsoDate(endDate),
    };
  });
}

function startOfWeek(date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function findWeekId(dateValue, weeks) {
  return weeks.find((week) => dateValue >= week.start && dateValue <= week.end)?.id;
}

function isoWeekId(date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((copy - yearStart) / 86400000 + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weekLabel(startDate, endDate) {
  const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
  return `${formatter.format(startDate).replace(".", "")} a ${formatter.format(endDate).replace(".", "")}`;
}

function weekdayName(dateValue) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(new Date(`${dateValue}T12:00:00`));
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function getAsaasEnvironment() {
  return env.ASAAS_ENV === "production" ? "production" : "sandbox";
}

async function serveStaticFile(pathname, response, method) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(rootDir, requestedPath));

  if (!filePath.startsWith(rootDir)) {
    sendJson(response, 403, { error: "forbidden" });
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    response.end(method === "HEAD" ? undefined : content);
  } catch {
    sendJson(response, 404, { error: "not_found" });
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json;charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readJsonRequest(request) {
  const body = await readRequestBody(request);
  if (!body) return {};

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}
