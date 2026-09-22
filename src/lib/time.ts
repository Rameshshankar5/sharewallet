const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "12m ago", "3h ago", then a date. */
export function relativeTime(ms: number, now = Date.now()): string {
  const delta = now - ms;
  if (delta < MINUTE) return 'just now';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d ago`;
  return formatDate(ms);
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  return `${formatDate(ms)} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

/** Heading for a group of rows: "Today", "Yesterday", or the date. */
export function dayLabel(ms: number, now = Date.now()): string {
  const a = new Date(ms); a.setHours(0, 0, 0, 0);
  const b = new Date(now); b.setHours(0, 0, 0, 0);
  const diffDays = Math.round((b.getTime() - a.getTime()) / DAY);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return formatDate(ms);
}

/** Groups any dated list into day buckets, newest first. */
export function groupByDay<T>(items: T[], getTime: (item: T) => number): { label: string; items: T[] }[] {
  const buckets = new Map<string, T[]>();
  const order: string[] = [];
  for (const item of items) {
    const key = dayLabel(getTime(item));
    if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
    buckets.get(key)!.push(item);
  }
  return order.map((label) => ({ label, items: buckets.get(label)! }));
}
