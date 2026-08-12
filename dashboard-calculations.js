(function registerDashboardCalculations(globalScope) {
  function positiveAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.abs(amount) : 0;
  }

  function signedEntryAmount(entry) {
    const amount = positiveAmount(entry?.value);
    return entry?.direction === "debit" ? -amount : amount;
  }

  function summarizeEntries(entries) {
    return entries.reduce(
      (summary, entry) => {
        const amount = positiveAmount(entry?.value);

        if (entry?.direction === "debit") {
          summary.debit += amount;
        } else {
          summary.credit += amount;
        }

        summary.net += signedEntryAmount(entry);
        return summary;
      },
      { credit: 0, debit: 0, net: 0 },
    );
  }

  globalScope.DashboardCalculations = {
    positiveAmount,
    signedEntryAmount,
    summarizeEntries,
  };
})(globalThis);
