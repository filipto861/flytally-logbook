import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {costTotalsLabel,parseExpenseAmountMinor,parseFlightExpenses} from "../lib/flight-expenses.ts";

test("legacy expense amounts retain their historical two-decimal integer encoding",()=>{
  assert.equal(parseExpenseAmountMinor("35"),3500);
  assert.equal(parseExpenseAmountMinor("35.40"),3540);
  assert.equal(parseExpenseAmountMinor("12,5"),1250);
  assert.equal(parseExpenseAmountMinor("0"),null);
  assert.equal(parseExpenseAmountMinor("1.234"),null);
});

function expenseForm(amount:string,currency:string,encoding?:string){
  const form=new FormData();
  form.append("expenseCategory","OTHER");
  form.append("expenseLabel","Airport bus");
  form.append("expenseAmount",amount);
  form.append("expenseCurrency",currency);
  if(encoding!==undefined)form.append("expenseEncoding",encoding);
  return form;
}

test("new expenses store ISO currency exponent without rounding or defaults",()=>{
  assert.deepEqual(parseFlightExpenses(expenseForm("14.50","eur","iso_minor_units")).data,[{
    category:"OTHER",label:"Airport bus",amountMinor:1450,currency:"EUR",
    amountEncoding:"iso_minor_units",amountMinorUnits:2
  }]);
  assert.deepEqual(parseFlightExpenses(expenseForm("14","JPY","iso_minor_units")).data,[{
    category:"OTHER",label:"Airport bus",amountMinor:14,currency:"JPY",
    amountEncoding:"iso_minor_units",amountMinorUnits:0
  }]);
  assert.deepEqual(parseFlightExpenses(expenseForm("14.125","KWD","iso_minor_units")).data,[{
    category:"OTHER",label:"Airport bus",amountMinor:14125,currency:"KWD",
    amountEncoding:"iso_minor_units",amountMinorUnits:3
  }]);
});

test("malformed, unsupported and missing expense encodings fail closed",()=>{
  assert.match(parseFlightExpenses(expenseForm("1.2","JPY","iso_minor_units")).error||"",/correct decimal places/);
  assert.match(parseFlightExpenses(expenseForm("1.2345","KWD","iso_minor_units")).error||"",/correct decimal places/);
  assert.match(parseFlightExpenses(expenseForm("14","XAU","iso_minor_units")).error||"",/supported ISO/);
  assert.match(parseFlightExpenses(expenseForm("14","EUR")).error||"",/unknown amount encoding/);
  const bad=expenseForm("10","EUR","iso_minor_units");
  bad.set("expenseLabel","");
  assert.match(parseFlightExpenses(bad).error||"",/description/);
  assert.deepEqual(parseFlightExpenses(expenseForm("14.50","JPY","legacy_two_decimal")).data?.[0],{
    category:"OTHER",label:"Airport bus",amountMinor:1450,currency:"JPY",
    amountEncoding:"legacy_two_decimal",amountMinorUnits:2
  });
});

test("cost summary groups known currencies but never converts unknown aircraft-rate currency",()=>{
  assert.equal(costTotalsLabel([{amount_minor:2500,currency:"CZK"},{amount_minor:3500,currency:"EUR"}],1000),
    "25.00 CZK · 35.00 EUR · Aircraft rate currency unknown");
  assert.match(costTotalsLabel([{amount_minor:1450,currency:"JPY",amount_encoding:"legacy_two_decimal",amount_minor_units:2}]),
    /legacy 2-decimal storage/);
});

test("saved expenses project encoding and exponent before displaying or rewriting",()=>{
  const detailPage=readFileSync(new URL("../app/(protected)/flights/[id]/page.tsx",import.meta.url),"utf8");
  assert.match(detailPage,/SELECT id,category,label,amount_minor,currency,amount_encoding,amount_minor_units,created_at::text/);
  assert.match(detailPage,/FlightExpensesStandalone action=/);
});
