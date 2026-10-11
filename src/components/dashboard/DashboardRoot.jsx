import { OrgProvider } from '../../lib/OrgContext'
import DashboardLayout from './DashboardLayout'

// Thin wrapper so OrgProvider (and its supabase-js import) only ever loads as part of the
// already-lazy /dashboard route chunk, never bundled into the eagerly-loaded homepage.
export default function DashboardRoot() {
  return (
    <OrgProvider>
      <DashboardLayout />
    </OrgProvider>
  )
}
