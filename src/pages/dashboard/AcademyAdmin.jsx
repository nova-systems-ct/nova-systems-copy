import { Navigate } from 'react-router-dom'

// Academy administration moved into the Sales Team workspace (practical review queue, critical-question reviews, passing policy,
// content approval, attempt resets, certificate revocation).
export default function AcademyAdmin() {
  return <Navigate to="/dashboard/sales-team/academy" replace />
}
