import { Users, Receipt, FileSignature, Lock, FileText } from 'lucide-react'
import AreaHub from '../../components/dashboard/AreaHub'

// Team, billing, documents, and security. Roles/permissions/RBAC are a future build (Stage 4) —
// this holds what's real today: hiring, invoicing, contracts, and document storage.
export default function Admin() {
  return (
    <AreaHub
      eyebrow="Admin"
      title="Team, billing, and documents"
      description="Administrative functions. Roles and permissions are not built yet — everything here is currently visible to any authenticated account."
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
      ]}
    />
  )
}
