const DATE_ONLY=/^(\d{4})-(\d{2})-(\d{2})$/;

function leapYear(year:number){return year%4===0&&(year%100!==0||year%400===0)}
function validDateOnly(year:number,month:number,day:number){
  const days=[31,leapYear(year)?29:28,31,30,31,30,31,31,30,31,30,31];
  return year>=1&&month>=1&&month<=12&&day>=1&&day<=days[month-1];
}

export function formatDateOnly(value:unknown){
  const input=String(value??"");
  const match=DATE_ONLY.exec(input);
  if(!match)return input;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  if(!validDateOnly(year,month,day))return input;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function parsedDate(value:unknown){
  const input=String(value??"");
  if(!input.trim())return{input,date:null as Date|null};
  const date=new Date(input);
  return{input,date:Number.isNaN(date.getTime())?null:date};
}

export function formatUtcTime(value:unknown){
  const{input,date}=parsedDate(value);
  if(!date)return input;
  return new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(date)+" UTC";
}

// Matches the certified audit page's existing UTC date-time presentation.
// That page is deliberately excluded from Batch 7 and remains untouched.
export function formatUtcDateTime(value:unknown){
  const{input,date}=parsedDate(value);
  if(!date)return input;
  return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(date)+" UTC";
}
