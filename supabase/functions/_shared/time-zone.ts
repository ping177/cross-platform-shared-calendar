export type LocalDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function canonicalTimeZone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

function formatterFor(timeZone: string) {
  const cached = formatterCache.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function localParts(date: Date, timeZone: string): LocalDateTime {
  const values = Object.fromEntries(formatterFor(timeZone).formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]));

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
    millisecond: date.getMilliseconds(),
  };
}

function compareLocalDateTime(left: LocalDateTime, right: LocalDateTime) {
  const leftValue = Date.UTC(left.year, left.month - 1, left.day, left.hour, left.minute, left.second, left.millisecond);
  const rightValue = Date.UTC(right.year, right.month - 1, right.day, right.hour, right.minute, right.second, right.millisecond);
  return leftValue - rightValue;
}

export function addLocalDays(date: Pick<LocalDateTime, 'year' | 'month' | 'day'>, days: number) {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function timeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const local = localParts(date, timeZone);
  return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - Math.floor(date.getTime() / 1000) * 1000;
}

export function zonedDateTimeToInstant(local: LocalDateTime, timeZone: string) {
  const naive = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second, local.millisecond);
  let timestamp = naive;
  const offsetCandidates = [timestamp];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    timestamp = naive - timeZoneOffsetMilliseconds(new Date(timestamp), timeZone);
    offsetCandidates.push(timestamp);
  }

  const candidate = new Date(timestamp);
  if (compareLocalDateTime(localParts(candidate, timeZone), local) === 0) {
    return candidate;
  }

  const scanStart = naive - 18 * 60 * 60 * 1000;
  const scanEnd = naive + 18 * 60 * 60 * 1000;
  const scanPoint = (index: number) => new Date(scanStart + index * 60_000 + local.millisecond);
  const scanPointCount = Math.floor((scanEnd - scanStart) / 60_000) + 1;
  const comparedCandidates = offsetCandidates.map((candidateTimestamp) => ({
    timestamp: candidateTimestamp,
    comparison: compareLocalDateTime(localParts(new Date(candidateTimestamp), timeZone), local),
  }));
  const beforeGap = comparedCandidates
    .filter((entry) => entry.comparison < 0)
    .sort((left, right) => right.timestamp - left.timestamp)[0];
  const afterGap = comparedCandidates
    .filter((entry) => entry.comparison > 0 && (!beforeGap || entry.timestamp > beforeGap.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp)[0];

  if (beforeGap && afterGap) {
    // A forward offset jump makes the fixed-point candidates straddle the gap.
    // Search the existing minute probe grid instead of formatting all 2161 points.
    let lowerIndex = Math.max(0, Math.floor((beforeGap.timestamp - scanStart - local.millisecond) / 60_000));
    let upperIndex = Math.min(scanPointCount - 1, Math.ceil((afterGap.timestamp - scanStart - local.millisecond) / 60_000));

    while (lowerIndex > 0 && compareLocalDateTime(localParts(scanPoint(lowerIndex), timeZone), local) >= 0) {
      lowerIndex -= 1;
    }
    while (upperIndex < scanPointCount - 1 && compareLocalDateTime(localParts(scanPoint(upperIndex), timeZone), local) < 0) {
      upperIndex += 1;
    }

    while (lowerIndex + 1 < upperIndex) {
      const middleIndex = Math.floor((lowerIndex + upperIndex) / 2);
      const comparison = compareLocalDateTime(localParts(scanPoint(middleIndex), timeZone), local);
      if (comparison >= 0) {
        upperIndex = middleIndex;
      } else {
        lowerIndex = middleIndex;
      }
    }

    return scanPoint(upperIndex);
  }

  let firstAfterGap: Date | null = null;

  for (let index = 0; index < scanPointCount; index += 1) {
    const scanned = scanPoint(index);
    const comparison = compareLocalDateTime(localParts(scanned, timeZone), local);
    if (comparison === 0) {
      return scanned;
    }
    if (comparison > 0 && firstAfterGap === null) {
      firstAfterGap = scanned;
    }
  }

  return firstAfterGap ?? candidate;
}

export function localDateString(date: Date, timeZone: string) {
  const local = localParts(date, timeZone);
  return `${local.year.toString().padStart(4, '0')}-${local.month.toString().padStart(2, '0')}-${local.day.toString().padStart(2, '0')}`;
}
