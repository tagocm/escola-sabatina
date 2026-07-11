import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import ts from "typescript";

function transpile(pathname) {
  const source = readFileSync(new URL(pathname, import.meta.url), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

const calendarOutput = transpile("../lib/calendar/sabbath-period.ts");
const calendarUrl = `data:text/javascript;base64,${Buffer.from(calendarOutput).toString("base64")}`;
const periodsOutput = transpile("../lib/scoring/periods.ts")
  .replace(/from "\.\.\/calendar\/sabbath-period"/g, `from "${calendarUrl}"`);
const periods = await import(`data:text/javascript;base64,${Buffer.from(periodsOutput).toString("base64")}`);

test("resolve período a partir do início e quantidade esperada", () => {
  const period = periods.resolveScoringPeriod({
    period: {
      id: "2026-q3",
      label: "3º trimestre de 2026",
      startDate: "2026-07-11",
      expectedSaturdays: 13,
    },
  });

  assert.deepEqual({
    id: period.id,
    label: period.label,
    startDate: period.startDate,
    endDate: period.endDate,
    expectedSaturdays: period.expectedSaturdays,
    first: period.schedule[0],
    last: period.schedule.at(-1),
  }, {
    id: "2026-q3",
    label: "3º trimestre de 2026",
    startDate: "2026-07-11",
    endDate: "2026-10-03",
    expectedSaturdays: 13,
    first: "2026-07-11",
    last: "2026-10-03",
  });
});

test("localiza períodos sem misturar a fronteira trimestral", () => {
  const definitions = [
    { id: "2026-q2", startDate: "2026-04-11", expectedSaturdays: 13 },
    { id: "2026-q3", startDate: "2026-07-11", expectedSaturdays: 13 },
  ];

  assert.equal(periods.findScoringPeriodByDate(definitions, "2026-07-04")?.id, "2026-q2");
  assert.equal(periods.findScoringPeriodByDate(definitions, "2026-07-11")?.id, "2026-q3");
  assert.equal(periods.findScoringPeriodByDate(definitions, "2026-07-10"), null);
});

test("conta sábados decorridos separadamente da agenda total", () => {
  const period = periods.resolveScoringPeriod({
    period: { startDate: "2026-07-11", expectedSaturdays: 13 },
  });

  assert.equal(periods.getElapsedScoringPeriodSaturdays(period, "2026-07-10"), 0);
  assert.equal(periods.getElapsedScoringPeriodSaturdays(period, "2026-07-11"), 1);
  assert.equal(periods.getElapsedScoringPeriodSaturdays(period, "2026-10-03"), 13);
  assert.equal(periods.getElapsedScoringPeriodSaturdays(period, "2026-12-31"), 13);
});

test("aceita agenda explícita e valida sua cardinalidade", () => {
  const schedule = ["2026-07-11", "2026-07-18"];
  const period = periods.resolveScoringPeriod({ schedule, expectedSaturdays: 2 });

  assert.deepEqual(period.schedule, schedule);
  assert.throws(
    () => periods.resolveScoringPeriod({ schedule, expectedSaturdays: 13 }),
    /length must match/,
  );
});
