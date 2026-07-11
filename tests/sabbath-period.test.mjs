import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/calendar/sabbath-period.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const calendar = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("calcula sábados sem depender do timezone do processo", () => {
  assert.equal(calendar.getNextOrSameSaturday("2026-07-10"), "2026-07-11");
  assert.equal(calendar.getNextOrSameSaturday("2026-07-11"), "2026-07-11");
  assert.equal(calendar.getNextOrSameSaturday("2026-07-12"), "2026-07-18");
  assert.equal(calendar.getPreviousOrSameSaturday("2026-07-12"), "2026-07-11");
});

test("monta os 13 sábados do terceiro trimestre de 2026", () => {
  const schedule = calendar.buildSabbathSchedule("2026-07-11", 13);

  assert.equal(schedule.length, 13);
  assert.equal(schedule[0], "2026-07-11");
  assert.equal(schedule.at(-1), "2026-10-03");
  assert.ok(schedule.every(calendar.isSaturdayDate));
});

test("respeita a virada de data em America/Sao_Paulo", () => {
  assert.equal(
    calendar.getTodayInSaoPaulo(new Date("2026-07-11T02:59:59Z")),
    "2026-07-10",
  );
  assert.equal(
    calendar.getTodayInSaoPaulo(new Date("2026-07-11T03:00:00Z")),
    "2026-07-11",
  );
  assert.equal(
    calendar.getCurrentOrNextSabbathInSaoPaulo(new Date("2026-07-12T02:59:59Z")),
    "2026-07-11",
  );
});

test("rejeita datas inválidas e início fora do sábado", () => {
  assert.equal(calendar.isDateOnly("2026-02-29"), false);
  assert.throws(() => calendar.buildSabbathSchedule("2026-07-10", 13), /Saturday/);
});
