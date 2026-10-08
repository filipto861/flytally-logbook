import { test,expect } from "@playwright/test";
import { expectAuthenticatedRoute,expectNoHorizontalOverflow,loginBrowserPilot } from "./browser-actions.mjs";
import { browserSqlScalar,resetF24VerificationFixture,resetSafetyPilotPicFixture,renameSafetyPilotPicFixture,revokeSafetyPilotPicConnectionFixture,resetSafetyPilotPicInviteFixture,revokeSafetyPilotPicInviteConnectionFixture } from "./browser-db.mjs";

const authenticatedBrowser=process.env.FLYTALLY_AUTH_BROWSER==="1";

test("F2.2 Manual RoleCrew identity is inline and survives unsaved role switches",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F2.2 RoleCrew browser coverage requires the isolated CI database.");
  await loginBrowserPilot(page,"/flights/new");

  const form=page.locator("#new-flight-manual-form");
  await form.locator('select[name="registration"]').selectOption("OK-SP2E");
  await expect(form.locator('input[name="evidence"]')).toHaveValue("EASA");

  const role=form.locator('select[name="role"]');
  await role.selectOption("DUAL");
  const dualInstructor=form.locator('.role-crew-inline-grid input[name="instructor"]');
  await expect(dualInstructor).toBeVisible();
  await expect(dualInstructor).toHaveAttribute("required","");
  await dualInstructor.fill("Inline Instructor");

  await role.selectOption("PIC");
  await expect(form.locator(".role-crew-inline-grid")).toHaveCount(0);
  await role.selectOption("DUAL");
  await expect(form.locator('.role-crew-inline-grid input[name="instructor"]')).toHaveValue("Inline Instructor");

  await role.selectOption("SPIC");
  const supervisor=form.locator('.role-crew-inline-grid input[name="verificationName"]');
  const countersign=form.locator('.role-crew-inline-grid input[name="verificationReference"]');
  await expect(supervisor).toBeVisible();
  await expect(countersign).toBeVisible();
  await expect(supervisor).toHaveAttribute("required","");
  await expect(countersign).toHaveAttribute("required","");
  await supervisor.fill("Supervising PIC");
  await countersign.fill("Signed ref F22");

  await role.selectOption("PIC");
  await role.selectOption("SPIC");
  await expect(form.locator('.role-crew-inline-grid input[name="verificationName"]')).toHaveValue("Supervising PIC");
  await expect(form.locator('.role-crew-inline-grid input[name="verificationReference"]')).toHaveValue("Signed ref F22");
  await expectNoHorizontalOverflow(page);
});

test("F2.4C certified verifier evidence stays unbound and exposes both explicit verification paths",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F2.4C verification coverage requires the isolated CI database.");
  resetF24VerificationFixture();
  await loginBrowserPilot(page,"/flights/9904");

  await expect(page.getByLabel("Overview").getByRole("heading",{name:"Certified revision 1"})).toBeVisible();
  expect(Number(browserSqlScalar("SELECT COUNT(*) FROM flight_participations WHERE source_flight_id=9904 AND source_user_id=9001 AND participant_role='INSTRUCTOR' AND status='pending'"))).toBe(0);

  const panel=page.locator("section.instructor-approval-panel").filter({hasText:"CREW VERIFICATION"});
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/Choose a connected FlyTally instructor to send a verification request/)).toBeVisible();
  await expect(panel.getByRole("button",{name:"Request approval from Browser Instructor"})).toBeVisible();
  await expect(panel.getByRole("link",{name:"Instructor without FlyTally · Sign on this device"})).toHaveAttribute("href","/flights/9904/in-person-signature");
  expect(Number(browserSqlScalar("SELECT COUNT(*) FROM flight_participations WHERE source_flight_id=9904 AND source_user_id=9001 AND participant_user_id=9002 AND participant_role='INSTRUCTOR' AND status='pending'"))).toBe(0);
  await expectNoHorizontalOverflow(page);
});

test("Safety Pilot Actual PIC form keeps manual and connected identity explicit",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated Safety Pilot PIC browser coverage requires the isolated CI database.");
  resetSafetyPilotPicFixture();
  await loginBrowserPilot(page,"/flights/new");

  await expectAuthenticatedRoute(page,"New flight");
  await page.getByLabel("Role").selectOption("SAFETY PILOT");

  const source=page.locator('select[name="actualPicMode"]');
  await expect(source).toHaveValue("manual");
  await expect(page.locator('input[name="commander"]')).toBeVisible();
  await expect(page.getByText("No invitation is sent when this draft is saved.")).toBeVisible();

  await source.selectOption("connected");
  const connected=page.locator('select[name="connectedPicUserId"]');
  await expect(connected).toBeVisible();
  await expect(connected.getByRole("option",{name:"Browser Friend"})).toHaveCount(1);
  await connected.selectOption("9002");
  await expect(page.locator('input[name="commander"]')).toHaveValue("Browser Friend");

  await source.selectOption("manual");
  const manual=page.locator('input[name="commander"]');
  await manual.fill("Manual Captain");
  await expect(page.locator('input[name="connectedPicUserId"]')).toHaveValue("");

  await page.locator('select[name="registration"]').selectOption("OK-SP2E");
  await page.getByRole("button",{name:"Save draft"}).click();
  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  await expect(page.locator('select[name="registration"]')).toHaveValue("OK-SP2E");
  await expect(page.locator('select[name="role"]')).toHaveValue("SAFETY PILOT");
  await expect(page.locator('input[name="commander"]')).toHaveValue("Manual Captain");

  await page.getByRole("button",{name:"Save changes"}).click();
  await expect(page.getByText("Flight changes saved.")).toBeVisible();
  await expect(page.locator('select[name="registration"]')).toHaveValue("OK-SP2E");
  await expect(page.locator('select[name="role"]')).toHaveValue("SAFETY PILOT");
  await expect(page.locator('input[name="commander"]')).toHaveValue("Manual Captain");
  await expectNoHorizontalOverflow(page);
});

