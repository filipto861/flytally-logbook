"use client";

export type EntryReviewItem={
  id:string;
  label:string;
  onSelect:()=>void;
};

export function EntryReviewSummary({mode,title,description,items,primaryAction}:{
  mode:"manual"|"gps";
  title:string;
  description:string;
  items:EntryReviewItem[];
  primaryAction?:{label:string;required?:boolean;onSelect:()=>void};
}){
  return <section className="entry-review-status" aria-label={mode==="manual"?"Manual flight review":"GPS import review"} data-entry-review-mode={mode}>
    <div className="entry-review-status-copy">
      <p className="eyebrow">ENTRY REVIEW</p>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
    {(primaryAction||items.length>0)?<div className="entry-review-status-actions" aria-label={mode==="gps"?"GPS file and review actions":"Go to details needing review"}>
      {primaryAction?<button className="entry-review-status-link" type="button" onClick={primaryAction.onSelect}>
        <span>{primaryAction.label} {primaryAction.required?<span className="field-hint" aria-hidden="true">Required</span>:null}</span><span aria-hidden="true">↑</span>
      </button>:null}
      {items.map(item=><button className="entry-review-status-link" key={item.id} type="button" onClick={item.onSelect}>
        <span>{item.label}</span><span aria-hidden="true">↗</span>
      </button>)}
    </div>:null}
  </section>;
}
