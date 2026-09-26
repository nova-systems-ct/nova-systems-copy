import { Navigate } from 'react-router-dom'
import { useOrg } from '../../lib/OrgContext'
import RequirePermission from './RequirePermission'

// Where /dashboard lands. Sales roles do not hold overview.view, so send them where their role actually works instead of an
// "Access Restricted" page. Routing is convenience only — every screen and API re-checks permission.
export default function DashboardIndex({ home }) {
  const { loading, noAccess, hasPermission } = useOrg()
  if (loading || noAccess) return null
  if (hasPermission('overview.view')) return <RequirePermission permission="overview.view">{home}</RequirePermission>
  if (hasPermission('sales.manage') || hasPermission('sales.finance') || hasPermission('sales.hiring')) return <Navigate to="/dashboard/sales-team" replace />
  if (hasPermission('sales.onboarding')) return <Navigate to="/rep" replace />
  return <RequirePermission permission="overview.view">{home}</RequirePermission>
}