test("F2.3 Safety Pilot resolver snapshots server identity and fails closed after Connection revocation",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F2.3 Safety Pilot resolver coverage requires the isolated CI database.");
  resetSafetyPilotPicFixture();
  await loginBrowserPilot(page,"/flights/new");

  const form=page.locator("#new-flight-manual-form");
  await form.locator('select[name="registration"]').selectOption("OK-SP2E");
  await form.locator('select[name="role"]').selectOption("SAFETY PILOT");
  await form.locator('select[name="actualPicMode"]').selectOption("connected");
  await form.locator('select[name="connectedPicUserId"]').selectOption("9002");
  await expect(form.locator('input[name="commander"]')).toHaveValue("Browser Friend");

  renameSafetyPilotPicFixture("Browser Friend Renamed");
  await form.getByRole("button",{name:"Save draft"}).click();
  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  await expect(page.locator('select[name="role"]')).toHaveValue("SAFETY PILOT");
  await expect(page.locator('select[name="actualPicMode"]')).toHaveValue("connected");
  await expect(page.locator('input[name="commander"]')).toHaveValue("Browser Friend Renamed");

  renameSafetyPilotPicFixture("Browser Friend Updated");
  await page.getByRole("button",{name:"Save changes"}).click();
  await expect(page.getByText("Flight changes saved.")).toBeVisible();
  await page.reload();
  await expect(page.locator('input[name="commander"]')).toHaveValue("Browser Friend Updated");

  resetSafetyPilotPicFixture();
  await page.goto("/flights/new");
  const rejected=page.locator("#new-flight-manual-form");
  await rejected.locator('select[name="registration"]').selectOption("OK-SP2E");
  await rejected.locator('select[name="role"]').selectOption("SAFETY PILOT");
  await rejected.locator('select[name="actualPicMode"]').selectOption("connected");
  await rejected.locator('select[name="connectedPicUserId"]').selectOption("9002");
  revokeSafetyPilotPicConnectionFixture();

  await rejected.getByRole("button",{name:"Save draft"}).click();
  await expect(rejected.getByRole("alert")).toContainText("Selected Actual PIC is no longer an accepted Connection.");
  await expect(page).toHaveURL(/\/flights\/new(?:\?.*)?$/);
  await expectNoHorizontalOverflow(page);
  resetSafetyPilotPicFixture();
});

test("certified Safety Pilot can invite only the stored connected Actual PIC",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated Safety Pilot PIC invitation coverage requires the isolated CI database.");
  resetSafetyPilotPicInviteFixture();
  await loginBrowserPilot(page,"/flights/9903");

  const panel=page.locator("section.instructor-approval-panel").filter({hasText:"ACTUAL PIC"});
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading",{name:"Browser Friend"})).toBeVisible();
  await expect(panel.getByRole("button",{name:"Invite Actual PIC"})).toBeVisible();

  await panel.getByRole("button",{name:"Invite Actual PIC"}).click();
  await expect(panel.getByText("PIC invitation · pending")).toBeVisible();
  await expect(panel.getByRole("button",{name:"Cancel PIC invitation"})).toBeVisible();

  await page.reload();
  await expect(panel.getByText("PIC invitation · pending")).toBeVisible();

  await panel.getByRole("button",{name:"Cancel PIC invitation"}).click();
  await expect(panel.getByRole("button",{name:"Invite Actual PIC"})).toBeVisible();

  await panel.getByRole("button",{name:"Invite Actual PIC"}).click();
  await expect(panel.getByText("PIC invitation · pending")).toBeVisible();
  await panel.getByRole("button",{name:"Cancel PIC invitation"}).click();
  await expect(panel.getByRole("button",{name:"Invite Actual PIC"})).toBeVisible();

  revokeSafetyPilotPicInviteConnectionFixture();
  await page.reload();
  await expect(panel.getByText(/no longer an accepted Connection/)).toBeVisible();
  await expect(panel.getByRole("button",{name:"Invite Actual PIC"})).toHaveCount(0);
  await expect(panel.getByRole("link",{name:"Review Connections"})).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
