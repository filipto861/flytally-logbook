"use client";

type Item={id:string;label:string};

export function DetailsNavigation({items,label}:{items:Item[];label:string}){
  const reveal=(id:string)=>{const target=document.getElementById(id);if(target instanceof HTMLDetailsElement)target.open=true};
  return <nav className="database-task-nav" aria-label={label}>{items.map(item=><a key={item.id} href={`#${item.id}`} onClick={()=>reveal(item.id)}>{item.label}</a>)}</nav>;
}
