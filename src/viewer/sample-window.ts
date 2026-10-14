/** Epoch-sorted disposable rows; retain every edge/duplicate in the requested
 * interval. This selects display vertices, never canonical integration steps. */
export function epochIndex<T extends { t: number }>(
  rows: readonly T[],
  epoch: number,
  after = false,
) {
  let lo = 0,
    hi = rows.length;
  while (lo < hi) {
    const middle = (lo + hi) >>> 1;
    if (rows[middle].t < epoch || (after && rows[middle].t === epoch))
      lo = middle + 1;
    else hi = middle;
  }
  return lo;
}
export function sampleWindow<T extends { t: number }>(
  rows: readonly T[],
  start: number,
  end: number,
  includeStart = true,
  includeEnd = true,
): T[] {
  if (end < start) return [];
  return rows.slice(
    epochIndex(rows, start, !includeStart),
    epochIndex(rows, end, includeEnd),
  );
}
