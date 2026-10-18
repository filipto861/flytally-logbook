/**
 * Canonical optional GPS numeric token decoder for CSV and stored track JSON.
 * Missing/malformed evidence is null, never an invented zero.
 *
 * Preserve numeric JSON values and historically supported decimal CSV spellings,
 * including optional sign, fractional values, decimal comma, and scientific notation.
 */
export function optionalGpsNumber(value:unknown):number|null{
  if(typeof value==="number")return Number.isFinite(value)?value:null;
  if(typeof value!=="string")return null;
  const token=value.trim().replace(",",".");
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token))return null;
  const parsed=Number(token);
  return Number.isFinite(parsed)?parsed:null;
}
