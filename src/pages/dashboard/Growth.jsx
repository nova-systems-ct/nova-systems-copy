import { Target, HandCoins, Zap, Newspaper, LayoutGrid, Mail, GraduationCap, Building2, Clapperboard, Megaphone } from 'lucide-react'
import AreaHub from '../../components/dashboard/AreaHub'
import { useOrg } from '../../lib/OrgContext'

// Leads, pipeline, and acquisition/content tools. Shared CRM foundations (businesses, contacts,
// deals) shipped 2026-09-23 — see api/client.js's `crm` resource and
// supabase/crm-order-audit-migration-standalone.sql (not yet applied to production; the CRM page
// will show a load error until it is). Campaigns/social/reviews remain future builds.
export default function Growth() {
  // Academy is gated by its own permission (academy.view — Nova-internal roles only, never
  // client_* roles), independent of growth.view, so a viewer without it should not see a card
  // that just leads to an Access Restricted page.
  const { hasPermission } = useOrg()

  const items = [
    {
      label: 'CRM',
      description: 'Businesses (identity resolution) and the deal pipeline.',
      icon: Building2,
      path: '/dashboard/crm',
    },
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
    {
      label: 'Zion Studio',
      description: "Isaac's journal-to-video pipeline. Journal entries stay private to their author.",
      icon: Clapperboard,
      path: '/dashboard/zion',
    },
    {
      label: 'Marketing',
      description: 'Content pipeline, brand configuration, and platform connection status.',
      icon: Megaphone,
      path: '/dashboard/marketing',
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
