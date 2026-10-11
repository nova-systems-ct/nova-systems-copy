import { ClipboardList, ClipboardCheck } from 'lucide-react'
import AreaHub from '../../components/dashboard/AreaHub'

// Where Nova's diagnosis-related work lives. Nova Audit's real domain (business identity,
// evidence, findings, recommendations, versioned reports, 24-72h deadline tracking) shipped
// 2026-09-23 — see api/client.js's `audit` resource and
// supabase/crm-order-audit-migration-standalone.sql (not yet applied to production; Audit Cases
// will show a load error until it is).
export default function Intelligence() {
  return (
    <AreaHub
      eyebrow="Intelligence"
      title="Diagnosis and findings"
      description="Where business intake, evidence, and diagnostic findings live."
      items={[
        {
          label: 'Audit Cases',
          description: 'Nova Audit cases — evidence, findings, recommendations, versioned reports, deadline clock.',
          icon: ClipboardCheck,
          path: '/dashboard/audit',
        },
        {
          label: 'Intake Forms',
          description: 'Detailed business intake submissions and the meetings scheduled from them.',
          icon: ClipboardList,
          path: '/dashboard/intake-forms',
        },
      ]}
    />
  )
}
