import L from "leaflet";

const CARTO_HOST="basemaps.cartocdn.com";
const OSM_TILES="https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DARK_TILE_FILTER="invert(.78) hue-rotate(180deg) saturate(.12) brightness(.92) contrast(1.08)";

function applyTileTheme(map:L.Map){
  const tilePane=map.getPane("tilePane");
  if(tilePane)tilePane.style.filter=document.documentElement.dataset.theme==="light"?"none":DARK_TILE_FILTER;
}

function replaceLegacyCartoBasemap(map:L.Map){
  let replace=false;
  map.eachLayer(layer=>{
    if(!(layer instanceof L.TileLayer))return;
    const url=String((layer as L.TileLayer&{_url?:string})._url??"");
    if(url.includes(CARTO_HOST)){map.removeLayer(layer);replace=true}
  });
  if(replace)L.tileLayer(OSM_TILES,{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  applyTileTheme(map);
}

export function installResponsiveMap(map:L.Map,target:HTMLElement){
  replaceLegacyCartoBasemap(map);
  const observer=new ResizeObserver(()=>map.invalidateSize({pan:false}));observer.observe(target);
  const themeObserver=new MutationObserver(()=>applyTileTheme(map));themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
  const timer=window.setTimeout(()=>map.invalidateSize({pan:false}),0);
  let control:L.Control|null=null;
  if(window.matchMedia("(max-width: 820px), (pointer: coarse)").matches){
    map.dragging.disable();map.touchZoom.disable();map.scrollWheelZoom.disable();
    const button=document.createElement("button");button.type="button";button.className="map-touch-toggle";button.textContent="Enable map movement";button.setAttribute("aria-pressed","false");
    L.DomEvent.disableClickPropagation(button);L.DomEvent.disableScrollPropagation(button);
    button.addEventListener("click",event=>{event.preventDefault();const enabled=button.getAttribute("aria-pressed")==="true";if(enabled){map.dragging.disable();map.touchZoom.disable();button.textContent="Enable map movement";button.setAttribute("aria-pressed","false")}else{map.dragging.enable();map.touchZoom.enable();button.textContent="Lock map movement";button.setAttribute("aria-pressed","true")}});
    control=new L.Control({position:"topright"});control.onAdd=()=>button;control.addTo(map);
  }
  return()=>{window.clearTimeout(timer);observer.disconnect();themeObserver.disconnect();if(control)control.remove()};
}
