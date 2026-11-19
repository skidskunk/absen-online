// Timezone helper for Asia/Makassar (WITA, UTC+8)

export const TIMEZONE = "Asia/Makassar";

/**
 * Returns today's date in YYYY-MM-DD in Asia/Makassar (WITA)
 */
export function getWitaDateStr(dateInput?: Date | string): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

/**
 * Formats time as HH:mm in Asia/Makassar (WITA)
 */
export function formatWitaTime(dateInput?: Date | string | null): string {
  if (!dateInput || dateInput === "-") return "-";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return "-";
  }
}

/**
 * Formats date and time as YYYY-MM-DD HH:mm:ss in Asia/Makassar (WITA)
 */
export function formatWitaDateTime(dateInput?: Date | string | null): string {
  if (!dateInput || dateInput === "-") return "-";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return "-";
  }
}
