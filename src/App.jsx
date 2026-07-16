import { lazy, Suspense } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import ChatBot from './components/ChatBot';
import Home from './pages/Home';

// Every route below Home is lazy — a homepage visitor (and the PageSpeed/Lighthouse run against
// it) should only ever download Home's code, not the CRM dashboard, AI agent builder, and
// employee/admin tooling bundled in behind it. Home stays a static import since it's the page
// almost every real visit and every audit run actually hits.
const Solutions = lazy(() => import('./pages/Solutions'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Company = lazy(() => import('./pages/Company'));
const Login = lazy(() => import('./pages/Login'));
const ClientLogin = lazy(() => import('./pages/ClientLogin'));
const Careers = lazy(() => import('./pages/Careers'));
const ApplicantLogin = lazy(() => import('./pages/ApplicantLogin'));
const SetPassword = lazy(() => import('./pages/SetPassword'));
const ApplicationStatus = lazy(() => import('./pages/ApplicationStatus'));
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'));
const Insights = lazy(() => import('./pages/Insights'));
const InsightPost = lazy(() => import('./pages/InsightPost'));
const PublicPortfolio = lazy(() => import('./pages/Portfolio'));
const Welcome = lazy(() => import('./pages/Welcome'));
const Intake = lazy(() => import('./pages/Intake'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const ServiceAgreement = lazy(() => import('./pages/ServiceAgreement'));
const Sign = lazy(() => import('./pages/Sign'));
const SignSuccess = lazy(() => import('./pages/SignSuccess'));
const Onboard = lazy(() => import('./pages/Onboard'));
const OnboardSuccess = lazy(() => import('./pages/OnboardSuccess'));
const Waves = lazy(() => import('./pages/Waves'));
const WavesForm = lazy(() => import('./pages/WavesForm'));
// Nova AI
const AIHome = lazy(() => import('./pages/ai/AIHome'));
const AIDashboard = lazy(() => import('./pages/ai/AIDashboard'));
const AICreateAgent = lazy(() => import('./pages/ai/AICreateAgent'));
const AIAgentDetail = lazy(() => import('./pages/ai/AIAgentDetail'));
const AIClientView = lazy(() => import('./pages/ai/AIClientView'));
// CRM Dashboard
const DashboardLayout = lazy(() => import('./components/dashboard/DashboardLayout'));
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome'));
const Clients = lazy(() => import('./pages/dashboard/Clients'));
const ClientDetail = lazy(() => import('./pages/dashboard/ClientDetail'));
const Leads = lazy(() => import('./pages/dashboard/Leads'));
const LeadDetail = lazy(() => import('./pages/dashboard/LeadDetail'));
const Jobs = lazy(() => import('./pages/dashboard/Jobs'));
const JobDetail = lazy(() => import('./pages/dashboard/JobDetail'));
const Documents = lazy(() => import('./pages/dashboard/Documents'));
const Newsletter = lazy(() => import('./pages/dashboard/Newsletter'));
const DashboardSettings = lazy(() => import('./pages/dashboard/Settings'));
const Portfolio = lazy(() => import('./pages/dashboard/Portfolio'));
const DashboardBlog = lazy(() => import('./pages/dashboard/Blog'));
const NovaVault = lazy(() => import('./pages/dashboard/NovaVault'));
const Invoices = lazy(() => import('./pages/dashboard/Invoices'));
const Referrals = lazy(() => import('./pages/dashboard/Referrals'));
const IntakeForms = lazy(() => import('./pages/dashboard/IntakeForms'));
const WaveOne = lazy(() => import('./pages/dashboard/WaveOne'));
const Contracts = lazy(() => import('./pages/dashboard/Contracts'));

function RouteFallback() {
  return <div style={{ minHeight: '100vh', background: '#0a0a0a' }} />
}

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <ScrollToTop />
        <Suspense fallback={<RouteFallback />}>
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
            <Route path="/intake" element={<Intake />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/service-agreement" element={<ServiceAgreement />} />
            <Route path="/sign/:contract_id" element={<Sign />} />
            <Route path="/sign/:contract_id/success" element={<SignSuccess />} />
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
              <Route path="contracts" element={<Contracts />} />
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
        </Suspense>
        <ChatBot />
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
