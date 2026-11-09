// Pure helpers for the loyalty mission periodicity engine.
//
// A mission repeats on an interval ('daily' | 'weekly' | 'once'). Progress is
// computed per *period* (a day, an ISO week, or all-time), and a customer can
// claim each mission once per period. These helpers derive the period's unique
// key and its start boundary from a mission row + an instant in time, so the
// same inputs always award/claim within the same bucket.

export const MISSION_METRICS = ['orders'];

export const MISSION_REPEATS = ['daily', 'weekly', 'once'];

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Monday 00:00 local time of the week containing the given date.
export function startOfWeek(date) {
  const d = startOfDay(date);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

// ISO-8601 calendar week: { year, week } (weeks start Monday; week 1
// contains the first Thursday of the year).
export function isoWeekOfYear(date) {
  // Noon UTC markers avoid DST/timezone edge effects on date arithmetic.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of the ISO week

  const isoYear = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4, 12));
  const firstDayNum = (jan4.getUTCDay() + 6) % 7;
  const firstThursday = new Date(jan4);
  firstThursday.setUTCDate(jan4.getUTCDate() - firstDayNum + 3);

  const week = 1 + Math.round((d - firstThursday) / (7 * 86400000));
  return { year: isoYear, week };
}

/**
 * Returns { key, start } for the period containing `now`, for the given mission.
 * `key` is the unique claim bucket id (one claim per customer per key),
 * `start` the local instant from which progress (completed orders) counts.
 *
 * - daily  → key 'D-YYYY-MM-DD', start midnight today
 * - weekly → key 'W-YYYY-Www',   start Monday midnight (ISO week)
 * - once   → key 'once',         start epoch (progress counts all-time)
 */
export function missionPeriod(mission, now = new Date()) {
  const repeat = (mission?.repeat_interval ?? 'daily').toString().toLowerCase();
  if (repeat === 'once') {
    return { key: 'once', start: new Date(1970, 0, 1) };
  }
  if (repeat === 'weekly') {
    const start = startOfWeek(now);
    const { year, week } = isoWeekOfYear(start);
    return { key: `W-${year}-W${String(week).padStart(2, '0')}`, start };
  }
  // daily (default)
  const start = startOfDay(now);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    key: `D-${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    start,
  };
}
