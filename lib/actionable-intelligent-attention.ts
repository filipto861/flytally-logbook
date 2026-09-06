import type { IntelligentAttentionFlight } from "./intelligent-logbook";

export function actionableIntelligentAttention(items:IntelligentAttentionFlight[]):IntelligentAttentionFlight[]{
  return items.map(item=>({...item,insights:item.insights.filter(insight=>insight.tone==="attention")})).filter(item=>item.insights.length>0);
}
