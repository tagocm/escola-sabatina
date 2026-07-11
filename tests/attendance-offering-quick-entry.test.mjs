import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const readSource = (path) => readFileSync(join(repoRoot, path), "utf8");

test("attendance header exposes a period-aware offering action before the camera", () => {
  const launchPage = readSource("app/relatorios/lancamento/page.tsx");
  const gallerySection = readSource("components/ui/ClassGallerySection.tsx");
  const controls = readSource("components/ui/ClassGalleryCompactControls.tsx");

  assert.match(launchPage, /initialOfferingAmount=\{Number\(attendanceData\.day\?\.total_offering \|\| 0\)\}/);
  assert.match(launchPage, /periodId=\{selectedPeriod\.id\}/);
  assert.match(launchPage, /offeringReadOnly=\{!selectedPeriod\.canWrite\}/);
  assert.match(launchPage, /offeringRequiresChangeReason=\{selectedPeriod\.requiresChangeReason\}/);

  for (const prop of [
    "periodId",
    "initialOfferingAmount",
    "offeringReadOnly",
    "offeringRequiresChangeReason",
  ]) {
    assert.match(gallerySection, new RegExp(`${prop}=\\{${prop}\\}`));
  }

  const offeringButtonIndex = controls.indexOf('aria-label="Registrar oferta do dia"');
  const cameraButtonIndex = controls.indexOf('aria-label="Abrir câmera para foto da aula"');
  assert.ok(offeringButtonIndex >= 0, "the offering quick action should be present");
  assert.ok(cameraButtonIndex > offeringButtonIndex, "the offering action should be left of the camera");
});

test("offering quick entry opens a compact accessible dialog with open field and explicit actions", () => {
  const controls = readSource("components/ui/ClassGalleryCompactControls.tsx");
  const offeringInput = readSource("components/ui/OfferingInput.tsx");

  assert.match(controls, /type ActivePanel = "offering" \| "capture" \| "gallery" \| null/);
  assert.match(controls, /role="dialog"[\s\S]*aria-labelledby="attendance-offering-title"/);
  assert.match(controls, /className=\{compactModalPanelClass\}/);
  assert.match(controls, /<OfferingInput[\s\S]*date=\{weekDate\}[\s\S]*autoFocus[\s\S]*onCancel=\{closePanel\}/);
  assert.match(controls, /scrollToHistoryOnSave=\{false\}/);
  assert.match(offeringInput, /autoFocus=\{autoFocus && !readOnly\}/);
  assert.match(offeringInput, /if \(autoFocus\) event\.currentTarget\.select\(\)/);
  assert.match(offeringInput, />\s*Cancelar\s*</);
  assert.match(offeringInput, /isPending \? "Salvando" : "Salvar"/);
});

test("quick entry saves through the existing audited offering action", () => {
  const offeringInput = readSource("components/ui/OfferingInput.tsx");
  const attendanceAction = readSource("app/actions/attendance.ts");

  assert.match(offeringInput, /updateOfferingAction\([\s\S]*classId,[\s\S]*date,[\s\S]*amount,[\s\S]*normalizedReason,[\s\S]*periodId/);
  assert.match(attendanceAction, /export async function updateOfferingAction/);
  assert.match(attendanceAction, /selectedPeriod\.schedule\.includes\(date\)/);
  assert.match(attendanceAction, /selectedPeriod\.requiresChangeReason/);
  assert.match(attendanceAction, /save_attendance_day_offering/);
});
