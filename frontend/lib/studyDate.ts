export const STUDY_TIME_ZONE = "Asia/Singapore" as const

// Shared by browser views and API routes so "today" does not depend on the
// browser's location or the deployment server's timezone.
export function getStudyDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)!.value
  const date = `${part("year")}-${part("month")}-${part("day")}`
  const year = Number(part("year"))
  const month = Number(part("month"))
  const dayOfMonth = Number(part("day"))
  // Singapore has no daylight-saving changes: midnight is always 16:00 UTC.
  const start = new Date(`${date}T00:00:00+08:00`)
  const end = new Date(start.getTime() + 86400000)
  const dayOfYear = Math.floor(
    (Date.UTC(year, month - 1, dayOfMonth) - Date.UTC(year, 0, 1)) / 86400000,
  ) + 1

  return { date, start, end, year, month, dayOfMonth, dayOfYear }
}
