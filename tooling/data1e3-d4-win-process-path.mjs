// DATA-1E3 Windows PostgreSQL process evidence. Pure helper; no SQL, spawning or file writes.
import path from "node:path";

function winCanonical(value){
  if(typeof value!=="string"||!value.trim())return null;
  return path.win32.normalize(value.replaceAll("/","\\"))
    .replace(/[\\]+$/,"").normalize("NFC").toLowerCase();
}

export function commandLineContainsExactDataDirectory(commandLine,dataDirectory){
  const expected=winCanonical(dataDirectory);
  if(!expected||typeof commandLine!=="string"||!commandLine)return false;
  // PostgreSQL pg_ctl can pass a Windows-native path using forward slashes.
  // Do NOT use path.normalize() on the full commandline: it would change arguments.
  const command=commandLine.replaceAll("/","\\").normalize("NFC").toLowerCase();
  let offset=0;
  while(true){
    const at=command.indexOf(expected,offset);
    if(at<0)return false;
    const preceding=at===0?"":command[at-1];
    const following=command[at+expected.length]??"";
    // Reject substring/prefix traps such as owned-pgdata-other or unrelated`x:\owned`.
    if((at===0||/[\s"'=]/.test(preceding))&&
       (following===""||/[\s"']/.test(following)))return true;
    offset=at+1;
  }
}
