/* ============================================================
   NUMBER FORMATTING
   Indian digit grouping, fixed precision, explicit units.
   ============================================================ */

const inr = new Intl.NumberFormat("en-IN");

export function num(
  value: number,
  decimals = 0
): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
    .format(value)
    .replace("-", "−");
}

export function rupees(value: number): string {
  return `₹${inr.format(Math.round(value))}`;
}

/* Compact tonnes: 146,400 → 146.4k */
export function tonnes(value: number): string {
  const abs = Math.abs(value);

  if (abs >= 100000) {
    return `${num(value / 1000, 0)}k`;
  }

  if (abs >= 1000) {
    return `${num(value / 1000, 1)}k`;
  }

  return num(value, 0);
}

export function percent(
  value: number,
  decimals = 0
): string {
  return `${num(value * 100, decimals)}%`;
}

export function signed(
  value: number,
  decimals = 0
): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${num(value, decimals)}`;
}
