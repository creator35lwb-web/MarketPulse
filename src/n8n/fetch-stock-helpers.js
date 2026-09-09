// Missing or malformed prior closes must never become fabricated flat returns.
function stockDailyChange(price, meta) {
  const previousClose = [meta.chartPreviousClose, meta.previousClose]
    .find(value => typeof value === 'number' && Number.isFinite(value) && value > 0);
  if (previousClose === undefined) return { change: 'N/A', arrow: '' };
  const percent = ((price - previousClose) / previousClose) * 100;
  if (!Number.isFinite(percent)) return { change: 'N/A', arrow: '' };
  return {
    change: (percent >= 0 ? '+' : '') + percent.toFixed(2) + '%',
    arrow: percent >= 0 ? '▲' : '▼'
  };
}
