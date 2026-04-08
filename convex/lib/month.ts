export function effectiveMonth(
  override_month: number | undefined,
  emission_ts: number | undefined
): number | null {
  if (override_month !== undefined) return override_month;
  if (emission_ts === undefined) return null;
  return new Date(emission_ts).getMonth() + 1;
}

export function effectiveYear(
  override_year: number | undefined,
  emission_ts: number | undefined
): number | null {
  if (override_year !== undefined) return override_year;
  if (emission_ts === undefined) return null;
  return new Date(emission_ts).getFullYear();
}
