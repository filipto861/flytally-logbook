"use client";

export type EntryReviewItem={
  id:string;
  label:string;
  onSelect:()=>void;
};

export function EntryReviewSummary({mode,title,description,items}:{
  mode:"manual"|"gps";
  title:string;
  description:string;
  items:EntryReviewItem[];
}){
  return <section className="entry-review-status" aria-label={mode==="manual"?"Manual flight review":"GPS import review"} data-entry-review-mode={mode}>
    <div className="entry-review-status-copy">
      <p className="eyebrow">ENTRY REVIEW</p>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
    {items.length>0?<div className="entry-review-status-actions" aria-label="Go to details needing review">
      {items.map(item=><button className="entry-review-status-link" key={item.id} type="button" onClick={item.onSelect}>
        <span>{item.label}</span><span aria-hidden="true">↗</span>
      </button>)}
    </div>:null}
  </section>;
}
