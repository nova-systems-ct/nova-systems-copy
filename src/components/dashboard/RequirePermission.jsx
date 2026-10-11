import { useOrg } from '../../lib/OrgContext'

const GOLD = '#C9A84C'

// Frontend gate for UX only — hides content the user isn't permitted to see so navigating there
// isn't confusing. The actual authority is RLS on the underlying tables; this component cannot
// grant access to data the server wouldn't otherwise return.
export default function RequirePermission({ permission, children }) {
  const { loading, hasPermission, noAccess } = useOrg()

  if (loading || noAccess) return null

  if (!hasPermission(permission)) {
    return (
      <div style={{ padding: '80px 52px', textAlign: 'center' }}>
        <p style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>
          Access Restricted
        </p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          You don't have permission to view this area.
        </p>
      </div>
    )
  }

  return children
}
