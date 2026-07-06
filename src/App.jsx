import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import ChatBot from './components/ChatBot';
import Home from './pages/Home';
import Solutions from './pages/Solutions';
import Pricing from './pages/Pricing';
import Company from './pages/Company';
import Login from './pages/Login';
import ClientLogin from './pages/ClientLogin';
import Careers from './pages/Careers';
import ApplicantLogin from './pages/ApplicantLogin';
import SetPassword from './pages/SetPassword';
import ApplicationStatus from './pages/ApplicationStatus';
import EmployeeDashboard from './pages/EmployeeDashboard';
import Insights from './pages/Insights';
import InsightPost from './pages/InsightPost';
import PublicPortfolio from './pages/Portfolio';
import Welcome from './pages/Welcome';
import Onboard from './pages/Onboard';
import OnboardSuccess from './pages/OnboardSuccess';
import Waves from './pages/Waves';
import WavesForm from './pages/WavesForm';
// Nova AI
import AIHome from './pages/ai/AIHome';
import AIDashboard from './pages/ai/AIDashboard';
import AICreateAgent from './pages/ai/AICreateAgent';
import AIAgentDetail from './pages/ai/AIAgentDetail';
import AIClientView from './pages/ai/AIClientView';
// CRM Dashboard
import DashboardLayout from './components/dashboard/DashboardLayout';
import DashboardHome from './pages/dashboard/DashboardHome';
import Clients from './pages/dashboard/Clients';
import ClientDetail from './pages/dashboard/ClientDetail';
import Leads from './pages/dashboard/Leads';
import LeadDetail from './pages/dashboard/LeadDetail';
import Jobs from './pages/dashboard/Jobs';
import JobDetail from './pages/dashboard/JobDetail';
import Documents from './pages/dashboard/Documents';
import Newsletter from './pages/dashboard/Newsletter';
import DashboardSettings from './pages/dashboard/Settings';
import Portfolio from './pages/dashboard/Portfolio';
import DashboardBlog from './pages/dashboard/Blog';
import NovaVault from './pages/dashboard/NovaVault';
import Invoices from './pages/dashboard/Invoices';
import Referrals from './pages/dashboard/Referrals';
import IntakeForms from './pages/dashboard/IntakeForms';
import WaveOne from './pages/dashboard/WaveOne';

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/solutions" element={<Solutions />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/company" element={<Company />} />
          <Route path="/login" element={<Login />} />
          <Route path="/client-login" element={<ClientLogin />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/applicant-login" element={<ApplicantLogin />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/application-status" element={<ApplicationStatus />} />
          <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/insights/:slug" element={<InsightPost />} />
          <Route path="/portfolio" element={<PublicPortfolio />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/onboard" element={<Onboard />} />
          <Route path="/onboard/success" element={<OnboardSuccess />} />
          <Route path="/waves" element={<Waves />} />
          <Route path="/waves/form" element={<WavesForm />} />

          {/* Nova AI */}
          <Route path="/ai" element={<AIHome />} />
          <Route path="/ai/dashboard" element={<AIDashboard />} />
          <Route path="/ai/dashboard/create-agent" element={<AICreateAgent />} />
          <Route path="/ai/agent/:id" element={<AIAgentDetail />} />
          <Route path="/ai/client/:clientId" element={<AIClientView />} />

          {/* CRM Dashboard — nested routes */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="leads" element={<Leads />} />
            <Route path="leads/:id" element={<LeadDetail />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="jobs/:id" element={<JobDetail />} />
            <Route path="intake-forms" element={<IntakeForms />} />
            <Route path="wave-one" element={<WaveOne />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="referrals" element={<Referrals />} />
            <Route path="nova-vault" element={<NovaVault />} />
            <Route path="blog" element={<DashboardBlog />} />
            <Route path="documents" element={<Documents />} />
            <Route path="newsletter" element={<Newsletter />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="settings" element={<DashboardSettings />} />
          </Route>

          <Route path="*" element={<PageNotFound />} />
        </Routes>
        <ChatBot />
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
