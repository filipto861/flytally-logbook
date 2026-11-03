import test from 'node:test';
import assert from 'node:assert/strict';
import {assertM0BReadOnlyTarget,M0B_READ_ONLY_EXPECTED} from './m0b-b1b2c-neon-isolation-scope.mjs';

const base={...M0B_READ_ONLY_EXPECTED,
  confirmation:'M0B_EMPTY_SEPARATE_PROJECT_READONLY_CONFIRMED',
  defaultBranch:true,projectCreationSource:'new-project',
  copiedProductionData:false,publicTableCount:0,operation:'metadata-read-only'};
const bad=(change)=>assert.throws(()=>assertM0BReadOnlyTarget({...base,...change}),/M0-B/);

test('explicit verified empty PG16 new-project target accepted',()=>{
  assert.deepEqual(assertM0BReadOnlyTarget(base),
    {projectId:base.projectId,branchId:base.branchId,databaseName:base.databaseName,roleName:base.operatorRole});
});
test('no explicit confirmation rejected',()=>bad({confirmation:undefined}));
test('wrong or production project rejected',()=>bad({projectId:'muddy-dust-14049657'}));
test('unknown branch or default shortcut rejected',()=>bad({branchId:undefined}));
test('wrong database rejected',()=>bad({databaseName:'neondb'}));
test('wrong role rejected',()=>bad({operatorRole:'neondb_owner'}));
test('wrong PostgreSQL server version rejected',()=>bad({pgVersionNumber:'180000'}));
test('branch inheriting existing parent data rejected',()=>bad({projectCreationSource:'branch-from-parent'}));
test('copied production data rejected',()=>bad({copiedProductionData:true}));
test('non-empty new project rejected',()=>bad({publicTableCount:1}));
test('remote modification or DML is refused',()=>bad({operation:'migration-sql'}));
test('missing or malformed scope input rejected',()=>{
  for(const value of [undefined,null,[],true,'x'])
    assert.throws(()=>assertM0BReadOnlyTarget(value),/M0-B/);
});
