import {
  assertDateOnly,
  buildSabbathSchedule,
  compareDateOnly,
} from "../calendar/sabbath-period";

export const DEFAULT_SCORING_PERIOD_SATURDAYS = 13;

export type ScoringPeriodScheduleInput =
  | string
  | { date: string }
  | { dayDate: string };

export interface ScoringPeriodDefinition {
  id?: string | null;
  label?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  expectedSaturdays?: number | null;
  schedule?: readonly ScoringPeriodScheduleInput[];
}

export interface ResolvedScoringPeriod {
  id: string | null;
  label: string | null;
  startDate: string;
  endDate: string;
  expectedSaturdays: number;
  schedule: string[];
}

export interface ResolveScoringPeriodInput {
  period?: ScoringPeriodDefinition | null;
  schedule?: readonly ScoringPeriodScheduleInput[];
  startDate?: string | null;
  expectedSaturdays?: number | null;
}

function readScheduleDate(entry: ScoringPeriodScheduleInput) {
  if (typeof entry === "string") return entry;
  if ("date" in entry) return entry.date;
  return entry.dayDate;
}

export function normalizeScoringPeriodSchedule(entries: readonly ScoringPeriodScheduleInput[]) {
  return Array.from(new Set(entries.map((entry) => {
    const date = readScheduleDate(entry);
    return assertDateOnly(date, "schedule date");
  }))).sort(compareDateOnly);
}

export function resolveScoringPeriod({
  period,
  schedule,
  startDate,
  expectedSaturdays,
}: ResolveScoringPeriodInput): ResolvedScoringPeriod | null {
  const periodSchedule = normalizeScoringPeriodSchedule(schedule || period?.schedule || []);
  const explicitStartDate = period?.startDate || startDate || periodSchedule[0] || null;
  const requestedSaturdays = period?.expectedSaturdays
    ?? expectedSaturdays
    ?? (periodSchedule.length || DEFAULT_SCORING_PERIOD_SATURDAYS);

  if (!explicitStartDate && periodSchedule.length === 0) return null;
  if (!Number.isInteger(requestedSaturdays) || requestedSaturdays <= 0) {
    throw new RangeError("expectedSaturdays must be a positive integer.");
  }

  const normalizedStartDate = assertDateOnly(explicitStartDate!, "period startDate");
  const normalizedSchedule = periodSchedule.length > 0
    ? periodSchedule
    : buildSabbathSchedule(normalizedStartDate, requestedSaturdays);
  const normalizedEndDate = assertDateOnly(
    period?.endDate || normalizedSchedule.at(-1)!,
    "period endDate",
  );

  if (compareDateOnly(normalizedStartDate, normalizedEndDate) > 0) {
    throw new RangeError("period startDate must not be after endDate.");
  }

  if (
    normalizedSchedule.some((date) => (
      compareDateOnly(date, normalizedStartDate) < 0
      || compareDateOnly(date, normalizedEndDate) > 0
    ))
  ) {
    throw new RangeError("period schedule must stay inside startDate and endDate.");
  }

  if (normalizedSchedule.length !== requestedSaturdays) {
    throw new RangeError("period schedule length must match expectedSaturdays.");
  }

  return {
    id: period?.id || null,
    label: period?.label || null,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    expectedSaturdays: requestedSaturdays,
    schedule: normalizedSchedule,
  };
}

export function getElapsedScoringPeriodSaturdays(
  period: Pick<ResolvedScoringPeriod, "schedule">,
  currentDate: string,
) {
  assertDateOnly(currentDate, "currentDate");
  return period.schedule.filter((date) => compareDateOnly(date, currentDate) <= 0).length;
}

export function isDateInScoringPeriod(
  period: Pick<ResolvedScoringPeriod, "schedule">,
  date: string,
) {
  assertDateOnly(date, "date");
  return period.schedule.includes(date);
}

export function findScoringPeriodByDate(
  periods: readonly ScoringPeriodDefinition[],
  date: string,
) {
  assertDateOnly(date, "date");

  for (const definition of periods) {
    const period = resolveScoringPeriod({ period: definition });
    if (period && isDateInScoringPeriod(period, date)) return period;
  }

  return null;
}

/**
 * Temporary compatibility value for callers that have not started loading periods yet.
 * New calculations should pass `period` or `schedule` explicitly.
 */
export const LEGACY_SECOND_TRIMESTER_2026_START_DATE = "2026-04-11";
