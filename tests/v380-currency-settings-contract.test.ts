import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {listSupportedIsoCurrencies,supportedIsoCurrency} from "../lib/iso4217-currency-registry.ts";

const settingsPage=readFileSync(new URL("../app/(protected)/profile/page.tsx",import.meta.url),"utf8");
const settingsActions=readFileSync(new URL("../app/(protected)/profile/actions.ts",import.meta.url),"utf8");

test("3.8 account currency selector offers all source-backed active ISO monetary codes",()=>{
  const supported=listSupportedIsoCurrencies();
  assert.equal(supported.length,155);
  assert.ok(supported.some(item=>item.code==="JPY"&&item.minorUnits===0));
  assert.ok(supported.some(item=>item.code==="EUR"&&item.minorUnits===2));
  assert.ok(supported.some(item=>item.code==="KWD"&&item.minorUnits===3));
  assert.equal(supportedIsoCurrency("XAU"),null);
  assert.equal(supportedIsoCurrency("XXX"),null);
  assert.match(settingsPage,/listSupportedIsoCurrencies\(\)/);
  assert.match(settingsPage,/currencyChoices\.map\(item=>/);
  assert.doesNotMatch(settingsPage,/<option>CZK<\/option><option>EUR<\/option>/);
});

test("both account settings mutations refuse unsupported or missing monetary ISO choice",()=>{
  const guards=[...settingsActions.matchAll(/const currency=supportedIsoCurrency\(pick\(f,"currency",row.currency\)\)\?\.code;if\(!currency\)redirect\("\/profile\?settingsError=currency"\)/g)];
  assert.equal(guards.length,2);
  assert.match(settingsPage,/name="currency"[^>]*required/);
  assert.match(settingsPage,/Select a valid currency before saving/);
  assert.match(settingsPage,/Existing prices are never converted/);
});

test("account setting has no historical monetary rewrite or exchange conversion side effect",()=>{
  const saves=settingsActions.slice(settingsActions.indexOf("export async function saveSettings"),settingsActions.indexOf("// Legacy licence actions"));
  assert.doesNotMatch(saves,/\bUPDATE\s+(rates|flights|flight_expenses|aircraft)\b/i);
  assert.doesNotMatch(saves,/\bexchange[_-]?rate\b|\bforex\b/i);
});
