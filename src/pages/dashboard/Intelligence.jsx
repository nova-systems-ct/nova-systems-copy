import { ClipboardList } from 'lucide-react'
import AreaHub from '../../components/dashboard/AreaHub'

// Where Nova's diagnosis-related work lives. Nova Audit itself (evidence, findings, severity,
// recommendations) is a future build (Stage 6) — today this holds the real intake/pre-diagnostic
// data that already exists: business intake submissions and the meetings scheduled off them.
export default function Intelligence() {
  return (
    <AreaHub
      eyebrow="Intelligence"
      title="Diagnosis and findings"
      description="Where business intake, evidence, and diagnostic findings live. The full Nova Audit engine (evidence, severity, recommendations) is not built yet — this is what's real today."
      items={[
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
