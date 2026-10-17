import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readdirSync,readFileSync,statSync} from "node:fs";
import {join} from "node:path";

// Hard R2.1a architectural boundary: production code must not depend on research.
test("R2.1a research modules are never imported by production",()=>{
  const root=process.cwd(),folders=["app","components","lib","pages","server"],violations:string[]=[];
  let scanned=0;
  function visit(path:string){
    for(const name of readdirSync(path)){
      const full=join(path,name),info=statSync(full);
      if(info.isDirectory()){if(!["node_modules",".next",".git"].includes(name))visit(full);continue}
      if(!/\.(?:ts|tsx|js|mjs|cjs)$/.test(name))continue;
      scanned++;
      const source=readFileSync(full,"utf8");
      // Includes literal static/dynamic import specifiers and re-export paths.
      if(/(?:from\s*["']|import\s*\(\s*["']|require\s*\(\s*["'])[^"']*(?:research[\\/]+gps-detection-r21)[^"']*["']/.test(source))
        violations.push(full.slice(root.length+1));
    }
  }
  for(const folder of folders){const path=join(root,folder);if(existsSync(path))visit(path)}
  assert.ok(scanned>0,"Production source tree missing; do not falsely PASS boundary scan");
  assert.deepEqual(violations,[],"Production must not import the R2.1a research experiment");
});
