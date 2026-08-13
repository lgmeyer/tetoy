import assert from "node:assert/strict";
import test from "node:test";

await import("../dashboard-calculations.js");

const {
  signedEntryAmount,
  summarizeEntries,
  calculateNpv,
  calculateIrr,
  calculatePayback,
  calculateViability,
} = globalThis.DashboardCalculations;

test("trata crédito como positivo e débito como negativo", () => {
  assert.equal(signedEntryAmount({ value: 120, direction: "credit" }), 120);
  assert.equal(signedEntryAmount({ value: 45, direction: "debit" }), -45);
});

test("calcula o resultado líquido somando créditos e subtraindo débitos", () => {
  assert.deepEqual(
    summarizeEntries([
      { value: 300, direction: "credit" },
      { value: 80, direction: "debit" },
      { value: 25, direction: "debit" },
    ]),
    { credit: 300, debit: 105, net: 195 },
  );
});

test("mantém o resultado negativo quando os débitos superam os créditos", () => {
  assert.deepEqual(
    summarizeEntries([
      { value: 70, direction: "credit" },
      { value: 100, direction: "debit" },
    ]),
    { credit: 70, debit: 100, net: -30 },
  );
});

test("calcula VPL de um fluxo de caixa periódico", () => {
  assert.ok(Math.abs(calculateNpv([-1000, 400, 400, 400], 0.1) - -5.2592) < 0.001);
});

test("calcula TIR por período", () => {
  assert.ok(Math.abs(calculateIrr([-1000, 600, 600]) - 0.130662) < 0.000001);
  assert.ok(calculateIrr([-1_000_000, ...Array(600).fill(1)]) < 0);
  assert.equal(calculateIrr([-1000, -200, -100]), null);
});

test("calcula payback com fração do período e identifica quando não há retorno", () => {
  assert.equal(calculatePayback([-1000, 300, 300, 300, 300]), 3.3333333333333335);
  assert.equal(calculatePayback([-1000, 200, 200]), null);
});

test("calcula a viabilidade mensal e anualiza a TIR", () => {
  const result = calculateViability({
    initialInvestment: 10000,
    annualRate: 0.12,
    months: 24,
    monthlyNetInflow: 600,
  });

  assert.ok(result.npv > 2000);
  assert.ok(result.annualIrr > 0.4);
  assert.equal(result.paybackMonths, 16.666666666666668);
  assert.equal(result.totalNetReturn, 4400);
});

test("usa valores realizados, projeta apenas períodos sem dados e soma o residual no fim", () => {
  const result = calculateViability({
    initialInvestment: 1000,
    annualRate: 0,
    months: 4,
    monthlyNetInflow: 300,
    residualValue: 500,
    actualMonthlyFlows: [100, 200, null, undefined],
  });

  assert.deepEqual(result.cashFlows, [-1000, 100, 200, 300, 800]);
  assert.equal(result.npv, 400);
  assert.equal(result.totalNetReturn, 400);
  assert.equal(result.actualPeriodCount, 2);
  assert.equal(result.projectedPeriodCount, 2);
});

test("rejeita dados incompletos ou fora dos limites", () => {
  assert.equal(calculateViability({ initialInvestment: 0, annualRate: 0.1, months: 12, monthlyNetInflow: 500 }), null);
  assert.equal(calculateViability({ initialInvestment: 1000, annualRate: -0.1, months: 12, monthlyNetInflow: 500 }), null);
  assert.equal(calculateViability({ initialInvestment: 1000, annualRate: 0.1, months: 12, monthlyNetInflow: 500, residualValue: -1 }), null);
});
