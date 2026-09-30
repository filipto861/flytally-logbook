import { PROFESSIONAL_OPERATION_CONTEXTS,professionalOperationLabel } from "@/lib/professional-context";

export function ProfessionalContextFields({visible,operatorName="",flightNumber="",operationContext="",embedded=false}:{visible:boolean;operatorName?:string;flightNumber?:string;operationContext?:string;embedded?:boolean}){
  if(!visible)return <><input type="hidden" name="operatorName" value=""/><input type="hidden" name="flightNumber" value=""/><input type="hidden" name="operationContext" value=""/></>;
  const hasValue=Boolean(operatorName||flightNumber||operationContext),summary=[operatorName,flightNumber,operationContext?professionalOperationLabel(operationContext):""].filter(Boolean).join(" · ");
  const fields=<div className="form-grid secondary-entry-grid">
    <label>Operator / employer<input name="operatorName" defaultValue={operatorName} maxLength={120} autoComplete="organization"/></label>
    <label>Flight number<input name="flightNumber" defaultValue={flightNumber} maxLength={40} autoCapitalize="characters" autoComplete="off"/></label>
    <label>Operation context<select name="operationContext" defaultValue={operationContext}><option value="">Not specified</option>{PROFESSIONAL_OPERATION_CONTEXTS.filter(Boolean).map(value=><option key={value} value={value}>{professionalOperationLabel(value)}</option>)}</select></label>
  </div>;
  const note=<small className="optional-detail-note">Explicit pilot-entered context; FlyTally does not infer operational privileges from it.</small>;
  if(embedded)return <section className="optional-detail-group optional-professional-context"><div className="optional-detail-heading"><strong>Professional context</strong><small>{summary||"Not added"}</small></div>{fields}{note}</section>;
  return <details className="entry-section" open={hasValue}>
    <summary><span>Professional context</span><small>{summary||"Optional"}</small></summary>
    <div className="entry-section-body">{fields}{note}</div>
  </details>;
}
