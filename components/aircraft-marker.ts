import L from "leaflet";

const AIRCRAFT_MARKER_SVG='<svg class="aircraft-marker-svg" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="18" fill="#082b45" stroke="rgba(255,255,255,.9)" stroke-width="1.5"/><path d="M20 5.5c1.15 0 1.8 1.2 2.05 3.15l1.05 8.15 10.15 5.4v3.15l-10.05-2.7-.45 7.2 3.45 2.55v2.1L20 32.85l-6.2 1.65v-2.1l3.45-2.55-.45-7.2-10.05 2.7V22.2l10.15-5.4 1.05-8.15C18.2 6.7 18.85 5.5 20 5.5Z" fill="white"/></svg>';

export function createAircraftMarkerIcon(){
  return L.divIcon({className:"aircraft-marker",html:AIRCRAFT_MARKER_SVG,iconSize:[34,34],iconAnchor:[17,17]});
}

export function rotateAircraftMarker(marker:L.Marker|null,bearing:number,{smooth=false}:{smooth?:boolean}={}){
  const node=marker?.getElement()?.querySelector(".aircraft-marker-svg") as SVGElement|null;
  if(!node)return;
  node.style.transformOrigin="50% 50%";
  if(smooth)node.style.transition="transform .08s linear";
  node.style.transform=`rotate(${bearing}deg)`;
}
