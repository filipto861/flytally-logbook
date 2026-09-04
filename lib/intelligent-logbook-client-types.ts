import type { ContinuationSuggestion,IntelligentFlightHistory } from "@/lib/intelligent-logbook";

export { intelligentFlightReview } from "@/lib/intelligent-logbook";
export type { ContinuationSuggestion,IntelligentFlightDraft,IntelligentFlightHistory,IntelligentInsight,IntelligentInsightTone } from "@/lib/intelligent-logbook";

export type IntelligentEntryContext={
  history:IntelligentFlightHistory[];
  continuation:ContinuationSuggestion|null;
};
