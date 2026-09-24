import { Users, Receipt, FileSignature, Lock, FileText, Plug, UserPlus, ShieldAlert } from 'lucide-react'
import AreaHub from '../../components/dashboard/AreaHub'

// Team, billing, documents, and security. Real RBAC is live (Stage 4) — every route below and
// this hub itself require admin.view via organization_members + role_permissions, not just a UI
// convention; see src/lib/OrgContext.jsx and api/_auth.js for the actual enforcement.
export default function Admin() {
  return (
    <AreaHub
      eyebrow="Admin"
      title="Team, billing, and documents"
      description="Administrative functions, gated to staff with admin-level access."
      items={[
        {
          label: 'Candidates',
          description: 'Job applicants and the hiring pipeline.',
          icon: Users,
          path: '/dashboard/jobs',
        },
        {
          label: 'Invoices',
          description: 'Client billing and outstanding invoices.',
          icon: Receipt,
          path: '/dashboard/invoices',
        },
        {
          label: 'Contracts',
          description: 'Client agreements and e-signature status.',
          icon: FileSignature,
          path: '/dashboard/contracts',
        },
        {
          label: 'Nova Vault',
          description: 'Secure storage for contracts, invoices, and client files.',
          icon: Lock,
          path: '/dashboard/nova-vault',
        },
        {
          label: 'Documents',
          description: 'General document management.',
          icon: FileText,
          path: '/dashboard/documents',
        },
        {
          label: 'Team',
          description: 'Nova staff accounts, roles, and invitations.',
          icon: UserPlus,
          path: '/dashboard/team',
        },
        {
          label: 'Integration Center',
          description: 'Live connection status for every external provider — Supabase, Stripe, Resend, and more.',
          icon: Plug,
          path: '/dashboard/integrations',
        },
        {
          label: 'Approval Inbox',
          description: 'Pending audit reports, Zion videos, and consequential actions awaiting sign-off.',
          icon: ShieldAlert,
          path: '/dashboard/approvals',
        },
      ]}
    />
  )
}
