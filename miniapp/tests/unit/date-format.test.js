const DateFormat = require('../../utils/date-format');

describe('utils/date-format', () => {
  test('format() should return empty string for invalid input', () => {
    expect(DateFormat.format()).toBe('');
    expect(DateFormat.format('not-a-date')).toBe('');
  });

  test('format() should format date with default template', () => {
    const d = new Date('2026-03-05T10:00:00+08:00');
    expect(DateFormat.format(d)).toBe('2026-03-05');
  });

  test('format() should support time tokens', () => {
    // Use an explicit +08:00 offset to avoid env timezone differences
    const d = new Date('2026-03-05T01:02:03+08:00');
    expect(DateFormat.format(d, 'YYYY-MM-DD HH:mm:ss')).toBe('2026-03-05 01:02:03');
  });

  test('getBabyAge() should handle unborn/newborn/months/years', () => {
    // unborn
    const future = new Date();
    future.setMonth(future.getMonth() + 1);
    expect(DateFormat.getBabyAge(future)).toBe('还未出生');

    // newborn (same month)
    const now = new Date();
    expect(DateFormat.getBabyAge(now)).toBe('新生儿');

    // months < 12
    const m3 = new Date();
    m3.setMonth(m3.getMonth() - 3);
    expect(DateFormat.getBabyAge(m3)).toBe('3个月');

    // years
    const y1m2 = new Date();
    y1m2.setFullYear(y1m2.getFullYear() - 1);
    y1m2.setMonth(y1m2.getMonth() - 2);
    expect(DateFormat.getBabyAge(y1m2)).toMatch(/^1岁/);
  });
});
