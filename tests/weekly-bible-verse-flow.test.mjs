import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const jsxRuntime = require("react/jsx-runtime");
const compiledModules = new Map();

// Execute the real TS/TSX bodies while explicitly replacing I/O and React hooks.
// This tests callbacks and rendered branches, not browser layout or React itself.
// An unexpected import fails closed instead of reaching a real service.
function loadModule(path, mocks = {}, browser = {}) {
  let compiled = compiledModules.get(path);
  if (!compiled) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    compiled = ts.transpileModule(source, {
      fileName: path,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    compiledModules.set(path, compiled);
  }
  const loadedModule = { exports: {} };
  const isolatedRequire = (name) => {
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unmocked import ${name} in ${path}`);
  };
  const execute = new Function("require", "module", "exports", "document", "window", compiled);
  execute(isolatedRequire, loadedModule, loadedModule.exports, browser.document, browser.window);
  return loadedModule.exports;
}

function allNodes(node) {
  if (Array.isArray(node)) return node.flatMap(allNodes);
  if (!node || typeof node !== "object") return [];
  return [node, ...allNodes(node.props?.children)];
}

function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  return textContent(node.props?.children);
}

function buttonNamed(tree, name) {
  const matches = allNodes(tree).filter((node) => node.type === "button"
    && (node.props["aria-label"] || textContent(node).trim()) === name);
  assert.equal(matches.length, 1, `Expected one button named ${name}`);
  return matches[0];
}

const defaultExport = (value) => ({ __esModule: true, default: value });
const icons = Object.fromEntries([
  "AlertTriangle", "ArrowLeft", "ArrowRight", "Check", "Minus", "Plus", "Save", "UserCircle", "X",
].map((name) => [name, `icon-${name}`]));
const calendar = loadModule("lib/calendar/sabbath-period.ts");
const studentDisplay = loadModule("lib/attendance/student-display.ts");
const weeklyVerse = {
  week_date: "2026-10-17",
  verse_text: "O Senhor é o meu pastor; nada me faltará.",
  bible_book: "Salmos",
  chapter_number: 23,
  verse_reference: "1",
};
const verseRule = {
  id: "period-rule-verse",
  sourceRuleId: "source-rule-verse",
  name: "Verso da semana",
  category: "espiritual",
  points: 5,
};

function createScoringHarness(overrides = {}) {
  const states = [];
  let cursor = 0;
  let effects = [];
  let cleanups = [];
  const transitions = [];
  const listeners = new Set();
  const saves = [];
  const savedItems = [];
  let closeCount = 0;
  const browser = {
    document: { body: { style: { overflow: "auto" } } },
    window: {
      addEventListener: (type, callback) => {
        assert.equal(type, "keydown");
        listeners.add(callback);
      },
      removeEventListener: (type, callback) => {
        assert.equal(type, "keydown");
        listeners.delete(callback);
      },
    },
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (next) => {
        states[index] = typeof next === "function" ? next(states[index]) : next;
      }];
    },
    useMemo: (callback) => callback(),
    useEffect: (effect) => effects.push(effect),
    useTransition: () => [false, (callback) => transitions.push(Promise.resolve(callback()))],
  };
  const modal = loadModule("components/ui/AttendanceVerseConfirmationModal.tsx", {
    react,
    "react-dom": { createPortal: (node) => node },
    "lucide-react": icons,
  }, browser).default;
  const sheet = loadModule("components/ui/AttendanceScoringSheet.tsx", {
    react,
    "react-dom": { createPortal: (node) => node },
    "next/image": defaultExport("image"),
    "lucide-react": icons,
    "@/app/actions/attendance": {
      async saveStudentAttendanceRecord(...args) {
        saves.push(args);
        return { success: true, totalPoints: args[3].includes(verseRule.id) ? 5 : 0 };
      },
    },
    "@/components/ui/AttendanceDisciplinePenaltyModal": defaultExport("discipline-modal"),
    "@/components/ui/AttendanceVerseConfirmationModal": defaultExport(modal),
    "@/components/ui/AppLoader": { ButtonLoader: "loader" },
    "@/components/ui/design-system": {},
    "@/lib/storage/student-photos": { getStudentPhotoSrc: () => null },
    "@/lib/attendance/student-display": studentDisplay,
  }, browser).default;
  const item = {
    full_name: "Aluno Exemplo",
    student: { id: "student-a", class_id: "class-a", full_name: "Aluno Exemplo", photo_url: null },
    initialSelectedRuleIds: [],
    initialExtraActivityPoints: 0,
    initialDisciplineEvents: [],
    initialTotalPoints: null,
    ...overrides.item,
  };
  const props = {
    classId: "class-a",
    periodId: "period-a",
    date: "2026-10-17",
    rules: [verseRule],
    isSaved: false,
    weeklyBibleVerse: null,
    onClose: () => { closeCount += 1; },
    onSaved: (updated) => savedItems.push(updated),
    ...overrides,
    item,
  };
  const harness = {
    saves,
    savedItems,
    get closeCount() { return closeCount; },
    tree: null,
    modalTree: null,
    render() {
      for (const cleanup of cleanups) cleanup();
      cleanups = [];
      effects = [];
      cursor = 0;
      this.tree = sheet(props);
      const modalNode = allNodes(this.tree).find((node) => node.type === modal);
      this.modalTree = modalNode ? modal(modalNode.props) : null;
      cleanups = effects.map((effect) => effect()).filter((cleanup) => typeof cleanup === "function");
      return this;
    },
    verseButton() {
      const button = allNodes(this.tree).find((node) => node.type === "button" && node.key === verseRule.id);
      assert.ok(button, "The verse criterion must remain available");
      return button;
    },
    isVerseSelected() {
      return allNodes(this.verseButton()).some((node) => node.type === "icon-Check");
    },
    clickVerse() {
      this.verseButton().props.onClick();
      return this.render();
    },
    answer(name) {
      buttonNamed(this.modalTree, name).props.onClick();
      return this.render();
    },
    escape() {
      for (const listener of [...listeners]) listener({ key: "Escape" });
      return this.render();
    },
    async save() {
      buttonNamed(this.tree, props.isSaved ? "Atualizar" : "Salvar").props.onClick();
      await Promise.all(transitions.splice(0));
      return this.render();
    },
  };
  return harness.render();
}

for (const [label, verse] of [["com verso cadastrado", weeklyVerse], ["sem verso cadastrado", null]]) {
  test(`Sabe exige confirmação e salva a pontuação ${label}`, async () => {
    const harness = createScoringHarness({ weeklyBibleVerse: verse });
    assert.equal(harness.isVerseSelected(), false);
    harness.clickVerse();
    assert.ok(harness.modalTree, "Selecting the criterion must open a confirmation");
    assert.equal(harness.isVerseSelected(), false, "Opening the modal must not award points yet");
    assert.equal(harness.saves.length, 0);
    if (verse) {
      assert.match(textContent(harness.modalTree), /O Senhor é o meu pastor/);
      assert.match(textContent(harness.modalTree), /Salmos 23:1/);
    } else {
      assert.match(textContent(harness.modalTree), /pontos mesmo sem o texto cadastrado/);
      assert.equal(allNodes(harness.modalTree).some((node) => node.type === "blockquote"), false);
    }
    harness.answer("Sabe");
    assert.equal(harness.modalTree, null);
    assert.equal(harness.isVerseSelected(), true);
    assert.equal(harness.saves.length, 0, "Confirmation alone must not persist the record");
    await harness.save();
    assert.deepEqual(harness.saves, [[
      "class-a", "2026-10-17", "student-a", [verseRule.id], 0, [],
      "Lançamento regular da pontuação semanal.", "period-a",
    ]]);
    assert.equal(harness.savedItems.length, 1);
    assert.deepEqual(harness.savedItems[0].initialSelectedRuleIds, [verseRule.id]);
    assert.equal(harness.savedItems[0].initialTotalPoints, 5);
    assert.equal(harness.closeCount, 1);
  });

  for (const dismissal of ["Não sabe", "Fechar", "Fechar confirmação do verso", "Escape"]) {
    test(`${dismissal} não marca nem salva o verso ${label}`, async () => {
      const harness = createScoringHarness({ weeklyBibleVerse: verse }).clickVerse();
      assert.ok(harness.modalTree);
      if (dismissal === "Escape") harness.escape();
      else harness.answer(dismissal);
      assert.equal(harness.modalTree, null);
      assert.equal(harness.isVerseSelected(), false);
      assert.equal(harness.closeCount, 0, "Dismissing the nested modal must leave the sheet open");
      assert.equal(harness.saves.length, 0);
      await harness.save();
      assert.deepEqual(harness.saves[0][3], []);
      assert.equal(harness.savedItems[0].initialTotalPoints, 0);
    });
  }

  test(`ponto existente pode ser desmarcado ${label}`, async () => {
    const harness = createScoringHarness({
      weeklyBibleVerse: verse,
      isSaved: true,
      item: { initialSelectedRuleIds: [verseRule.id], initialTotalPoints: 5 },
    });
    assert.equal(harness.isVerseSelected(), true);
    harness.clickVerse();
    assert.equal(harness.modalTree, null, "Removing an existing point needs no knowledge confirmation");
    assert.equal(harness.isVerseSelected(), false);
    await harness.save();
    assert.deepEqual(harness.saves[0][3], []);
    assert.equal(harness.savedItems[0].initialTotalPoints, 0);
  });

  for (const initiallySelected of [false, true]) {
    test(`consulta preserva ${initiallySelected ? "ponto existente" : "critério desmarcado"} ${label}`, () => {
      const harness = createScoringHarness({
        weeklyBibleVerse: verse,
        readOnly: true,
        item: {
          initialSelectedRuleIds: initiallySelected ? [verseRule.id] : [],
          initialTotalPoints: initiallySelected ? 5 : 0,
        },
      });
      assert.equal(harness.verseButton().props.disabled, true);
      harness.clickVerse(); // Invoke even the disabled handler to verify its own readOnly guard.
      assert.equal(harness.modalTree, null);
      assert.equal(harness.isVerseSelected(), initiallySelected);
      assert.equal(harness.saves.length, 0);
      assert.ok(buttonNamed(harness.tree, "Fechar consulta"));
      assert.equal(allNodes(harness.tree).some((node) => node.type === "button"
        && ["Salvar", "Atualizar"].includes(textContent(node).trim())), false);
    });
  }
}

async function renderAttendancePage({ classId, verse, canWrite = true }) {
  const calls = [];
  const recordCall = (name, value) => async (...args) => {
    calls.push([name, ...args]);
    return value;
  };
  const page = loadModule("app/relatorios/lancamento/page.tsx", {
    "next/navigation": { redirect: (url) => { throw new Error(`Unexpected redirect: ${url}`); } },
    "next/link": defaultExport("link"),
    "date-fns": require("date-fns"),
    "date-fns/locale": require("date-fns/locale"),
    "lucide-react": icons,
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "teacher-a" } } }) } }) },
    "@/app/actions/classes": {
      getActiveClassContext: async () => classId,
      getClassWeeklyBibleVerseByWeek: recordCall("verse", verse),
    },
    "@/app/actions/attendance": {
      getAttendanceContext: recordCall("attendance", { records: [], scores: [], day: null }),
    },
    "@/app/actions/scoring-periods": {
      getClassScoringPeriodContext: recordCall("period", {
        selectedPeriod: {
          id: "period-a", label: "4º trimestre", canWrite, requiresChangeReason: !canWrite,
          schedule: ["2026-10-10", "2026-10-17", "2026-10-24"],
        },
      }),
      getScoringPeriodStudents: recordCall("students", []),
      getScoringPeriodRules: recordCall("rules", [verseRule]),
    },
    "@/components/ui/Header": defaultExport("header"),
    "@/components/ui/PageHeader": defaultExport("page-header"),
    "@/components/ui/AttendanceStudentLists": defaultExport("student-lists"),
    "@/components/ui/ClassGallerySection": defaultExport("class-gallery"),
    "@/components/ui/design-system": {},
  }).default;
  const tree = await page({ searchParams: Promise.resolve({ d: "2026-10-17", period: "period-a" }) });
  return { tree, calls };
}

for (const classId of ["class-a", "class-b"]) {
  for (const verse of [weeklyVerse, null]) {
    test(`página busca o sábado exato 17/10/2026 na ${classId}, ${verse ? "com" : "sem"} verso`, async () => {
      const { tree, calls } = await renderAttendancePage({ classId, verse });
      assert.deepEqual(calls.filter(([name]) => name === "verse"), [["verse", classId, "2026-10-17"]]);
      assert.deepEqual(calls.find(([name]) => name === "attendance"), ["attendance", classId, "2026-10-17", "period-a"]);
      const list = allNodes(tree).find((node) => node.type === "student-lists");
      assert.ok(list);
      assert.equal(list.props.weeklyBibleVerse, verse);
      assert.equal(list.props.classId, classId);
      assert.equal(list.props.date, "2026-10-17");
      assert.equal(list.props.periodId, "period-a");
      assert.equal(list.props.readOnly, false);
    });
  }
}

test("página mantém o bloqueio de escrita do período", async () => {
  const { tree } = await renderAttendancePage({ classId: "class-a", verse: null, canWrite: false });
  const list = allNodes(tree).find((node) => node.type === "student-lists");
  assert.equal(list.props.readOnly, true);
  assert.equal(list.props.requiresChangeReason, true);
});

function createClassActionsHarness({ response = { data: weeklyVerse, error: null }, authError = null } = {}) {
  const queries = [];
  const invalidated = [];
  const supabase = {
    from(table) {
      const query = { table, operations: [] };
      queries.push(query);
      const builder = {
        then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); },
      };
      for (const method of ["select", "eq", "insert", "update", "maybeSingle"]) {
        builder[method] = (...args) => {
          query.operations.push([method, ...args]);
          return builder;
        };
      }
      return builder;
    },
  };
  const actions = loadModule("app/actions/classes.ts", {
    "@/lib/auth/guards": { requireTeacherAction: async () => authError ? { error: authError } : { supabase } },
    "@/lib/calendar/sabbath-period": calendar,
    "@/lib/supabase/server": { createClient: () => { throw new Error("Unexpected unguarded client"); } },
    "next/cache": { revalidatePath: (path) => invalidated.push(path) },
    "next/navigation": { redirect: () => { throw new Error("Unexpected redirect"); } },
  });
  return { actions, queries, invalidated };
}

function verseForm(overrides = {}) {
  const form = new FormData();
  for (const [name, value] of Object.entries({ ...weeklyVerse, ...overrides })) form.set(name, String(value));
  return form;
}

for (const verseId of [null, "verse-a"]) {
  test(`${verseId ? "atualização" : "cadastro"} preserva turma e sábado e invalida a chamada`, async () => {
    const { actions, queries, invalidated } = createClassActionsHarness();
    const result = await actions.saveClassWeeklyBibleVerseAction("class-a", verseForm(verseId ? { id: verseId } : {}));
    assert.deepEqual(result, { success: true });
    assert.equal(queries.length, 1);
    assert.equal(queries[0].table, "class_weekly_bible_verses");
    assert.deepEqual(queries[0].operations, [
      [verseId ? "update" : "insert", { class_id: "class-a", ...weeklyVerse }],
      ...(verseId ? [["eq", "id", verseId], ["eq", "class_id", "class-a"]] : []),
    ]);
    assert.deepEqual(invalidated, ["/classes/class-a", "/relatorios/lancamento"]);
  });
}

for (const classId of ["class-a", "class-b"]) {
  test(`consulta do verso mantém isolamento de ${classId} e data exata`, async () => {
    const { actions, queries, invalidated } = createClassActionsHarness();
    assert.equal(await actions.getClassWeeklyBibleVerseByWeek(classId, "2026-10-17"), weeklyVerse);
    assert.deepEqual(queries, [{
      table: "class_weekly_bible_verses",
      operations: [
        ["select", "id, week_date, verse_text, bible_book, chapter_number, verse_reference"],
        ["eq", "class_id", classId],
        ["eq", "week_date", "2026-10-17"],
        ["maybeSingle"],
      ],
    }]);
    assert.deepEqual(invalidated, []);
  });
}

test("consulta sem cadastro retorna null sem escrita", async () => {
  const { actions, queries, invalidated } = createClassActionsHarness({ response: { data: null, error: null } });
  assert.equal(await actions.getClassWeeklyBibleVerseByWeek("class-a", "2026-10-17"), null);
  assert.equal(queries.length, 1);
  assert.deepEqual(invalidated, []);
});

for (const invalidDate of ["2026-10-16", "2026-10-18", "2026-02-30", "17/10/2026"]) {
  test(`data ${invalidDate} não é deslocada silenciosamente nem consultada/salva`, async () => {
    const { actions, queries, invalidated } = createClassActionsHarness();
    const result = await actions.saveClassWeeklyBibleVerseAction("class-a", verseForm({ week_date: invalidDate }));
    assert.match(result.error, /sábado exato/);
    assert.equal(await actions.getClassWeeklyBibleVerseByWeek("class-a", invalidDate), null);
    assert.deepEqual(queries, []);
    assert.deepEqual(invalidated, []);
  });
}

test("ações preservam a autorização docente antes de consultar ou gravar versos", async () => {
  const { actions, queries, invalidated } = createClassActionsHarness({ authError: "Acesso negado" });
  assert.equal(await actions.getClassWeeklyBibleVerseByWeek("class-a", "2026-10-17"), null);
  assert.deepEqual(await actions.saveClassWeeklyBibleVerseAction("class-a", verseForm()), { error: "Acesso negado" });
  assert.deepEqual(queries, []);
  assert.deepEqual(invalidated, []);
});
