import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPECTED_CURRENCY_COLUMNS, classifyCurrencySchemaCatalog, inspectCurrencySchema,
} from "../lib/currency-schema-capability.ts";

type CatalogRow = {table_name:string;table_exists:boolean;column_name:string|null;udt_name:string|null};
function rows(mode:"v20"|"v21"):CatalogRow[] {
  const result:CatalogRow[]=[];
  for(const [table, columns] of Object.entries(EXPECTED_CURRENCY_COLUMNS)) {
    if(mode === "v20") result.push({table_name:table,table_exists:true,column_name:null,udt_name:null});
    else for (const [column,type] of Object.entries(columns))
      result.push({table_name:table,table_exists:true,column_name:column,udt_name:type});
  }
  return result;
}

test("v20 requires four existing base tables, but no v21 columns",()=>{
  const actual=classifyCurrencySchemaCatalog(rows("v20"));
  assert.equal(actual.status,"v20");
  assert.equal(actual.missing.length,12);
  assert.deepEqual(actual.incompatible,[]);
});
test("all 12 expected column names and exact PostgreSQL types identify v21 shape only",()=>{
  assert.deepEqual(classifyCurrencySchemaCatalog(rows("v21")),{
    status:"v21_shape",missing:[],incompatible:[],
  });
});
test("partial 1/12 and partial 11/12 both fail closed",()=>{
  const full=rows("v21");
  assert.equal(classifyCurrencySchemaCatalog([full[0],...rows("v20").filter(row=>row.table_name!==full[0].table_name)]).status,"partial_v21");
  const incomplete=full.filter(row=>row.column_name!=="price_currency_minor_units");
  const partial=classifyCurrencySchemaCatalog(incomplete);
  assert.equal(partial.status,"partial_v21");
  assert.deepEqual(partial.missing,["flights.price_currency_minor_units"]);
});
test("wrong data type, including numeric vs float8, is not v21 shape",()=>{
  const bad=rows("v21").map(row=>row.table_name==="flights"&&row.column_name==="price_per_hour_decimal"?{...row,udt_name:"float8"}:row);
  const actual=classifyCurrencySchemaCatalog(bad);
  assert.equal(actual.status,"partial_v21");
  assert.deepEqual(actual.incompatible,["flights.price_per_hour_decimal: expected numeric, observed float8"]);
});
test("missing required base tables is unknown, never interpreted as v20",()=>{
  const missing=rows("v20").filter(row=>row.table_name!=="flight_expenses");
  assert.equal(classifyCurrencySchemaCatalog(missing).status,"unknown");
  assert.equal(classifyCurrencySchemaCatalog([...missing,{table_name:"flight_expenses",table_exists:false,column_name:null,udt_name:null}]).status,"unknown");
});
test("malformed, extra and duplicate catalog rows fail closed",()=>{
  assert.equal(classifyCurrencySchemaCatalog(null).status,"unknown");
  assert.equal(classifyCurrencySchemaCatalog([{table_name:"rates",column_name:null,udt_name:null}]).status,"unknown");
  assert.equal(classifyCurrencySchemaCatalog([...rows("v21"),rows("v21")[0]]).status,"unknown");
  assert.equal(classifyCurrencySchemaCatalog([...rows("v21"),{table_name:"secrets",table_exists:true,column_name:"a",udt_name:"text"}]).status,"unknown");
});
test("read-only catalog query is one SELECT with current schema, not DDL or user rows",async()=>{
  let sql="",invocations=0;
  const value=await inspectCurrencySchema(async strings=>{
    invocations+=1;
    sql=strings.join("");
    return rows("v21");
  });
  assert.equal(value.status,"v21_shape");
  assert.equal(invocations,1);
  assert.match(sql,/WITH expected_tables/);
  assert.match(sql,/information_schema\.columns/);
  assert.match(sql,/current_schema\(\)/);
  assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE TABLE|pg_sleep)\b/i);
});
test("unavailable metadata or query error fails closed",async()=>{
  const failure=await inspectCurrencySchema(async()=>{throw new Error("secret connection detail")});
  assert.deepEqual(failure,{status:"unknown",missing:[],incompatible:[],reason:"catalog_unavailable"});
});
