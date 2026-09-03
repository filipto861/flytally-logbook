import { PROFESSIONAL_OPERATION_CONTEXTS,professionalOperationLabel } from "@/lib/professional-context";

export function ProfessionalContextFields({visible,operatorName="",flightNumber="",operationContext=""}:{visible:boolean;operatorName?:string;flightNumber?:string;operationContext?:string}){
  if(!visible)return <><input type="hidden" name="operatorName" value=""/><input type="hidden" name="flightNumber" value=""/><input type="hidden" name="operationContext" value=""/></>;
  const hasValue=Boolean(operatorName||flightNumber||operationContext);
  return <details className="entry-section" open={hasValue}>
    <summary><span>Professional context</span><small>{hasValue?[operatorName,flightNumber,professionalOperationLabel(operationContext)].filter(Boolean).join(" · "):"Optional"}</small></summary>
    <div className="entry-section-body"><div className="form-grid secondary-entry-grid">
      <label>Operator / employer<input name="operatorName" defaultValue={operatorName} maxLength={120} autoComplete="organization"/><small>Optional label for your experience records. FlyTally does not infer regulatory privileges from it.</small></label>
      <label>Flight number<input name="flightNumber" defaultValue={flightNumber} maxLength={40} autoCapitalize="characters" autoComplete="off"/><small>Optional operational flight or duty identifier.</small></label>
      <label>Operation context<select name="operationContext" defaultValue={operationContext}><option value="">Not specified</option>{PROFESSIONAL_OPERATION_CONTEXTS.filter(Boolean).map(value=><option key={value} value={value}>{professionalOperationLabel(value)}</option>)}</select><small>Explicit pilot-entered context only; never inferred from aircraft, operator or route.</small></label>
    </div></div>
  </details>;
}
