import assert from "node:assert/strict";

// Hardware-independent scale assertions.
//
// Wall-clock EXPLAIN ANALYZE time depends on the machine (shared CI runners
// varied 2-3x for the same query), so the primary guard is the number of data
// blocks a query touches. On a fixed, deterministic fixture that number only
// grows when the plan or the SQL gets worse (e.g. a lost index, an extra pass
// over all flights). The time limit stays as a generous ceiling against
// catastrophic regressions only.

export type ExplainResult={planningMs:number;executionMs:number;plan:unknown};

const BLOCK_KEYS=[
  "Shared Hit Blocks","Shared Read Blocks","Local Hit Blocks","Local Read Blocks","Temp Read Blocks","Temp Written Blocks",
] as const;

/** Total blocks touched by the whole plan (top-node buffer counters include all children). */
export function planBlocks(plan:unknown):number{
  const node=(plan??{}) as Record<string,unknown>;
  return BLOCK_KEYS.reduce((sum,key)=>sum+Number(node[key]??0),0);
}

/**
 * Asserts a scale metric against a block budget and a time ceiling.
 * Set SCALE_BUDGET_REPORT=1 to print measurements without asserting budgets
 * (used when deliberately re-baselining after an intended query change).
 */
export function assertScaleBudget(
  label:string,
  name:string,
  result:ExplainResult,
  budget:{maxBlocks:number;ceilingMs:number},
):{blocks:number}{
  const blocks=planBlocks(result.plan);
  console.log(`${label} SCALE ${name}: blocks=${blocks} budget=${budget.maxBlocks} execution=${result.executionMs.toFixed(3)}ms ceiling=${budget.ceilingMs}ms`);
  if(process.env.SCALE_BUDGET_REPORT==="1")return{blocks};
  assert.ok(blocks>0,`${name}: EXPLAIN returned no buffer counters`);
  assert.ok(blocks<=budget.maxBlocks,`${name} touched ${blocks} blocks, budget ${budget.maxBlocks}: the plan or SQL got more expensive`);
  assert.ok(result.executionMs<budget.ceilingMs,`${name} exceeded the ${budget.ceilingMs}ms ceiling: ${result.executionMs}ms`);
  return{blocks};
}
