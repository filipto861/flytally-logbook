import { expect } from "@playwright/test";
import { ensureDetailsOpen } from "./browser-actions.mjs";

export async function openGpsFlightContext(gpsForm){
  await ensureDetailsOpen(gpsForm.locator("details.gps-flight-context"));
}

export async function selectGpsCommonRole(gpsForm,value){
  await openGpsFlightContext(gpsForm);
  const role=gpsForm.locator('select[name="role"]');
  await role.selectOption(value);
  await openGpsFlightContext(gpsForm);
  return role;
}

export async function selectGpsActualPicMode(gpsForm,value){
  await openGpsFlightContext(gpsForm);
  const source=gpsForm.locator('select[name="actualPicMode"]');
  await source.selectOption(value);
  await openGpsFlightContext(gpsForm);
  return source;
}

export async function openGpsTrackReview(gpsForm){
  await ensureDetailsOpen(gpsForm.locator("details.gps-track-review"));
}

export async function splitGpsIntoTwo(gpsForm){
  await openGpsTrackReview(gpsForm);
  const firstSplit=gpsForm.getByRole("button",{name:"Split into multiple flights"});
  await expect(firstSplit).toBeVisible();
  await firstSplit.click();
  await expect(gpsForm.locator('input[name="partCount"]')).toHaveValue("2");
}

export async function completeF43GpsPart(gpsForm,index,{offBlock,takeoff,landing,onBlock,note}){
  await gpsForm.locator('input[name="part_'+index+'_date"]').fill("2026-10-03");
  await gpsForm.locator('input[name="part_'+index+'_offBlock"]').fill(offBlock);
  await gpsForm.locator('input[name="part_'+index+'_takeoff"]').fill(takeoff);
  await gpsForm.locator('input[name="part_'+index+'_landing"]').fill(landing);
  await gpsForm.locator('input[name="part_'+index+'_onBlock"]').fill(onBlock);
  const starts=gpsForm.locator('input[name="part_'+index+'_starts"]');
  const total=(await starts.inputValue())||"1";
  await starts.fill(total);
  await gpsForm.locator('input[name="part_'+index+'_landingsDay"]').fill(total);
  await gpsForm.locator('input[name="part_'+index+'_landingsNight"]').fill("0");
  await expect(gpsForm.locator('input[name="part_'+index+'_movementEvidenceRecorded"]')).not.toBeChecked();
  await gpsForm.locator('textarea[name="part_'+index+'_note"]').fill(note);
}
