/* ============================================================
   CLOCK
   The site is in Rajasthan. The twin always speaks IST so the
   demo does not drift with the laptop's timezone.
   ============================================================ */

const IST_OFFSET_MINUTES = 330;

export function nowIST(): Date {
  const local = new Date();

  return new Date(
    local.getTime() +
      local.getTimezoneOffset() * 60000 +
      IST_OFFSET_MINUTES * 60000
  );
}

export function istTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* Frame stamps need seconds: a two-second clock that only
   shows minutes reads as frozen. */
export function istClock(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function istDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function istHour(date: Date): number {
  return date.getHours();
}
