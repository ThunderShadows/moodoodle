/** True when `iso` falls on the same calendar day as `now` in the user's own timezone. */
export function isSameLocalDay(iso: string, now: Date = new Date()): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
