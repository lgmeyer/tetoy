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

  function calculateNpv(cashFlows, ratePerPeriod) {
    if (!Array.isArray(cashFlows) || !cashFlows.length) return null;
    if (!Number.isFinite(ratePerPeriod) || ratePerPeriod <= -1) return null;

    return cashFlows.reduce(
      (total, cashFlow, period) => total + Number(cashFlow) / ((1 + ratePerPeriod) ** period),
      0,
    );
  }

  function calculateIrr(cashFlows) {
    if (!Array.isArray(cashFlows) || cashFlows.length < 2) return null;

    const values = cashFlows.map(Number);
    if (values.some((value) => !Number.isFinite(value))) return null;
    if (!values.some((value) => value < 0) || !values.some((value) => value > 0)) return null;

    let lowerRate = -0.999999;
    let upperRate = 1;
    let lowerNpv = calculateNpv(values, lowerRate);
    let upperNpv = calculateNpv(values, upperRate);

    while (Number.isFinite(upperNpv) && lowerNpv * upperNpv > 0 && upperRate < 1_000_000) {
      upperRate *= 2;
      upperNpv = calculateNpv(values, upperRate);
    }

    if (Number.isNaN(lowerNpv) || Number.isNaN(upperNpv) || lowerNpv * upperNpv > 0) {
      return null;
    }

    for (let iteration = 0; iteration < 200; iteration += 1) {
      const middleRate = (lowerRate + upperRate) / 2;
      const middleNpv = calculateNpv(values, middleRate);

      if (Math.abs(middleNpv) < 1e-7) return middleRate;

      if (lowerNpv * middleNpv <= 0) {
        upperRate = middleRate;
        upperNpv = middleNpv;
      } else {
        lowerRate = middleRate;
        lowerNpv = middleNpv;
      }
    }

    return (lowerRate + upperRate) / 2;
  }

  function calculatePayback(cashFlows) {
    if (!Array.isArray(cashFlows) || !cashFlows.length) return null;

    let cumulative = Number(cashFlows[0]);
    if (!Number.isFinite(cumulative)) return null;
    if (cumulative >= 0) return 0;

    for (let period = 1; period < cashFlows.length; period += 1) {
      const cashFlow = Number(cashFlows[period]);
      if (!Number.isFinite(cashFlow)) return null;

      const previousCumulative = cumulative;
      cumulative += cashFlow;
      if (cumulative >= 0 && cashFlow > 0) {
        return (period - 1) + (-previousCumulative / cashFlow);
      }
    }

    return null;
  }

  function calculateViability({
    annualRate,
    months,
    monthlyNetInflow,
    residualValue = 0,
    actualMonthlyFlows = [],
  }) {
    const rate = Number(annualRate);
    const term = Number(months);
    const netInflow = Number(monthlyNetInflow);
    const residual = Number(residualValue);

    if (
      !Number.isFinite(rate)
      || rate < 0
      || !Number.isSafeInteger(term)
      || term <= 0
      || !Number.isFinite(netInflow)
      || netInflow <= 0
      || !Number.isFinite(residual)
      || residual < 0
    ) {
      return null;
    }

    const monthlyRate = ((1 + rate) ** (1 / 12)) - 1;
    const periodFlows = Array.from({ length: term }, (_, index) => {
      const actualValue = actualMonthlyFlows[index];
      return actualValue === null || actualValue === undefined
        ? netInflow
        : Number(actualValue);
    });

    if (
      periodFlows.some((value) => !Number.isFinite(value))
      || periodFlows[0] >= 0
    ) {
      return null;
    }

    periodFlows[term - 1] += residual;
    const cashFlows = [...periodFlows];
    const monthlyIrr = calculateIrr(cashFlows);

    return {
      cashFlows,
      monthlyRate,
      npv: calculateNpv(cashFlows, monthlyRate),
      monthlyIrr,
      annualIrr: monthlyIrr === null ? null : ((1 + monthlyIrr) ** 12) - 1,
      paybackMonths: calculatePayback(cashFlows),
      totalNetReturn: periodFlows.reduce((total, value) => total + value, 0),
      periodFlows,
      actualPeriodCount: actualMonthlyFlows
        .slice(0, term)
        .filter((value) => value !== null && value !== undefined).length,
      projectedPeriodCount: periodFlows.length - actualMonthlyFlows
        .slice(0, term)
        .filter((value) => value !== null && value !== undefined).length,
    };
  }

  globalScope.DashboardCalculations = {
    positiveAmount,
    signedEntryAmount,
    summarizeEntries,
    calculateNpv,
    calculateIrr,
    calculatePayback,
    calculateViability,
  };
})(globalThis);
