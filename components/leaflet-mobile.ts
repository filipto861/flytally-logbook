import L from "leaflet";

export function installResponsiveMap(map:L.Map,target:HTMLElement){
  const observer=new ResizeObserver(()=>map.invalidateSize({pan:false}));observer.observe(target);
  const timer=window.setTimeout(()=>map.invalidateSize({pan:false}),0);
  let control:L.Control|null=null;
  if(window.matchMedia("(max-width: 820px), (pointer: coarse)").matches){
    map.dragging.disable();map.touchZoom.disable();map.scrollWheelZoom.disable();
    const button=document.createElement("button");button.type="button";button.className="map-touch-toggle";button.textContent="Enable map movement";button.setAttribute("aria-pressed","false");
    L.DomEvent.disableClickPropagation(button);L.DomEvent.disableScrollPropagation(button);
    button.addEventListener("click",event=>{event.preventDefault();const enabled=button.getAttribute("aria-pressed")==="true";if(enabled){map.dragging.disable();map.touchZoom.disable();button.textContent="Enable map movement";button.setAttribute("aria-pressed","false")}else{map.dragging.enable();map.touchZoom.enable();button.textContent="Lock map movement";button.setAttribute("aria-pressed","true")}});
    control=new L.Control({position:"topright"});control.onAdd=()=>button;control.addTo(map);
  }
  return()=>{window.clearTimeout(timer);observer.disconnect();if(control)control.remove()};
}
