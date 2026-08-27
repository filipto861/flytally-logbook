type IconName="dashboard"|"flights"|"simulator"|"add"|"map"|"connections"|"notifications"|"credentials"|"settings"|"database"|"data"|"admin"|"signout"|"manage";

const paths:Record<IconName,React.ReactNode>={
  dashboard:<><path d="M3.5 10.2 12 3.5l8.5 6.7"/><path d="M5.5 9v11h13V9M9 20v-6h6v6"/></>,
  flights:<><path d="m3 13 7.5-2.5V5.8c0-1.4.7-2.8 1.5-2.8s1.5 1.4 1.5 2.8v4.7L21 13v2l-7.5-.7V19l2.5 1.5V22L12 21l-4 1v-1.5l2.5-1.5v-4.7L3 15z"/></>,
  simulator:<><rect x="3.5" y="5" width="17" height="12" rx="2"/><path d="M8 21h8M12 17v4M7.5 11h3m-1.5-1.5v3M15 10.5h.01M17.5 12.5h.01"/></>,
  add:<><path d="M12 4v16M4 12h16"/></>,
  map:<><path d="m3 6 5-2 8 2 5-2v14l-5 2-8-2-5 2zM8 4v14M16 6v14"/></>,
  connections:<><path d="M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 8M2.5 21c.4-4 3-6 7-6s6.6 2 7 6M17 9h4m-2-2v4"/></>,
  notifications:<><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9.5 21h5"/></>,
  credentials:<><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h5M8 16h3"/><circle cx="16.5" cy="15.5" r="2"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  database:<><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
  data:<><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/></>,
  admin:<><path d="M12 3 4.5 6v5c0 4.8 3 8.2 7.5 10 4.5-1.8 7.5-5.2 7.5-10V6z"/><path d="m9 12 2 2 4-4"/></>,
  signout:<><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>,
  manage:<><path d="M6 4h12M6 12h12M6 20h12"/><circle cx="9" cy="4" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="20" r="2"/></>,
};

export function NavIcon({name}:{name:IconName}){
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
