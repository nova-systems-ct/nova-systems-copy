import { Target, HandCoins, Zap, Newspaper, LayoutGrid, Mail, GraduationCap } from 'lucide-react'
import AreaHub from '../../components/dashboard/AreaHub'
import { useOrg } from '../../lib/OrgContext'

// Leads, pipeline, and acquisition/content tools. CRM, campaigns, social, and reviews are future
// builds — this holds what's real today: real leads (Stage 5), referral tracking, Wave One
// applications, the public-facing content tools (blog, portfolio, newsletter), and Sales Academy.
export default function Growth() {
  // Academy is gated by its own permission (academy.view — Nova-internal roles only, never
  // client_* roles), independent of growth.view, so a viewer without it should not see a card
  // that just leads to an Access Restricted page.
  const { hasPermission } = useOrg()

  const items = [
    {
      label: 'Leads',
      description: 'Real leads from /welcome and /intake, with pipeline status.',
      icon: Target,
      path: '/dashboard/leads',
    },
    {
      label: 'Referrals',
      description: 'Partner referral tracking and commissions owed.',
      icon: HandCoins,
      path: '/dashboard/referrals',
    },
    {
      label: 'Wave One',
      description: 'Wave One product applications and enrollment.',
      icon: Zap,
      path: '/dashboard/wave-one',
    },
    {
      label: 'Insights',
      description: 'The public Insights blog — write and publish posts.',
      icon: Newspaper,
      path: '/dashboard/blog',
    },
    {
      label: 'Portfolio',
      description: 'Manage the public case-study and work showcase.',
      icon: LayoutGrid,
      path: '/dashboard/portfolio',
    },
    {
      label: 'Newsletter',
      description: 'Send and manage email newsletter campaigns.',
      icon: Mail,
      path: '/dashboard/newsletter',
    },
  ]

  if (hasPermission('academy.view')) {
    items.push({
      label: 'Sales Academy',
      description: 'Ten-program sales training — lessons, quizzes, certificates.',
      icon: GraduationCap,
      path: '/dashboard/academy',
    })
  }

  return (
    <AreaHub
      eyebrow="Growth"
      title="Leads, pipeline, and content"
      description="Acquisition and growth tools. A full CRM, campaigns, and social integrations are future builds — this is what's real and connected today."
      items={items}
    />
  )
}
