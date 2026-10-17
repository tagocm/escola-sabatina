import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
import test from "node:test";

const source = readFileSync("lib/utils/image.ts", "utf8");
const image = await import(`data:text/javascript;base64,${Buffer.from(transpile(source)).toString("base64")}`);

function installImageMocks(t, options = {}) {
  const { failure, outputSize = 120_000, outputType = "image/webp" } = options;
  const calls = [];
  class Reader {
    readAsDataURL() {
      queueMicrotask(() => {
        if (failure === "read") this.onerror?.();
        else if (failure === "abort") this.onabort?.();
        else this.onload?.({ target: { result: "data:image/jpeg;base64,synthetic" } });
      });
    }
  }
  class MockImage {
    width = 4000;
    height = 3000;
    set src(value) {
      assert.ok(value.startsWith("data:image/"));
      queueMicrotask(() => failure === "decode" ? this.onerror?.() : this.onload?.());
    }
  }
  t.mock.method(globalThis, "setTimeout", (fn, delay) => {
    assert.equal(delay, 30_000);
    if (failure === "timeout") queueMicrotask(fn);
    return 1;
  });
  t.mock.method(globalThis, "clearTimeout", () => {});
  const previous = { FileReader: globalThis.FileReader, Image: globalThis.Image, document: globalThis.document };
  globalThis.FileReader = Reader;
  globalThis.Image = MockImage;
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "canvas");
      const canvas = {
        width: 0, height: 0,
        getContext() {
          if (failure === "context") return null;
          return { drawImage() { if (failure === "draw") throw new Error("synthetic canvas failure"); } };
        },
        toBlob(callback, type, quality) {
          calls.push({ width: this.width, height: this.height, type, quality });
          if (failure === "encode") throw new Error("synthetic encode failure");
          callback(failure === "blob" ? null : new Blob([new Uint8Array(outputSize)], { type: outputType }));
        },
      };
      return canvas;
    },
  };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  return calls;
}

const photo = (size = 8_000_000, type = "image/jpeg") => new File([new Uint8Array(size)], "synthetic.jpg", { type });

test("large original is decoded, resized, and submitted only once", async (t) => {
  const calls = installImageMocks(t);
  const original = photo();
  const prepared = await image.prepareStudentPhoto(original);
  assert.equal(prepared.type, "image/webp");
  assert.equal(prepared.name, "synthetic.webp");
  assert.equal(prepared.size, 120_000);
  assert.deepEqual(calls[0], { width: 1200, height: 900, type: "image/webp", quality: 0.9 });
  const body = new FormData();
  body.set("fullName", "Aluno de teste sintético");
  body.set("photo", prepared);
  body.set("photo", prepared);
  assert.equal(body.getAll("photo").length, 1);
  assert.equal([...body.values()].filter(value => value instanceof File).length, 1);
  assert.equal(body.has("photo_input"), false);
  assert.ok((await new Response(body).arrayBuffer()).byteLength < 4_500_000);
});

test("small files are also decoded rather than trusting their MIME type", async (t) => {
  const calls = installImageMocks(t);
  await image.prepareStudentPhoto(photo(1000, "image/heic"));
  assert.equal(calls.length, 1);
});

for (const failure of ["read", "abort", "decode", "context", "draw", "encode", "blob", "timeout"]) {
  test(`preparation rejects ${failure} failures instead of returning the original`, async (t) => {
    installImageMocks(t, { failure });
    await assert.rejects(image.prepareStudentPhoto(photo(1000, "image/heic")), /HEIC\/HEIF.*JPEG ou PNG/);
  });
}

test("rejects non-images, empty files, unsupported output, and oversized output", async (t) => {
  await assert.rejects(image.prepareStudentPhoto(photo(1, "text/plain")), /imagem válida/);
  await assert.rejects(image.prepareStudentPhoto(photo(0)), /imagem válida/);
  installImageMocks(t, { outputSize: 4_000_001 });
  await assert.rejects(image.prepareStudentPhoto(photo()), /menor que 4 MB/);
});

test("unsupported encoded output is rejected", async (t) => {
  installImageMocks(t, { outputType: "image/heic" });
  await assert.rejects(image.prepareStudentPhoto(photo()), /JPEG, PNG, WEBP ou AVIF/);
});

test("existing compressor keeps its fallback for other callers", async (t) => {
  installImageMocks(t, { failure: "decode" });
  const original = photo(1000);
  assert.equal(await image.compressImage(original), original);
});

