import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missionPeriod, isoWeekOfYear, startOfWeek } from '../src/services/missions.js';

// Fixed instants (local time) so results are deterministic regardless of TZ.
const noTimezoneDrift = (actual, expectedKey, expectedStartKey) => {
  assert.equal(actual.key, expectedKey);
  assert.equal(
    `${actual.start.getFullYear()}-${actual.start.getMonth()}-${actual.start.getDate()}`,
    expectedStartKey
  );
};

test('daily: key is the local calendar date, start is midnight', () => {
  noTimezoneDrift(missionPeriod({ repeat_interval: 'daily' }, new Date(2026, 10, 9, 15, 42)), 'D-2026-11-09', '2026-10-9');
});

test('daily: default repeat (missing field) behaves as daily', () => {
  noTimezoneDrift(missionPeriod({}, new Date(2026, 0, 2)), 'D-2026-01-02', '2026-0-2');
});

test('weekly: same ISO week maps to one key', () => {
  // Mon 2026-11-09 .. Sun 2026-11-15 = ISO 2026-W46 (its Thursday is Nov 12)
  const monday = missionPeriod({ repeat_interval: 'weekly' }, new Date(2026, 10, 9));
  const wednesday = missionPeriod({ repeat_interval: 'weekly' }, new Date(2026, 10, 11, 18, 0));
  const sunday = missionPeriod({ repeat_interval: 'weekly' }, new Date(2026, 10, 15, 23, 30));
  assert.equal(monday.key, 'W-2026-W46');
  assert.equal(wednesday.key, 'W-2026-W46');
  assert.equal(sunday.key, 'W-2026-W46');
});

test('weekly: start is Monday midnight local', () => {
  noTimezoneDrift(missionPeriod({ repeat_interval: 'weekly' }, new Date(2026, 10, 11, 10, 0)), 'W-2026-W46', '2026-10-9');
  // Sunday Nov 8 2026 belongs to the week that started Mon Nov 2
  noTimezoneDrift(missionPeriod({ repeat_interval: 'weekly' }, new Date(2026, 10, 8, 22, 0)), 'W-2026-W45', '2026-10-2');
});

test('weekly: ISO year edge — Jan 1 2021 (Friday) is 2020-W53', () => {
  noTimezoneDrift(missionPeriod({ repeat_interval: 'weekly' }, new Date(2021, 0, 1)), 'W-2020-W53', '2020-11-28');
  // Its start Monday is 2020-12-28
});

test('weekly: Jan 1 2026 (Thursday) is 2026-W01', () => {
  const { year, week } = isoWeekOfYear(new Date(2026, 0, 1));
  assert.equal(year, 2026);
  assert.equal(week, 1);
});

test('once: constant key, epoch start (all-time progress)', () => {
  const p = missionPeriod({ repeat_interval: 'once' }, new Date(2026, 10, 9));
  assert.equal(p.key, 'once');
  assert.equal(p.start.getTime(), new Date(1970, 0, 1).getTime());
});

test('compact weekly key string is stable over a 10-year span of known dates', () => {
  const cases = [
    [new Date(2016, 0, 3), 'W-2015-W53'], // Sunday → last week of 2015
    [new Date(2019, 11, 30), 'W-2020-W01'],
    [new Date(2026, 2, 1), 'W-2026-W09'],
  ];
  for (const [d, expected] of cases) {
    assert.equal(missionPeriod({ repeat_interval: 'weekly' }, d).key, expected);
  }
});

test('startOfWeek always returns Monday', () => {
  for (let day = 2; day <= 8; day++) {
    // Feb 2018: Feb 2 = Friday, Feb 8 = Thursday — covers a full Mon–Sun span
    const start = startOfWeek(new Date(2018, 1, day));
    assert.equal(start.getDay(), 1);
    assert.equal(start.getHours(), 0);
    assert.equal(start.getMinutes(), 0);
  }
});
