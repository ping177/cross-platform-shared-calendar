// Shared by browser consumers and future Edge Function consumers. No clocks,
// timezone conversion, persistence, Event recurrence, or presentation strings.
export type CivilDate = { year: number; month: number; day: number };
export type ImportantDateFields = {
  repeat_kind: 'annual' | 'none';
  year: number | null;
  month: number;
  day: number;
};

export type ImportantDateValidation =
  | { ok: true; value: ImportantDateFields }
  | { ok: false; error: 'invalid_fields' | 'invalid_repeat_kind' | 'year_required' | 'invalid_year' | 'invalid_month' | 'invalid_day' };

export type ImportantDateDisplay =
  | { kind: 'countdown'; nextOccurrence: CivilDate; daysUntil: number }
  | { kind: 'today'; nextOccurrence: CivilDate; daysUntil: 0 }
  | { kind: 'day-count'; nextOccurrence: CivilDate; daysUntil: number; dayCount: number;
      nextAnniversary: { years: number; date: CivilDate; daysUntil: number } }
  | { kind: 'anniversary'; nextOccurrence: CivilDate; daysUntil: 0; anniversary: number; dayCount: number }
  | { kind: 'past'; nextOccurrence: null; originalDate: CivilDate; elapsedDays: number };

function validYear(value: unknown): value is number {
  // Leave arithmetic headroom for a following annual occurrence. This is a
  // numeric safety bound, not a Date constructor's 1900 offset or timestamp range.
  return typeof value === 'number' && Number.isSafeInteger(value)
    && value > 0 && value < Math.floor(Number.MAX_SAFE_INTEGER / 366);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function validateImportantDateFields(value: unknown): ImportantDateValidation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'invalid_fields' };
  const { repeat_kind, year, month, day } = value as Record<string, unknown>;
  if (repeat_kind !== 'annual' && repeat_kind !== 'none') return { ok: false, error: 'invalid_repeat_kind' };
  if (repeat_kind === 'none' && year === null) return { ok: false, error: 'year_required' };
  if (year !== null && !validYear(year)) return { ok: false, error: 'invalid_year' };
  if (typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12) return { ok: false, error: 'invalid_month' };
  // A yearless annual February 29 is valid; a supplied anchor must be a real date.
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > daysInMonth(year ?? 2000, month)) {
    return { ok: false, error: 'invalid_day' };
  }
  return { ok: true, value: { repeat_kind, year, month, day } };
}

function requireFields(fields: ImportantDateFields): ImportantDateFields {
  const result = validateImportantDateFields(fields);
  if (!result.ok) throw new RangeError(result.error);
  return result.value;
}

function requireCivilDate(value: CivilDate): void {
  const result = validateImportantDateFields({ ...value, repeat_kind: 'none' });
  if (!result.ok) throw new RangeError(`Invalid civil date: ${result.error}`);
}

// Integer Gregorian ordinal, with 0001-01-01 at zero. Never construct an instant
// or divide a local-midnight duration: DST and device timezone cannot affect it.
function ordinal(date: CivilDate): number {
  const priorYear = date.year - 1;
  let days = priorYear * 365 + Math.floor(priorYear / 4) - Math.floor(priorYear / 100) + Math.floor(priorYear / 400);
  for (let month = 1; month < date.month; month += 1) days += daysInMonth(date.year, month);
  return days + date.day - 1;
}

function resolveValidated(fields: ImportantDateFields, targetYear: number): CivilDate | null {
  if (fields.repeat_kind === 'none') {
    return targetYear === fields.year ? { year: targetYear, month: fields.month, day: fields.day } : null;
  }
  if (fields.year !== null && targetYear < fields.year) return null;
  return { year: targetYear, month: fields.month, day: Math.min(fields.day, daysInMonth(targetYear, fields.month)) };
}

export function resolveImportantDateOccurrence(fields: ImportantDateFields, targetYear: number): CivilDate | null {
  const validated = requireFields(fields);
  if (!validYear(targetYear)) throw new RangeError('Invalid target year');
  return resolveValidated(validated, targetYear);
}

function nextValidated(fields: ImportantDateFields, today: CivilDate): CivilDate | null {
  if (fields.repeat_kind === 'none') {
    const date = { year: fields.year!, month: fields.month, day: fields.day };
    return ordinal(date) >= ordinal(today) ? date : null;
  }
  const targetYear = Math.max(today.year, fields.year ?? today.year);
  const candidate = resolveValidated(fields, targetYear)!;
  if (ordinal(candidate) >= ordinal(today)) return candidate;
  if (!validYear(targetYear + 1)) throw new RangeError('Next occurrence exceeds safe year arithmetic');
  return resolveValidated(fields, targetYear + 1);
}

export function nextImportantDateOccurrence(fields: ImportantDateFields, today: CivilDate): CivilDate | null {
  const validated = requireFields(fields);
  requireCivilDate(today);
  return nextValidated(validated, today);
}

// Typed display data only. Callers choose labels; no UI copy belongs in the date engine.
export function deriveImportantDateDisplay(fields: ImportantDateFields, today: CivilDate): ImportantDateDisplay {
  const validated = requireFields(fields);
  requireCivilDate(today);
  const nextOccurrence = nextValidated(validated, today);
  const todayOrdinal = ordinal(today);
  if (!nextOccurrence) {
    const originalDate = { year: validated.year!, month: validated.month, day: validated.day };
    return { kind: 'past', nextOccurrence: null, originalDate, elapsedDays: todayOrdinal - ordinal(originalDate) };
  }
  const daysUntil = ordinal(nextOccurrence) - todayOrdinal;
  if (validated.repeat_kind === 'annual' && validated.year !== null) {
    const anchor = { year: validated.year, month: validated.month, day: validated.day };
    if (todayOrdinal >= ordinal(anchor)) {
      const dayCount = todayOrdinal - ordinal(anchor) + 1;
      const anniversary = nextOccurrence.year - anchor.year;
      if (daysUntil === 0 && anniversary > 0) {
        return { kind: 'anniversary', nextOccurrence, daysUntil: 0, anniversary, dayCount };
      }
      // On Day 1, nextOccurrence is today, but the first anniversary is next year.
      const anniversaryDate = anniversary > 0 ? nextOccurrence : resolveImportantDateOccurrence(validated, anchor.year + 1)!;
      return { kind: 'day-count', nextOccurrence, daysUntil, dayCount,
        nextAnniversary: { years: anniversaryDate.year - anchor.year, date: anniversaryDate, daysUntil: ordinal(anniversaryDate) - todayOrdinal } };
    }
  }
  return daysUntil === 0 ? { kind: 'today', nextOccurrence, daysUntil: 0 }
    : { kind: 'countdown', nextOccurrence, daysUntil };
}
