import test from "node:test";
import assert from "node:assert/strict";
import { landingCount,touchAndGoEvents,type KmlPoint } from "../lib/track-processing.ts";

type FixtureRow=readonly [seconds:number,latOffset:number,lonOffset:number,altitude:number];

const fixture=(rows:readonly FixtureRow[],startIso="2026-10-07T10:00:00Z"):KmlPoint[]=>{
  const start=Date.parse(startIso);
  return rows.map(([seconds,latOffset,lonOffset,altitude])=>({
    lat:50+latOffset,
    lon:14+lonOffset,
    alt:altitude,
    time:new Date(start+seconds*1000).toISOString(),
  }));
};

const case1LevelShiftFalsePositive=fixture([
  [0,0,0,550.67346],[4.968,-.000783,.001692,548.71204],[4.998,-.000966,.002104,548.54626],
  [9.986,-.001694,.003464,396.3146],[10.029,-.001694,.003464,396.3146],[14.98,-.002625,.005128,386.35272],
  [19.998,-.003514,.006854,379.1635],[20.985,-.00368,.0072095,379.1635],[24.992,-.00448,.008726,371.12582],
  [27.963,-.005032,.0098655,362.28183],[29.985,-.005395,.010606,355.58466],[32.963,-.005963,.0118415,398.84735],
  [34.994,-.006356,.01276,398.71707],[40,-.00723,.01471,394.35608],[44.981,-.008156,.01652,390.80038],
  [50,-.009087,.018331,389.17334],[54.981,-.01,.02011,388.34702],[57.968,-.010354,.020804,388.5705],
  [59.981,-.01085,.021799,394.0906],[63.964,-.01128,.02266,398.98926],[64.987,-.01154,.023184,401.96658],
  [69.963,-.011998,.024103,409.10416],[69.994,-.012066,.024253,419.70956],[74.981,-.012528,.025177,422.3371],
  [79.957,-.01287,.025855,422.18594],[79.981,-.012944,.025997,422.6586],[84.981,-.013287,.026659,425.86533],
  [89.981,-.013577,.027217,426.89407],
]);

const case2ClimbOutFalsePositive=fixture([
  [0,0,0,431.17474],[5,.000732,-.001477,429.20724],[12.002,.001984,-.004016,429.85605],
  [17.003,.003162,-.006391,446.9231],[24.002,.004169,-.008473,445.7987],[44.002,.007524,-.015738,424.14133],
  [55.023,.009696,-.020847,435.05966],[57.003,.009918,-.021689,415.88602],[64.002,.011669,-.024645,456.52502],
  [66.002,.011772,-.025579,413.87918],[69.001,.012752,-.026871,445.2404],[72.002,.012821,-.028343,413.15982],
  [76.001,.013804,-.029702,418.27692],[77.002,.014358,-.030547,456.3432],[80.001,.014704,-.031972,410.25635],
  [82.004,.015277,-.032839,448.69986],[84.024,.01585,-.033718,483.533],[85.022,.015659,-.034348,410.89313],
  [88.001,.016884,-.035676,450.7748],[90.002,.01691,-.036593,412.19836],[93.001,.018112,-.037989,449.0994],
]);

const case3DuplicateFixFalseSpeedEvent=fixture([
  [0,0,0,264.41174],[5,.00177,-.001962,280.48404],[8.673,.003183,-.003451,297.39896],
  [10,.003556,-.003801,303.41132],[14.695,.00544,-.005685,331.98782],[15.001,.00544,-.005685,331.98782],
  [19.672,.00737,-.007595,365.38785],[20.001,.00737,-.007595,365.38785],[20.67,.00737,-.007595,365.38785],
  [24.678,.009333,-.009575,397.11404],[25.001,.009333,-.009575,397.11404],[27.694,.010529,-.010734,408.79794],
  [30.001,.011345,-.011482,426.89648],[30.677,.011746,-.011868,432.12665],[34.675,.012863,-.013136,452.25415],
  [35.001,.013188,-.0136235,460.86673],
]);

function constantSpeedTrack(altitudes:number[],speedKmh=95,stepSeconds=5):KmlPoint[]{
  const start=Date.parse("2026-10-07T12:00:00Z"),latitudeStep=(speedKmh*stepSeconds/3600)/111.2;
  return altitudes.map((alt,index)=>({
    lat:50+latitudeStep*index,
    lon:14,
    alt,
    time:new Date(start+index*stepSeconds*1000).toISOString(),
  }));
}

function fiveTouchAndGoPositiveControl(){
  const altitudes=[230,260,300,350,400,430];
  for(let cycle=0;cycle<5;cycle++){
    altitudes.push(390,350,310,270,240,230);
    altitudes.push(235,242,255,275,310,360,410,430);
  }
  altitudes.push(390,350,310,270,240,230);
  return constantSpeedTrack(altitudes);
}

function genuineFlatAltitudeStopAndGo(){
  const start=Date.parse("2026-10-07T13:00:00Z"),points:KmlPoint[]=[];
  let lat=50,elapsed=0;
  points.push({lat,lon:14,alt:250,time:new Date(start).toISOString()});
  for(const speed of [...Array(8).fill(80),...Array(6).fill(10),...Array(8).fill(80)] as number[]){
    elapsed+=5;
    lat+=(speed*5/3600)/111.2;
    points.push({lat,lon:14,alt:250,time:new Date(start+elapsed*1000).toISOString()});
  }
  return points;
}

const knownMissedWindowShape=constantSpeedTrack([
  400,380,360,340,320,300,280,260,245,235,228,224,
  228,232,237,240,244,247,250,252,253,253.7,271,300,330,
],100,5);

test("3.5.1 rejects the real-derived altitude false positive after a sensor level shift",()=>{
  assert.deepEqual(touchAndGoEvents(case1LevelShiftFalsePositive),[]);
  assert.equal(landingCount(case1LevelShiftFalsePositive),1);
});

test("3.5.1 rejects the real-derived climb-out sawtooth false T&G",()=>{
  assert.deepEqual(touchAndGoEvents(case2ClimbOutFalsePositive),[]);
  assert.equal(landingCount(case2ClimbOutFalsePositive),1);
});

test("3.5.1 rejects the real-derived duplicate-fix false HIGH speed T&G",()=>{
  assert.deepEqual(touchAndGoEvents(case3DuplicateFixFalseSpeedEvent),[]);
  assert.equal(landingCount(case3DuplicateFixFalseSpeedEvent),1);
});

test("3.5.1 preserves five clean rolling T&G events as MEDIUM altitude evidence",()=>{
  const events=touchAndGoEvents(fiveTouchAndGoPositiveControl());
  assert.equal(events.length,5);
  assert.ok(events.every(event=>event.signal==="altitude"&&event.confidence==="medium"));
  assert.equal(landingCount(fiveTouchAndGoPositiveControl()),6);
});

test("3.5.1 preserves a genuine flat-altitude stop-and-go speed event as HIGH",()=>{
  const events=touchAndGoEvents(genuineFlatAltitudeStopAndGo());
  assert.equal(events.length,1);
  assert.equal(events[0].signal,"speed");
  assert.equal(events[0].confidence,"high");
});

test("3.5.1 intentionally does not auto-recover the confirmed +11-point missed T&G shape",()=>{
  assert.deepEqual(touchAndGoEvents(knownMissedWindowShape),[]);
  assert.equal(landingCount(knownMissedWindowShape),1);
});
