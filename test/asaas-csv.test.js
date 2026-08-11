import assert from "node:assert/strict";
import test from "node:test";

await import("../asaas-csv.js");

const { parseAsaasStatement, parseCsv } = globalThis.AsaasCsv;

const header = [
  "Data",
  "Transação",
  "Tipo de transação",
  "Transação estornada",
  "Descrição",
  "Valor",
  "Saldo",
  "Fatura do parcelamento",
  "Fatura da cobrança",
  "Nota fiscal",
  "Wallet",
  "Tipo do lançamento",
];

function csvRow(values) {
  return values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",");
}

function buildStatement(period, records) {
  return [
    csvRow(["", "", "", "", period, "", "", "", "", "", "", ""]),
    "",
    csvRow(header),
    "",
    ...records.map(csvRow),
  ].join("\n");
}

test("calcula cobranças menos taxas e ignora Pix e outros movimentos", () => {
  const statement = buildStatement(
    "Período a partir de 01/07/2026 até 31/07/2026",
    [
      ["08/07/2026", "1", "Cobrança recebida", "", "Cobrança, cliente A", "405.00", "", "", "", "", "", "Crédito"],
      ["09/07/2026", "2", "Cobrança recebida", "", "Cobrança cliente B", "382.91", "", "", "", "", "", "Crédito"],
      ["09/07/2026", "3", "Taxa de boleto, cartão ou Pix", "", "Taxa Pix", "-1.99", "", "", "", "", "", "Débito"],
      ["09/07/2026", "4", "Taxa de mensageria de fatura", "", "Taxa mensagem", "-0.99", "", "", "", "", "", "Débito"],
      ["09/07/2026", "5", "Taxa de notificação por WhatsApp", "", "Taxa WhatsApp", "-0.55", "", "", "", "", "", "Débito"],
      ["10/07/2026", "6", "Transação via Pix", "", "Retirada", "-1000.00", "", "", "", "", "", "Débito"],
      ["11/07/2026", "7", "Estorno de transação via Pix", "6", "Estorno retirada", "1000.00", "", "", "", "", "", "Crédito"],
    ],
  );

  const result = parseAsaasStatement(statement);

  assert.equal(result.grossRevenue, 787.91);
  assert.equal(result.feesTotal, 3.53);
  assert.equal(result.netRevenue, 784.38);
  assert.equal(result.chargeCount, 2);
  assert.equal(result.feeCount, 3);
  assert.equal(result.pixWithdrawalCount, 1);
  assert.equal(result.pixWithdrawalsTotal, -1000);
  assert.equal(result.otherMovementCount, 1);
  assert.equal(result.otherMovementsTotal, 1000);
  assert.deepEqual(result.period, {
    start: "2026-07-01",
    end: "2026-07-31",
    key: "2026-07",
    label: "01/07/2026 a 31/07/2026",
  });
});

test("aceita valores com vírgula decimal e cabeçalhos com acentos", () => {
  const statement = buildStatement(
    "Período a partir de 01/08/2026 até 31/08/2026",
    [
      ["02/08/2026", "10", "Cobrança recebida", "", "Receita", "1.250,50", "", "", "", "", "", "Crédito"],
      ["02/08/2026", "11", "Taxa de boleto, cartão ou Pix", "", "Taxa", "-2,50", "", "", "", "", "", "Débito"],
    ],
  );

  const result = parseAsaasStatement(statement);
  assert.equal(result.grossRevenue, 1250.5);
  assert.equal(result.feesTotal, 2.5);
  assert.equal(result.netRevenue, 1248);
});

test("rejeita extratos que abrangem mais de um mês", () => {
  const statement = buildStatement(
    "Período a partir de 01/07/2026 até 31/08/2026",
    [["02/07/2026", "20", "Cobrança recebida", "", "Receita", "100.00", "", "", "", "", "", "Crédito"]],
  );

  assert.throws(() => parseAsaasStatement(statement), /somente um mês calendário/);
});

test("rejeita transações relevantes duplicadas", () => {
  const statement = buildStatement(
    "Período a partir de 01/07/2026 até 31/07/2026",
    [
      ["02/07/2026", "30", "Cobrança recebida", "", "Receita", "100.00", "", "", "", "", "", "Crédito"],
      ["02/07/2026", "30", "Cobrança recebida", "", "Receita repetida", "100.00", "", "", "", "", "", "Crédito"],
    ],
  );

  assert.throws(() => parseAsaasStatement(statement), /transação duplicada 30/);
});

test("parser CSV preserva vírgulas e aspas dentro de campos", () => {
  assert.deepEqual(parseCsv('"a","b, c","d""e"\n'), [["a", "b, c", 'd"e']]);
});
