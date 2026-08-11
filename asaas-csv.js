(function registerAsaasCsv(globalScope) {
  const requiredHeaders = ["data", "tipo de transacao", "valor"];

  function parseAsaasStatement(csvText) {
    if (typeof csvText !== "string" || !csvText.trim()) {
      throw new Error("O arquivo CSV está vazio.");
    }

    const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
    const headerIndex = rows.findIndex((row) => {
      const normalized = row.map(normalizeLabel);
      return requiredHeaders.every((header) => normalized.includes(header));
    });

    if (headerIndex === -1) {
      throw new Error("O arquivo não possui as colunas esperadas do extrato Asaas.");
    }

    const headers = rows[headerIndex].map(normalizeLabel);
    const column = {
      date: headers.indexOf("data"),
      transactionId: headers.indexOf("transacao"),
      type: headers.indexOf("tipo de transacao"),
      value: headers.indexOf("valor"),
    };

    const records = rows
      .slice(headerIndex + 1)
      .filter((row) => row.some((value) => String(value || "").trim()))
      .map((row) => ({
        date: String(row[column.date] || "").trim(),
        transactionId: column.transactionId >= 0
          ? String(row[column.transactionId] || "").trim()
          : "",
        type: String(row[column.type] || "").trim(),
        rawValue: String(row[column.value] || "").trim(),
      }))
      .filter((record) => record.date && record.type && record.rawValue);

    if (!records.length) {
      throw new Error("O extrato não contém lançamentos para processar.");
    }

    const period = extractPeriod(rows.slice(0, headerIndex), records);
    const seenRelevantTransactions = new Set();
    const summary = {
      grossRevenue: 0,
      feesTotal: 0,
      pixWithdrawalsTotal: 0,
      otherMovementsTotal: 0,
      chargeCount: 0,
      feeCount: 0,
      pixWithdrawalCount: 0,
      otherMovementCount: 0,
      positiveFeeCount: 0,
    };

    for (const record of records) {
      const type = normalizeLabel(record.type);
      const isCharge = type === "cobranca recebida";
      const isFee = type.startsWith("taxa");
      const isPixWithdrawal = type === "transacao via pix";
      const isRelevant = isCharge || isFee;

      if (isRelevant && record.transactionId) {
        if (seenRelevantTransactions.has(record.transactionId)) {
          throw new Error(`O extrato contém a transação duplicada ${record.transactionId}.`);
        }
        seenRelevantTransactions.add(record.transactionId);
      }

      const value = parseMoney(record.rawValue);
      if (!Number.isFinite(value)) {
        if (isRelevant) {
          throw new Error(`Valor inválido em ${record.type}: ${record.rawValue}.`);
        }
        continue;
      }

      if (isCharge) {
        summary.grossRevenue += value;
        summary.chargeCount += 1;
      } else if (isFee) {
        summary.feesTotal += Math.abs(value);
        summary.feeCount += 1;
        if (value > 0) summary.positiveFeeCount += 1;
      } else if (isPixWithdrawal) {
        summary.pixWithdrawalsTotal += value;
        summary.pixWithdrawalCount += 1;
      } else {
        summary.otherMovementsTotal += value;
        summary.otherMovementCount += 1;
      }
    }

    if (!summary.chargeCount) {
      throw new Error("Nenhuma linha de “Cobrança recebida” foi encontrada.");
    }

    const rounded = Object.fromEntries(
      Object.entries(summary).map(([key, value]) => [
        key,
        key.endsWith("Total") || key === "grossRevenue" ? roundMoney(value) : value,
      ]),
    );
    const netRevenue = roundMoney(rounded.grossRevenue - rounded.feesTotal);

    if (netRevenue <= 0) {
      throw new Error("A receita líquida calculada não é maior que zero.");
    }

    return {
      ...rounded,
      netRevenue,
      period,
      sourceRecordCount: records.length,
    };
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];

      if (character === '"') {
        if (quoted && text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === "," && !quoted) {
        row.push(field);
        field = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += character;
      }
    }

    if (quoted) throw new Error("O arquivo CSV possui aspas não finalizadas.");
    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function extractPeriod(preambleRows, records) {
    const periodText = preambleRows.flat().find((value) => /per[ií]odo\s+a\s+partir/i.test(value));
    const match = periodText?.match(
      /per[ií]odo\s+a\s+partir\s+de\s+(\d{2}\/\d{2}\/\d{4})\s+at[eé]\s+(\d{2}\/\d{2}\/\d{4})/i,
    );
    const recordDates = records.map((record) => parseBrazilianDate(record.date)).filter(Boolean).sort();
    const start = match ? parseBrazilianDate(match[1]) : recordDates[0];
    const end = match ? parseBrazilianDate(match[2]) : recordDates.at(-1);

    if (!start || !end) {
      throw new Error("Não foi possível identificar o período do extrato.");
    }

    if (start.slice(0, 7) !== end.slice(0, 7)) {
      throw new Error("Use um extrato que contenha somente um mês calendário.");
    }

    return {
      start,
      end,
      key: start.slice(0, 7),
      label: `${formatBrazilianDate(start)} a ${formatBrazilianDate(end)}`,
    };
  }

  function parseBrazilianDate(value) {
    const match = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;

    const [, day, month, year] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      date.getUTCFullYear() !== Number(year)
      || date.getUTCMonth() !== Number(month) - 1
      || date.getUTCDate() !== Number(day)
    ) {
      return null;
    }

    return `${year}-${month}-${day}`;
  }

  function formatBrazilianDate(isoDate) {
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
  }

  function parseMoney(value) {
    let normalized = String(value || "")
      .trim()
      .replace(/R\$/gi, "")
      .replace(/\s/g, "");

    if (normalized.includes(",") && normalized.includes(".")) {
      normalized = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
        ? normalized.replaceAll(".", "").replace(",", ".")
        : normalized.replaceAll(",", "");
    } else if (normalized.includes(",")) {
      normalized = normalized.replaceAll(".", "").replace(",", ".");
    }

    return Number(normalized);
  }

  function normalizeLabel(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLocaleLowerCase("pt-BR")
      .replace(/\s+/g, " ");
  }

  function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  globalScope.AsaasCsv = Object.freeze({
    parseAsaasStatement,
    parseCsv,
  });
})(globalThis);
