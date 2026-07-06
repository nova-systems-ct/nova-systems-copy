import { useState } from 'react'
import { useSEO } from '@/hooks/useSEO'
import AIDashboardShell from './AIDashboardShell'
import AIOverviewTab from './tabs/AIOverviewTab'
import AIAgentsTab from './tabs/AIAgentsTab'
import AICallLogsTab from './tabs/AICallLogsTab'
import AISmsLogsTab from './tabs/AISmsLogsTab'
import AIVoicesTab from './tabs/AIVoicesTab'
import AIKnowledgeBasesTab from './tabs/AIKnowledgeBasesTab'
import AISettingsTab from './tabs/AISettingsTab'

const TABS = {
  overview: AIOverviewTab,
  agents: AIAgentsTab,
  'call-logs': AICallLogsTab,
  'sms-logs': AISmsLogsTab,
  voices: AIVoicesTab,
  'knowledge-bases': AIKnowledgeBasesTab,
  settings: AISettingsTab,
}

export default function AIDashboard() {
  const [active, setActive] = useState('overview')
  useSEO({ title: 'Nova AI Dashboard — Nova Systems', description: 'Manage your Nova AI voice and text agents.' })

  const Tab = TABS[active] || AIOverviewTab

  return (
    <AIDashboardShell active={active} onNavigate={setActive}>
      <Tab onNavigate={setActive} />
    </AIDashboardShell>
  )
}
