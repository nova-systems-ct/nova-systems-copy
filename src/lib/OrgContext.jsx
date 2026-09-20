import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

const OrgContext = createContext(null)

// Convenience only — which org tab was open last. Never treated as authority: every read below
// goes through RLS-scoped queries keyed off auth.uid(), so forging this value just fails to
// match anything in `memberships` and falls back to a real, authorized org (or none).
const STORAGE_KEY = 'nova_current_org_id'

export function OrgProvider({ children }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [permissionsByRole, setPermissionsByRole] = useState({})
  const [currentOrgId, setCurrentOrgId] = useState(null)
  const [user, setUser] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (!supabase) {
      setLoading(false)
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setMemberships([])
      setUser(null)
      setLoading(false)
      return
    }
    setUser(session.user)

    // RLS scopes this to exactly the caller's own active membership rows — what the server
    // actually returned, not a client filter standing in for security. Every real authenticated
    // user (Nova staff and client-side people alike) is member_type='staff'; the actual business
    // relationship is determined by role + organization membership, not by member_type.
    const { data: memberRows, error: mErr } = await supabase
      .from('organization_members')
      .select('id, organization_id, role, member_type, status, organizations ( id, name, slug, kind, status )')
      .eq('status', 'active')

    if (mErr) {
      setError(mErr.message)
      setLoading(false)
      return
    }

    const rows = memberRows || []
    const roles = [...new Set(rows.map((r) => r.role))]
    let permMap = {}
    if (roles.length) {
      // Live schema note (2026-09-13): role_permissions references permissions via a
      // permission_id FK (surrogate UUID keys), not a direct permission_key text column —
      // discovered by querying the live PostgREST OpenAPI schema after the applied migration
      // turned out to use a different normalized shape than the one originally drafted. This
      // embed matches what's actually live; see supabase/schema-update.sql's Stage 4 section for
      // the reconciliation note.
      const { data: rp } = await supabase
        .from('role_permissions')
        .select('role, permissions ( key )')
        .in('role', roles)
      permMap = (rp || []).reduce((acc, r) => {
        const permKey = r.permissions?.key
        if (permKey) (acc[r.role] ||= new Set()).add(permKey)
        return acc
      }, {})
    }

    setMemberships(rows)
    setPermissionsByRole(permMap)

    const validIds = rows.map((r) => r.organization_id)
    let stored = null
    try { stored = localStorage.getItem(STORAGE_KEY) } catch {}
    const initial = stored && validIds.includes(stored) ? stored : (validIds[0] || null)
    setCurrentOrgId(initial)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const setCurrentOrg = (orgId) => {
    // Fail closed: only accept an org id that's actually present in the server-returned
    // membership list — never trust an id from a dropdown value, URL, or elsewhere directly.
    const valid = memberships.some((m) => m.organization_id === orgId)
    if (!valid) return
    setCurrentOrgId(orgId)
    try { localStorage.setItem(STORAGE_KEY, orgId) } catch {}
  }

  const currentMembership = memberships.find((m) => m.organization_id === currentOrgId) || null
  const currentPermissions = currentMembership ? (permissionsByRole[currentMembership.role] || new Set()) : new Set()
  const hasPermission = (key) => currentPermissions.has(key)

  const organizations = memberships.map((m) => ({
    id: m.organization_id,
    name: m.organizations?.name || 'Unknown organization',
    slug: m.organizations?.slug,
    kind: m.organizations?.kind,
    role: m.role,
  }))

  const value = {
    loading,
    error,
    user,
    organizations,
    currentOrgId,
    currentOrg: organizations.find((o) => o.id === currentOrgId) || null,
    currentMembership,
    setCurrentOrg,
    hasPermission,
    noAccess: !loading && !error && memberships.length === 0,
    reload: load,
  }

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within OrgProvider')
  return ctx
}
