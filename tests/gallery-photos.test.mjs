import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

const repoRoot = process.cwd();

async function loadTypeScriptModule(relativePath) {
  const absolutePath = join(repoRoot, relativePath);
  assert.ok(existsSync(absolutePath), `${relativePath} should exist`);

  const source = readFileSync(absolutePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

function readLatestGalleryMigration() {
  const migrationsDir = join(repoRoot, "supabase", "migrations");
  const migrationName = readdirSync(migrationsDir)
    .filter((name) => name.endsWith("_class_gallery_photos.sql"))
    .sort()
    .at(-1);

  assert.ok(migrationName, "class gallery migration should exist");
  return readFileSync(join(migrationsDir, migrationName), "utf8");
}

test("normaliza qualquer data da semana para o sábado correspondente", async () => {
  const {
    normalizeSabbathDateInput,
    buildClassGalleryPhotoPath,
    GALLERY_PHOTO_TAGS,
    formatGalleryPhotoTagLabel,
    normalizeGalleryPhotoTags,
  } = await loadTypeScriptModule("lib/gallery/sabbath.ts");

  assert.equal(normalizeSabbathDateInput("2026-06-16"), "2026-06-20");
  assert.equal(normalizeSabbathDateInput("2026-06-20"), "2026-06-20");
  assert.equal(normalizeSabbathDateInput(""), null);
  assert.equal(normalizeSabbathDateInput("data inválida"), null);

  assert.match(
    buildClassGalleryPhotoPath("class-123", "2026-06-20", "image/jpeg"),
    /^class-123\/2026-06-20\/[0-9a-f-]+\.jpg$/,
  );

  assert.deepEqual(
    GALLERY_PHOTO_TAGS.map((tag) => tag.value),
    ["ofertorio", "momento_musical", "carta_missionaria", "concurso", "estudo_licao"],
  );
  assert.deepEqual(
    normalizeGalleryPhotoTags(["momento_musical", "concurso", "momento_musical", "invalida"]),
    ["momento_musical", "concurso"],
  );
  assert.deepEqual(normalizeGalleryPhotoTags([]), []);
  assert.equal(formatGalleryPhotoTagLabel("estudo_licao"), "Estudo da Lição");
});

test("migration da galeria cria tabela, bucket privado e policies por vínculo", () => {
  const migrationSql = readLatestGalleryMigration();

  assert.match(
    migrationSql,
    /CREATE TABLE IF NOT EXISTS public\.class_gallery_photos/i,
    "migration should create class gallery table",
  );
  assert.match(
    migrationSql,
    /week_date DATE NOT NULL/i,
    "gallery photos should be grouped by sabbath date",
  );
  assert.match(
    migrationSql,
    /storage_path TEXT NOT NULL UNIQUE/i,
    "gallery rows should persist the storage object path",
  );
  assert.match(
    migrationSql,
    /tags TEXT\[\] NOT NULL/i,
    "gallery photos should store controlled tags",
  );
  assert.match(
    migrationSql,
    /cardinality\(tags\) > 0/i,
    "gallery photos should require at least one tag",
  );
  assert.match(
    migrationSql,
    /'ofertorio', 'momento_musical', 'carta_missionaria', 'concurso', 'estudo_licao'/i,
    "gallery tags should be constrained to the expected lesson moments",
  );
  assert.match(
    migrationSql,
    /ALTER TABLE public\.class_gallery_photos ENABLE ROW LEVEL SECURITY/i,
    "gallery table should have RLS enabled",
  );
  assert.match(
    migrationSql,
    /GRANT SELECT, INSERT, DELETE ON public\.class_gallery_photos TO authenticated/i,
    "new public table should be explicitly exposed to authenticated clients",
  );
  assert.match(
    migrationSql,
    /CREATE OR REPLACE FUNCTION public\.can_access_class_gallery_photo/i,
    "storage reads should be guarded by a metadata-aware helper",
  );
  assert.match(
    migrationSql,
    /class_gallery_photos_select_guardian/i,
    "guardians should have a scoped SELECT policy",
  );
  assert.match(
    migrationSql,
    /bucket_id = 'class-gallery-photos'/i,
    "migration should create policies for the private gallery bucket",
  );
  assert.match(
    migrationSql,
    /storage_insert_class_gallery_photo_teacher/i,
    "teachers should be allowed to upload gallery objects for their class",
  );
  assert.match(
    migrationSql,
    /storage_select_class_gallery_photo_scoped/i,
    "gallery object downloads should be scoped through RLS",
  );
});

test("fluxo do professor fica integrado à tela de chamada", () => {
  const attendancePageSource = readFileSync(join(repoRoot, "app", "relatorios", "lancamento", "page.tsx"), "utf8");
  const galleryActionSource = readFileSync(join(repoRoot, "app", "actions", "gallery.ts"), "utf8");
  const galleryFormSource = readFileSync(join(repoRoot, "components", "ui", "ClassGalleryUploadForm.tsx"), "utf8");

  assert.match(
    attendancePageSource,
    /import ClassGallerySection from "@\/components\/ui\/ClassGallerySection"/,
    "attendance page should import the class gallery section",
  );
  assert.match(
    attendancePageSource,
    /<ClassGallerySection\s+classId=\{classId\}\s+weekDate=\{saturdayStr\}/s,
    "attendance page should render gallery photos for the selected sabbath",
  );
  assert.equal(
    existsSync(join(repoRoot, "app", "fotos", "page.tsx")),
    false,
    "teacher gallery should not live as a separate dashboard section",
  );
  assert.match(
    galleryActionSource,
    /const tags = normalizeGalleryPhotoTags\(formData\.getAll\("tags"\)\)/,
    "gallery uploads should normalize controlled tags from the form",
  );
  assert.match(
    galleryActionSource,
    /tags,\s*uploaded_by: user\.id/s,
    "gallery metadata insert should persist tags",
  );
  assert.match(
    galleryFormSource,
    /GALLERY_PHOTO_TAGS\.map/,
    "gallery upload form should render the configured tag controls",
  );
});
