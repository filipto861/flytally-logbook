import test from "node:test";
import assert from "node:assert/strict";
import { costTotalsLabel,parseExpenseAmountMinor,parseFlightExpenses } from "../lib/flight-expenses.ts";

test("expense amounts use integer minor units without floating point storage",()=>{assert.equal(parseExpenseAmountMinor("35"),3500);assert.equal(parseExpenseAmountMinor("35.40"),3540);assert.equal(parseExpenseAmountMinor("12,5"),1250);assert.equal(parseExpenseAmountMinor("0"),null);assert.equal(parseExpenseAmountMinor("1.234"),null)});
test("structured expenses validate custom descriptions and currencies",()=>{const form=new FormData();form.append("expenseCategory","OTHER");form.append("expenseLabel","Airport bus");form.append("expenseAmount","14.50");form.append("expenseCurrency","eur");assert.deepEqual(parseFlightExpenses(form).data,[{category:"OTHER",label:"Airport bus",amountMinor:1450,currency:"EUR"}]);const bad=new FormData();bad.append("expenseCategory","OTHER");bad.append("expenseLabel","");bad.append("expenseAmount","10");bad.append("expenseCurrency","EUR");assert.match(parseFlightExpenses(bad).error||"",/description/)});
test("cost summary combines only matching currencies",()=>{assert.equal(costTotalsLabel([{amount_minor:2500,currency:"CZK"},{amount_minor:3500,currency:"EUR"}],1000),"1,025 CZK · 35 EUR")});
