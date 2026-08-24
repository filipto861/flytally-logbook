import type { MetadataRoute } from "next";

export default function manifest():MetadataRoute.Manifest{
  return{
    id:"/",
    name:"FlyTally",
    short_name:"FlyTally",
    description:"Digital pilot logbook",
    start_url:"/dashboard",
    scope:"/",
    display:"standalone",
    background_color:"#07111f",
    theme_color:"#07111f",
    orientation:"any",
    categories:["productivity","utilities"],
    icons:[
      {src:"/logbook_icon.png",sizes:"512x512",type:"image/png",purpose:"any"},
      {src:"/logbook_icon.png",sizes:"512x512",type:"image/png",purpose:"maskable"},
      {src:"/logbook_icon_32.png",sizes:"32x32",type:"image/png",purpose:"any"}
    ],
    shortcuts:[
      {name:"Add flight",short_name:"Add flight",url:"/flights/new",icons:[{src:"/logbook_icon.png",sizes:"512x512",type:"image/png"}]},
      {name:"Flights",short_name:"Flights",url:"/flights",icons:[{src:"/logbook_icon.png",sizes:"512x512",type:"image/png"}]}
    ]
  };
}
