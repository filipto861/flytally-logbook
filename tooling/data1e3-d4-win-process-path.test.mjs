import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {commandLineContainsExactDataDirectory} from "./data1e3-d4-win-process-path.mjs";

const owned=String.raw`C:\Users\Synthetic Test\AppData\Local\Temp\flytally-data1e3-d4-abc\pgdata`;
const pgExe=String.raw`C:\Program Files\PostgreSQL\16\bin\postgres.exe`;
const forward=owned.replaceAll("\\","/");

test("DATA-1E3 Windows PG process path: native backslashes and quoted -D argument",()=>{
  assert.equal(commandLineContainsExactDataDirectory(
    '"'+pgExe+'" -D "'+owned+'" -p 55441',owned),true);
});
test("DATA-1E3 Windows PG process path: forward slashes in Win32_Process.CommandLine",()=>{
  assert.equal(commandLineContainsExactDataDirectory(
    '"'+pgExe+'" -D "'+forward+'" -p 55441',owned),true);
});
test("DATA-1E3 Windows PG process path: mixed separators, mixed case and Unicode",()=>{
  assert.equal(commandLineContainsExactDataDirectory(
    '"'+pgExe.toUpperCase()+'" -D "'+forward.replace("Synthetic Test","SYNTHETIC TEST").replace("pgdata","PGDATA")+'"',owned),true);
});
test("DATA-1E3 Windows PG process path: fail closed for another directory or prefix trap",()=>{
  for(const other of [
    String.raw`C:\Users\Synthetic Test\AppData\Local\Temp\flytally-data1e3-d4-other\pgdata`,
    owned+"-other",
    owned+"\\unrelated",
    String.raw`D:\different\pgdata`
  ]){
    assert.equal(commandLineContainsExactDataDirectory(
      '"'+pgExe+'" -D "'+other+'" -p 55441',owned),false,"must reject "+other);
  }
});
test("DATA-1E3 Windows PG process path: fail closed for missing, empty, partial evidence",()=>{
  for(const line of [null,undefined,"",'"'+pgExe+'" -p 55441','prefix'+owned+'suffix']){
    assert.equal(commandLineContainsExactDataDirectory(line,owned),false);
  }
  assert.equal(commandLineContainsExactDataDirectory(pgExe,undefined),false);
});
test("DATA-1E3 Windows PG process path: caller retains full PID/exe and SQL identity checks",()=>{
  const src=readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),
    "data1e3-d4-owned-local-pg16.mjs"),"utf8");
  assert.match(src,/assert\.equal\(obj\.ProcessId,pid/);
  assert.match(src,/normalizePath\(obj\.ExecutablePath\),normalizePath\(bins\.postgres\)/);
  assert.match(src,/commandLineContainsExactDataDirectory\(obj\.CommandLine,data\)/);
  assert.match(src,/assert\.equal\(normalizePath\(row\.datadir\),normalizePath\(data\)\)/);
  assert.match(src,/assert\.equal\(row\.addr,"127\.0\.0\.1"\)/);
  assert.match(src,/assert\.equal\(row\.port,port\)/);
  assert.match(src,/physicalPid\(bins,pid,data\)/);
  assert.match(src,/D4_CLEANUP_BLOCKED/);
  assert.match(src,/D4_PG_CMDLINE_FORMAT_DIAGNOSTIC/);
  assert.match(src,/failClosed:true/);
  assert.doesNotMatch(src,/console\.error\([^\n]*obj\.CommandLine/);
});
