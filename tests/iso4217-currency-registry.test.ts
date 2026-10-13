import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {
  ISO4217_CURRENCY_SOURCE,
  listSupportedIsoCurrencies,
  supportedIsoCurrency,
  searchSupportedIsoCurrencies,
  parseSupportedCurrencyAmount,
  calculateSupportedCurrencyFlightCost,
} from "../lib/iso4217-currency-registry.ts";
import {parseListOneXml,renderRegistry,verifySnapshotBytes} from "../tooling/generate-iso4217-registry.mjs";

const xml=readFileSync(new URL("../data/iso4217/list-one-2026-09-17.xml",import.meta.url),"utf8");
const generated=readFileSync(new URL("../lib/iso4217-currency-data.ts",import.meta.url),"utf8");

test("pinned XML snapshot is reproducible and explicitly marked unverified at SIX origin",()=>{
  assert.equal(verifySnapshotBytes(xml),"1b8df1bec436592b955286d4e39c72518be9e444");
  const parsed=parseListOneXml(xml);
  assert.equal(parsed.publishedAt,"2026-09-17");
  assert.equal(parsed.sourceRows,280);
  assert.equal(parsed.distinctCodes,178);
  assert.equal(parsed.monetary.length,155);
  assert.equal(parsed.entriesWithoutCodes,3);
  assert.equal(renderRegistry(parsed),generated.replace(/\r\n/g,"\n"),"Generated metadata/currency rows have drifted from the pinned source");
  assert.equal(ISO4217_CURRENCY_SOURCE.verifiedDirectlyWithSIX,false,"Third-party source mirror is not the original SIX download");
});

test("registry contains all eligible current currency codes, not a short allowlist",()=>{
  const currencies=listSupportedIsoCurrencies(),codes=new Set(currencies.map(row=>row.code));
  assert.equal(currencies.length,155);
  assert.equal(codes.size,currencies.length);
  for(const code of ["CZK","EUR","USD","GBP","CHF","PLN","JPY","KWD","XAF","XOF","XPF","XCG","ZWG"]){
    assert.ok(supportedIsoCurrency(code),code);
  }
  assert.deepEqual(supportedIsoCurrency(" kwd "),{code:"KWD",name:"Kuwaiti Dinar",numericCode:"414",minorUnits:3});
  assert.equal(supportedIsoCurrency("BGN"),null,"Historical BGN is not valid for new 2026-09-17 entries");
  for(const special of ["XAU","XAG","XXX","XTS","XDR","BOV","XAD","CLF","UYW","CHE","CHW","USN"]){
    assert.equal(supportedIsoCurrency(special),null,special+" is not a current monetary tender");
  }
  assert.equal(supportedIsoCurrency("EUR1"),null);
  assert.equal(supportedIsoCurrency("ZZZ"),null);
  assert.equal(supportedIsoCurrency(null),null);
});

test("money parser and billing use registry-approved 0, 2, 3 exponent; unknown codes fail closed",()=>{
  assert.deepEqual(parseSupportedCurrencyAmount("15000","JPY"),{ok:true,money:{currency:"JPY",minorUnits:0,minor:15000n}});
  assert.deepEqual(parseSupportedCurrencyAmount("35.60","EUR"),{ok:true,money:{currency:"EUR",minorUnits:2,minor:3560n}});
  assert.deepEqual(parseSupportedCurrencyAmount("25.125","KWD"),{ok:true,money:{currency:"KWD",minorUnits:3,minor:25125n}});
  assert.deepEqual(parseSupportedCurrencyAmount("25.125","EUR"),{ok:false,reason:"too-many-decimals"});
  assert.deepEqual(parseSupportedCurrencyAmount("1.1","JPY"),{ok:false,reason:"too-many-decimals"});
  assert.deepEqual(parseSupportedCurrencyAmount("5","XTS"),{ok:false,reason:"unsupported-currency"});
  assert.deepEqual(calculateSupportedCurrencyFlightCost("1234.56",90,2,"EUR"),{ok:true,money:{currency:"EUR",minorUnits:2,minor:92592n}});
  assert.deepEqual(calculateSupportedCurrencyFlightCost("1.001",30,1,"KWD"),{ok:true,money:{currency:"KWD",minorUnits:3,minor:501n}});
  assert.deepEqual(calculateSupportedCurrencyFlightCost("1001",30,1,"JPY"),{ok:true,money:{currency:"JPY",minorUnits:0,minor:501n}});
  assert.deepEqual(calculateSupportedCurrencyFlightCost("100",30,1,"XAU"),{ok:false,reason:"unsupported-currency"});
});

test("complete list and small search preview are deterministic and readable",()=>{
  const list=listSupportedIsoCurrencies();
  assert.deepEqual(list.slice(0,4).map(item=>item.code),["CZK","EUR","USD","GBP"]);
  assert.equal(searchSupportedIsoCurrencies("",5).length,5);
  assert.equal(searchSupportedIsoCurrencies("kuwait").some(row=>row.code==="KWD"),true);
  assert.equal(searchSupportedIsoCurrencies("XAF").some(row=>row.code==="XAF"),true);
  assert.deepEqual(searchSupportedIsoCurrencies("",0),[]);
  assert.deepEqual(searchSupportedIsoCurrencies(null,10),[]);
});

test("source importer rejects conflicting duplicates, fund misclassification and altered source identity",()=>{
  const conflict=xml.replace("<Ccy>AFN</Ccy>","<Ccy>EUR</Ccy>");
  assert.throws(()=>parseListOneXml(conflict),/conflicting entity rows/);
  const removedFund=xml.replace('<CcyNm IsFund="true">Mvdol</CcyNm>',"<CcyNm>Mvdol</CcyNm>");
  assert.throws(()=>parseListOneXml(removedFund),/fund code would enter monetary picker/);
  assert.throws(()=>parseListOneXml(xml.replace('Pblshd="2026-09-17"','Pblshd="2026-10-11"')),/unexpected publication/);
  assert.throws(()=>verifySnapshotBytes(xml+"\n"),/pinned source blob has changed/);
  assert.throws(()=>parseListOneXml(xml.replace("<CcyMnrUnts>3</CcyMnrUnts>","<CcyMnrUnts>17</CcyMnrUnts>")) ,/unknown minor-unit descriptor/);
});
