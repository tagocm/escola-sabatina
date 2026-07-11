export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SATURDAY_INDEX = 6;

function parseDateOnlyParts(value: string) {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, date };
}

function formatDateOnlyParts(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isDateOnly(value: string) {
  return parseDateOnlyParts(value) !== null;
}

export function assertDateOnly(value: string, label = "date") {
  if (!isDateOnly(value)) {
    throw new RangeError(`${label} must use a valid YYYY-MM-DD date.`);
  }

  return value;
}

export function compareDateOnly(left: string, right: string) {
  assertDateOnly(left, "left date");
  assertDateOnly(right, "right date");
  return left.localeCompare(right);
}

export function addDaysToDateOnly(value: string, daysToAdd: number) {
  const parsed = parseDateOnlyParts(value);
  if (!parsed) {
    throw new RangeError("date must use a valid YYYY-MM-DD date.");
  }

  if (!Number.isInteger(daysToAdd)) {
    throw new RangeError("daysToAdd must be an integer.");
  }

  parsed.date.setUTCDate(parsed.date.getUTCDate() + daysToAdd);
  return formatDateOnlyParts(
    parsed.date.getUTCFullYear(),
    parsed.date.getUTCMonth() + 1,
    parsed.date.getUTCDate(),
  );
}

export function getDateOnlyWeekday(value: string) {
  const parsed = parseDateOnlyParts(value);
  if (!parsed) {
    throw new RangeError("date must use a valid YYYY-MM-DD date.");
  }

  return parsed.date.getUTCDay();
}

export function isSaturdayDate(value: string) {
  return getDateOnlyWeekday(value) === SATURDAY_INDEX;
}

export function getNextOrSameSaturday(value: string) {
  const weekday = getDateOnlyWeekday(value);
  const daysUntilSaturday = (SATURDAY_INDEX - weekday + 7) % 7;
  return addDaysToDateOnly(value, daysUntilSaturday);
}

export function getPreviousOrSameSaturday(value: string) {
  const weekday = getDateOnlyWeekday(value);
  const daysSinceSaturday = (weekday - SATURDAY_INDEX + 7) % 7;
  return addDaysToDateOnly(value, -daysSinceSaturday);
}

export function buildSabbathSchedule(startDate: string, count = 13) {
  assertDateOnly(startDate, "startDate");

  if (!isSaturdayDate(startDate)) {
    throw new RangeError("startDate must be a Saturday.");
  }

  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError("count must be a positive integer.");
  }

  return Array.from({ length: count }, (_, index) => addDaysToDateOnly(startDate, index * 7));
}

export function getDateInTimeZone(date: Date, timeZone: string) {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("date must be valid.");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");

  if (!year || !month || !day) {
    throw new RangeError(`Unable to format date in time zone ${timeZone}.`);
  }

  return `${year}-${month}-${day}`;
}

export function getTodayInSaoPaulo(now = new Date()) {
  return getDateInTimeZone(now, SAO_PAULO_TIME_ZONE);
}

export function getCurrentOrNextSabbathInSaoPaulo(now = new Date()) {
  return getNextOrSameSaturday(getTodayInSaoPaulo(now));
}
