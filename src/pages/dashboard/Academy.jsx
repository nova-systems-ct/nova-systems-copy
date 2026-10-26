import { Link } from 'react-router-dom'
import { TrainingList } from '../../components/sales/Training'
import { useOrg } from '../../lib/OrgContext'

// Nova Sales Academy — program list. The learner experience lives in components/sales/Training.jsx so the rep workspace (/rep/training)
// and Nova HQ (/dashboard/academy) share one implementation against api/academy.js (server-side grading, attempts, certificates).
// 2026-10-26: the sidebar's Training item opens this page; owners also get a link to the reviewer queue.
export default function Academy() {
  const { currentMembership } = useOrg()
  const owner = currentMembership?.role === 'nova_super_admin'
  return (
    <>
      {owner && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', padding: '16px clamp(16px, 4vw, 48px) 0' }}>
          <Link to="/dashboard/sales-team/academy" style={{ minHeight: 40, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.5)', color: '#C9A84C', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Review submissions and approve content</Link>
        </div>
      )}
      <TrainingList basePath="/dashboard/academy" />
    </>
  )
}