test("picker never contributes an original file and releases preparation on failure", () => {
  const picker = readFileSync("components/ui/PolaroidPhoto.tsx", "utf8");
  const fileInput = picker.match(/<input[\s\S]*?type="file"[\s\S]*?\/>/)?.[0];
  assert.ok(fileInput);
  assert.doesNotMatch(fileInput, /\bname=/);
  assert.match(fileInput, /disabled=\{disabled \|\| isProcessing\}/);
  assert.match(picker, /onProcessingChange\?\.\(true\)[\s\S]*clearPreparedPhoto\(\)[\s\S]*await prepareStudentPhoto/);
  assert.match(picker, /finally\s*\{[\s\S]*setIsProcessing\(false\);\s*onProcessingChange\?\.\(false\)/);
  assert.match(picker, /type="button"\s+aria-label="Descartar foto selecionada"/);
  assert.match(picker, /onErrorChange\?\.\(message\)/);
});

for (const path of ["components/ui/StudentForm.tsx", "components/ui/GuardianStudentForm.tsx", "app/responsavel/filhos/[id]/page.tsx"]) {
  test(`${path}: guards preparation, permits retry, and preserves successful redirects`, () => {
    const form = readFileSync(path, "utf8");
    assert.match(form, /if \(isPending \|\| isPhotoProcessing \|\| photoError\) return;/);
    assert.match(form, /formData\.set\("photo", photoFile\)/);
    assert.match(form, /type="submit"\s+disabled=\{isPending \|\| isPhotoProcessing \|\| Boolean\(photoError\)\}/);
    assert.match(form, /catch \(error\) \{\s*unstable_rethrow\(error\);\s*setErrorMsg/);
    assert.match(form, /onProcessingChange=\{setIsPhotoProcessing\}/);
    assert.match(form, /onErrorChange=\{setPhotoError\}/);
  });
}

for (const path of ["components/ui/StudentForm.tsx", "components/ui/GuardianStudentForm.tsx", "app/responsavel/filhos/[id]/page.tsx"]) {
  test(`${path}: action failure is recoverable, validation errors are shown, redirects propagate`, async () => {
    const text = readFileSync(path, "utf8");
    const handlerSource = text.slice(text.indexOf("  const handleSubmit"), text.indexOf("\n  };", text.indexOf("  const handleSubmit")) + 5);
    let pending;
    let calls = 0;
    let mode = "reject";
    const messages = [];
    const redirect = new Error("synthetic redirect");
    const action = async (...args) => {
      calls++;
      const formData = args.at(-1);
      assert.equal(formData.getAll("photo").length, 1);
      if (mode === "reject") throw new Error("synthetic connection failure");
      if (mode === "redirect") throw redirect;
      if (mode === "validation") return { error: "synthetic validation error" };
    };
    const scope = {
      isPending: false, isPhotoProcessing: false, photoError: null,
      photoFile: photo(1000), initialData: undefined, student: null, studentId: "synthetic-id",
      setErrorMsg: (message) => messages.push(message),
      startTransition: (callback) => { pending = callback(); },
      unstable_rethrow: (error) => { if (error === redirect) throw error; },
      upsertStudentAction: action, createGuardianStudent: action, updateGuardianStudent: action,
      FormData: class extends FormData { constructor() { super(); this.set("fullName", "Synthetic Student"); } },
    };
    const handler = new Function("scope", `const { ${Object.keys(scope).join(", ")} } = scope; ${transpile(handlerSource)}; return handleSubmit;`)(scope);
    const event = { preventDefault() {}, currentTarget: {} };
    handler(event);
    await pending;
    assert.match(messages.at(-1), /Não foi possível salvar/);
    mode = "validation";
    handler(event);
    await pending;
    assert.equal(messages.at(-1), "synthetic validation error");
    mode = "redirect";
    handler(event);
    await assert.rejects(pending, error => error === redirect);
    assert.equal(messages.at(-1), null);
    assert.equal(calls, 3);

    for (const blocked of [{ isPending: true }, { isPhotoProcessing: true }, { photoError: "bad image" }]) {
      const guardedScope = { ...scope, ...blocked };
      const guardedHandler = new Function("scope", `const { ${Object.keys(scope).join(", ")} } = scope; ${transpile(handlerSource)}; return handleSubmit;`)(guardedScope);
      guardedHandler(event);
      assert.equal(calls, 3, "blocked submissions must not invoke the action");
    }
  });
}
