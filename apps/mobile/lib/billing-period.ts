export function billingPeriodLabel(period: string | null): string {
  const match = /^P(\d+)([DWMY])$/.exec(period ?? '');
  if (!match) return 'subscription period';
  const count = Number(match[1]);
  const unit = { D: 'day', W: 'week', M: 'month', Y: 'year' }[match[2]];
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}
