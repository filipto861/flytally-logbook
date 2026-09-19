import type { ReactNode } from "react";

export function PendingActionLabel({current,reserve}:{current:ReactNode;reserve:ReactNode}){
  return <span className="pending-action-label"><span>{current}</span><span className="pending-action-label-reserve" aria-hidden="true">{reserve}</span></span>;
}
