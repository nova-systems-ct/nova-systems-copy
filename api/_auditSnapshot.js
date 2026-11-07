import {contentHash} from './_auditRules.js';

// Hash the active report basis. Withdrawing an active finding removes it from this basis and invalidates the old
// snapshot. Already-rejected records are irrelevant, so composers may load either all rows or active rows.
export function findingSourceRevision(findings = []) {
  const fields=['id','title','detail','statement_type','confidence','review_status','priority','recommended_action','customer_impact','financial_impact_status','limitations','recheck_status','recheck_note','rechecked_at','updated_at'];
  return contentHash(findings.filter(f=>f.review_status!=='rejected').sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(f=>Object.fromEntries(fields.map(k=>[k,f[k]??null]))));
}
