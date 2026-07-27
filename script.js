const recurringPayments = [
  { id: "clubes", name: "Mensalidades clube", expected: 8240, day: "segunda-feira" },
  { id: "assinaturas", name: "Assinaturas semanais", expected: 3620, day: "terça-feira" },
  { id: "servicos", name: "Contratos de serviço", expected: 5100, day: "quarta-feira" },
  { id: "licencas", name: "Licenças recorrentes", expected: 2180, day: "sexta-feira" },
];

const weeks = [
  { id: "2026-W28", label: "06 a 12 jul", openingBalance: 18420 },
  { id: "2026-W29", label: "13 a 19 jul", openingBalance: 22210 },
  { id: "2026-W30", label: "20 a 26 jul", openingBalance: 25930 },
  { id: "2026-W31", label: "27 jul a 02 ago", openingBalance: 28380 },
  { id: "2026-W32", label: "03 a 09 ago", openingBalance: 30650 },
  { id: "2026-W33", label: "10 a 16 ago", openingBalance: 33280 },
];

const transactions = [
  { week: "2026-W28", date: "2026-07-06", description: "Mensalidades clube", category: "Receita recorrente", type: "income", amount: 8240, status: "conciliado", recurringId: "clubes" },
  { week: "2026-W28", date: "2026-07-07", description: "Assinaturas semanais", category: "Receita recorrente", type: "income", amount: 3510, status: "conciliado", recurringId: "assinaturas" },
  { week: "2026-W28", date: "2026-07-08", description: "Contratos de serviço", category: "Receita recorrente", type: "income", amount: 5100, status: "conciliado", recurringId: "servicos" },
  { week: "2026-W28", date: "2026-07-10", description: "Licenças recorrentes", category: "Receita recorrente", type: "income", amount: 2180, status: "conciliado", recurringId: "licencas" },
  { week: "2026-W28", date: "2026-07-10", description: "Folha de pagamento", category: "Operacional", type: "expense", amount: 7250, status: "pago" },
  { week: "2026-W28", date: "2026-07-11", description: "Infraestrutura cloud", category: "Tecnologia", type: "expense", amount: 2990, status: "pago" },

  { week: "2026-W29", date: "2026-07-13", description: "Mensalidades clube", category: "Receita recorrente", type: "income", amount: 8390, status: "conciliado", recurringId: "clubes" },
  { week: "2026-W29", date: "2026-07-14", description: "Assinaturas semanais", category: "Receita recorrente", type: "income", amount: 3620, status: "conciliado", recurringId: "assinaturas" },
  { week: "2026-W29", date: "2026-07-16", description: "Contratos de serviço", category: "Receita recorrente", type: "income", amount: 4900, status: "revisar", recurringId: "servicos" },
  { week: "2026-W29", date: "2026-07-17", description: "Licenças recorrentes", category: "Receita recorrente", type: "income", amount: 2180, status: "conciliado", recurringId: "licencas" },
  { week: "2026-W29", date: "2026-07-15", description: "Fornecedor administrativo", category: "Administrativo", type: "expense", amount: 3160, status: "pago" },
  { week: "2026-W29", date: "2026-07-18", description: "Reembolso de campanha", category: "Marketing", type: "expense", amount: 4210, status: "pago" },

  { week: "2026-W30", date: "2026-07-20", description: "Mensalidades clube", category: "Receita recorrente", type: "income", amount: 8240, status: "conciliado", recurringId: "clubes" },
  { week: "2026-W30", date: "2026-07-21", description: "Assinaturas semanais", category: "Receita recorrente", type: "income", amount: 3620, status: "conciliado", recurringId: "assinaturas" },
  { week: "2026-W30", date: "2026-07-22", description: "Contratos de serviço", category: "Receita recorrente", type: "income", amount: 5100, status: "conciliado", recurringId: "servicos" },
  { week: "2026-W30", date: "2026-07-23", description: "Venda pontual", category: "Receita avulsa", type: "income", amount: 2850, status: "conciliado" },
  { week: "2026-W30", date: "2026-07-24", description: "Licenças recorrentes", category: "Receita recorrente", type: "income", amount: 0, status: "ausente", recurringId: "licencas" },
  { week: "2026-W30", date: "2026-07-24", description: "Aluguel e condomínio", category: "Estrutura", type: "expense", amount: 5400, status: "pago" },
  { week: "2026-W30", date: "2026-07-25", description: "Suporte terceirizado", category: "Operacional", type: "expense", amount: 3880, status: "pago" },

  { week: "2026-W31", date: "2026-07-27", description: "Mensalidades clube", category: "Receita recorrente", type: "income", amount: 8240, status: "conciliado", recurringId: "clubes" },
  { week: "2026-W31", date: "2026-07-28", description: "Assinaturas semanais", category: "Receita recorrente", type: "income", amount: 3180, status: "revisar", recurringId: "assinaturas" },
  { week: "2026-W31", date: "2026-07-29", description: "Contratos de serviço", category: "Receita recorrente", type: "income", amount: 5100, status: "conciliado", recurringId: "servicos" },
  { week: "2026-W31", date: "2026-07-31", description: "Licenças recorrentes", category: "Receita recorrente", type: "income", amount: 2180, status: "conciliado", recurringId: "licencas" },
  { week: "2026-W31", date: "2026-07-30", description: "Impostos e taxas", category: "Fiscal", type: "expense", amount: 4670, status: "agendado" },
  { week: "2026-W31", date: "2026-08-01", description: "Pacote de mídia", category: "Marketing", type: "expense", amount: 2250, status: "agendado" },

  { week: "2026-W32", date: "2026-08-03", description: "Mensalidades clube", category: "Receita recorrente", type: "income", amount: 8460, status: "conciliado", recurringId: "clubes" },
  { week: "2026-W32", date: "2026-08-04", description: "Assinaturas semanais", category: "Receita recorrente", type: "income", amount: 3620, status: "conciliado", recurringId: "assinaturas" },
  { week: "2026-W32", date: "2026-08-05", description: "Contratos de serviço", category: "Receita recorrente", type: "income", amount: 5100, status: "conciliado", recurringId: "servicos" },
  { week: "2026-W32", date: "2026-08-07", description: "Licenças recorrentes", category: "Receita recorrente", type: "income", amount: 2180, status: "conciliado", recurringId: "licencas" },
  { week: "2026-W32", date: "2026-08-06", description: "Manutenção preventiva", category: "Operacional", type: "expense", amount: 3860, status: "agendado" },
  { week: "2026-W32", date: "2026-08-08", description: "Consultoria contábil", category: "Administrativo", type: "expense", amount: 1770, status: "agendado" },

  { week: "2026-W33", date: "2026-08-10", description: "Mensalidades clube", category: "Receita recorrente", type: "income", amount: 8240, status: "previsto", recurringId: "clubes" },
  { week: "2026-W33", date: "2026-08-11", description: "Assinaturas semanais", category: "Receita recorrente", type: "income", amount: 3620, status: "previsto", recurringId: "assinaturas" },
  { week: "2026-W33", date: "2026-08-12", description: "Contratos de serviço", category: "Receita recorrente", type: "income", amount: 5100, status: "previsto", recurringId: "servicos" },
  { week: "2026-W33", date: "2026-08-14", description: "Licenças recorrentes", category: "Receita recorrente", type: "income", amount: 2180, status: "previsto", recurringId: "licencas" },
  { week: "2026-W33", date: "2026-08-13", description: "Renovação de software", category: "Tecnologia", type: "expense", amount: 3320, status: "previsto" },
  { week: "2026-W33", date: "2026-08-15", description: "Reserva operacional", category: "Financeiro", type: "expense", amount: 4100, status: "previsto" },
];

