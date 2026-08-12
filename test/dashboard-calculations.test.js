import assert from "node:assert/strict";
import test from "node:test";

await import("../dashboard-calculations.js");

const { signedEntryAmount, summarizeEntries } = globalThis.DashboardCalculations;

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
