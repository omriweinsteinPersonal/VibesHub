/** Show the most recent days first without mutating the server response. */
export function visibleAnalyticsDays<T>(days: readonly T[], showAll: boolean): T[] {
  const newestFirst = [...days].reverse();
  return showAll ? newestFirst : newestFirst.slice(0, 7);
}
