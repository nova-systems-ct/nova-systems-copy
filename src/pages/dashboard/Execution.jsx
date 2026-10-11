import { CheckSquare } from 'lucide-react'
import AreaHub from '../../components/dashboard/AreaHub'

// Automations, communications, and booking will live here later (Stage 9+). Tasks (Stage 5) is
// the first real thing here — currently empty (0 real tasks exist), but genuinely wired to the
// real nova_tasks table, not a placeholder.
export default function Execution() {
  return (
    <AreaHub
      eyebrow="Execution"
      title="Projects and delivery"
      description="Automations, communications (voice/SMS/email), and booking will live here later. Tasks is real and connected today."
      items={[
        {
          label: 'Tasks',
          description: 'Real Nova operational tasks.',
          icon: CheckSquare,
          path: '/dashboard/tasks',
        },
      ]}
    />
  )
}