const state = {
  selectedWeek: "2026-W31",
  onlyIssues: false,
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

const statusMap = {
  ok: { label: "Conciliado", className: "ok" },
  late: { label: "Valor divergente", className: "late" },
  missing: { label: "Ausente", className: "missing" },
  manual: { label: "Manual", className: "manual" },
};

function transactionsByWeek(weekId) {
  return transactions.filter((transaction) => transaction.week === weekId);
}

function summarizeWeek(weekId) {
  const weekTransactions = transactionsByWeek(weekId);
  const income = sumByType(weekTransactions, "income");
  const expenses = sumByType(weekTransactions, "expense");
  return {
    income,
    expenses,
    net: income - expenses,
    count: weekTransactions.length,
  };
}

function sumByType(items, type) {
  return items
    .filter((transaction) => transaction.type === type && transaction.amount > 0)
    .reduce((total, transaction) => total + transaction.amount, 0);
}

function getPreviousWeekId(weekId) {
  const index = weeks.findIndex((week) => week.id === weekId);
  return index > 0 ? weeks[index - 1].id : null;
}

function getDeltaText(current, previous, inverted = false) {
  if (previous === null || previous === undefined) return "Primeira semana da série";
  const diff = current - previous;
  if (diff === 0) return "Sem variação versus semana anterior";

  const direction = diff > 0 ? "acima" : "abaixo";
  const adjustedDirection = inverted && diff > 0 ? "mais alto" : direction;
  return `${currency.format(Math.abs(diff))} ${adjustedDirection} da semana anterior`;
}

function auditRecurringPayments(weekId) {
  const weekTransactions = transactionsByWeek(weekId);

  return recurringPayments.map((payment) => {
    const match = weekTransactions.find((transaction) => transaction.recurringId === payment.id);

    if (!match || match.amount === 0 || match.status === "ausente") {
      return {
        ...payment,
        found: 0,
        status: "missing",
        note: `Entrada esperada para ${payment.day}, mas não localizada no extrato.`,
      };
    }

    const difference = match.amount - payment.expected;
    const ratio = Math.abs(difference) / payment.expected;

    if (ratio > 0.04 || match.status === "revisar") {
      return {
        ...payment,
        found: match.amount,
        status: "late",
        note: `Diferença de ${currency.format(difference)} em relação ao valor esperado.`,
      };
    }

    return {
      ...payment,
      found: match.amount,
      status: "ok",
      note: `Pagamento localizado e dentro da margem esperada para ${payment.day}.`,
    };
  });
}

function populateWeekFilter() {
  const filter = document.querySelector("#weekFilter");
  filter.innerHTML = weeks
    .map((week) => `<option value="${week.id}">${week.label}</option>`)
    .join("");
  filter.value = state.selectedWeek;
}

function renderMetrics() {
  const summary = summarizeWeek(state.selectedWeek);
  const previousWeekId = getPreviousWeekId(state.selectedWeek);
  const previous = previousWeekId ? summarizeWeek(previousWeekId) : null;
  const issues = auditRecurringPayments(state.selectedWeek).filter((item) => item.status !== "ok");

  document.querySelector("#incomeMetric").textContent = currency.format(summary.income);
  document.querySelector("#expenseMetric").textContent = currency.format(summary.expenses);
  document.querySelector("#netMetric").textContent = currency.format(summary.net);
  document.querySelector("#reviewMetric").textContent = issues.length;

  document.querySelector("#incomeDelta").textContent = getDeltaText(
    summary.income,
    previous?.income,
  );
  document.querySelector("#expenseDelta").textContent = getDeltaText(
    summary.expenses,
    previous?.expenses,
    true,
  );
  document.querySelector("#netDelta").textContent = getDeltaText(summary.net, previous?.net);
  document.querySelector("#reviewDetail").textContent =
    issues.length === 0 ? "Nenhuma pendência nos recorrentes" : "Itens com ausência ou divergência";
}

function renderAuditList() {
  const list = document.querySelector("#auditList");
  let items = auditRecurringPayments(state.selectedWeek);

  if (state.onlyIssues) {
    items = items.filter((item) => item.status !== "ok");
  }

  if (items.length === 0) {
    list.innerHTML = '<div class="empty-state">Nenhuma pendência nesta semana.</div>';
    return;
  }

  list.innerHTML = items
    .map((item) => {
      const status = statusMap[item.status];
      return `
        <article class="audit-item">
          <div>
            <h3>${item.name}</h3>
            <p>Esperado: ${currency.format(item.expected)} · Recebido: ${currency.format(item.found)}</p>
            <p>${item.note}</p>
          </div>
          <div class="audit-amount">
            <strong>${currency.format(item.found || item.expected)}</strong>
            <span class="status ${status.className}">${status.label}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTransactions() {
  const rows = document.querySelector("#transactionRows");
  const weekTransactions = transactionsByWeek(state.selectedWeek).filter(
    (transaction) => transaction.amount > 0,
  );

  document.querySelector("#transactionCount").textContent =
    `${weekTransactions.length} lançamentos`;

  rows.innerHTML = weekTransactions
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((transaction) => {
      const amountClass = transaction.type === "income" ? "amount-income" : "amount-expense";
      const typeLabel = transaction.type === "income" ? "Entrada" : "Saída";
      const sign = transaction.type === "income" ? "+" : "-";
      const statusClass = getTransactionStatusClass(transaction.status);

      return `
        <tr>
          <td>${shortDate.format(new Date(`${transaction.date}T12:00:00`))}</td>
          <td>${transaction.description}</td>
          <td>${transaction.category}</td>
          <td>${typeLabel}</td>
          <td class="amount-cell ${amountClass}">${sign} ${currency.format(transaction.amount)}</td>
          <td><span class="status ${statusClass}">${capitalize(transaction.status)}</span></td>
        </tr>
      `;
    })
    .join("");
}

function getTransactionStatusClass(status) {
  if (["conciliado", "pago"].includes(status)) return "ok";
  if (["agendado", "previsto"].includes(status)) return "manual";
  return "late";
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function renderCashflowChart() {
  const canvas = document.querySelector("#cashflowChart");
  const context = canvas.getContext("2d");
  const pixelRatio = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();

  canvas.width = bounds.width * pixelRatio;
  canvas.height = 260 * pixelRatio;
  context.scale(pixelRatio, pixelRatio);
  context.clearRect(0, 0, bounds.width, 260);

  const chart = weeks.map((week) => {
    const summary = summarizeWeek(week.id);
    return { ...week, ...summary };
  });

  const padding = { top: 18, right: 18, bottom: 46, left: 58 };
  const width = bounds.width - padding.left - padding.right;
  const height = 260 - padding.top - padding.bottom;
  const maxValue = Math.max(...chart.flatMap((item) => [item.income, item.expenses, item.net])) * 1.16;
  const groupWidth = width / chart.length;
  const barWidth = Math.min(28, groupWidth * 0.24);
  const zeroY = padding.top + height;

  drawGrid(context, padding, width, height, maxValue);

  chart.forEach((item, index) => {
    const groupX = padding.left + index * groupWidth + groupWidth / 2;
    const incomeHeight = (item.income / maxValue) * height;
    const expenseHeight = (item.expenses / maxValue) * height;
    const isSelected = item.id === state.selectedWeek;

    context.globalAlpha = isSelected ? 1 : 0.66;
    context.fillStyle = "#11875d";
    roundRect(context, groupX - barWidth - 4, zeroY - incomeHeight, barWidth, incomeHeight, 5);
    context.fill();

    context.fillStyle = "#c43d3d";
    roundRect(context, groupX + 4, zeroY - expenseHeight, barWidth, expenseHeight, 5);
    context.fill();
    context.globalAlpha = 1;

    context.fillStyle = isSelected ? "#17202a" : "#657384";
    context.font = "700 11px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText(item.label.replace(" a ", "-"), groupX, 242);
  });

  drawNetLine(context, chart, padding, width, height, maxValue);
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

function drawNetLine(context, chart, padding, width, height, maxValue) {
  const groupWidth = width / chart.length;
  const points = chart.map((item, index) => {
    const x = padding.left + index * groupWidth + groupWidth / 2;
    const y = padding.top + height - (item.net / maxValue) * height;
    return { x, y, selected: item.id === state.selectedWeek };
  });

  context.strokeStyle = "#2c6fbb";
  context.lineWidth = 3;
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();

  points.forEach((point) => {
    context.fillStyle = point.selected ? "#17202a" : "#2c6fbb";
    context.beginPath();
    context.arc(point.x, point.y, point.selected ? 5 : 4, 0, Math.PI * 2);
    context.fill();
  });
}

function roundRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function compactCurrency(value) {
  if (value >= 1000) return `R$ ${Math.round(value / 1000)} mil`;
  return currency.format(value);
}

function exportCurrentWeekCsv() {
  const week = weeks.find((item) => item.id === state.selectedWeek);
  const header = ["data", "descricao", "categoria", "tipo", "valor", "status"];
  const rows = transactionsByWeek(state.selectedWeek)
    .filter((transaction) => transaction.amount > 0)
    .map((transaction) => [
      transaction.date,
      transaction.description,
      transaction.category,
      transaction.type === "income" ? "entrada" : "saida",
      transaction.amount,
      transaction.status,
    ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `extrato-${week.id}-${week.label.replaceAll(" ", "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function render() {
  renderMetrics();
  renderAuditList();
  renderTransactions();
  renderCashflowChart();
}

document.querySelector("#weekFilter").addEventListener("change", (event) => {
  state.selectedWeek = event.target.value;
  render();
});

document.querySelector("#showOnlyIssues").addEventListener("change", (event) => {
  state.onlyIssues = event.target.checked;
  renderAuditList();
});

document.querySelector("#exportButton").addEventListener("click", exportCurrentWeekCsv);

window.addEventListener("resize", renderCashflowChart);

populateWeekFilter();
render();
