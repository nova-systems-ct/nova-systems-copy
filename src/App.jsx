import { lazy, Suspense } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import ChatBot from './components/ChatBot';
import Home from './pages/Home';

// Every route below Home is lazy — a homepage visitor (and the PageSpeed/Lighthouse run against
// it) should only ever download Home's code, not the CRM dashboard, AI agent builder, and
// employee/admin tooling bundled in behind it. Home stays a static import since it's the page
// almost every real visit and every audit run actually hits.
const Solutions = lazy(() => import('./pages/Solutions'));
const BusinessDiagnostic = lazy(() => import('./pages/BusinessDiagnostic'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Company = lazy(() => import('./pages/Company'));
const Login = lazy(() => import('./pages/Login'));
const ClientLogin = lazy(() => import('./pages/ClientLogin'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
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
// CRM Dashboard
const DashboardRoot = lazy(() => import('./components/dashboard/DashboardRoot'));
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome'));
const Intelligence = lazy(() => import('./pages/dashboard/Intelligence'));
const Growth = lazy(() => import('./pages/dashboard/Growth'));
const Execution = lazy(() => import('./pages/dashboard/Execution'));
const Companies = lazy(() => import('./pages/dashboard/Companies'));
const Admin = lazy(() => import('./pages/dashboard/Admin'));
const Leads = lazy(() => import('./pages/dashboard/Leads'));
const Tasks = lazy(() => import('./pages/dashboard/Tasks'));
const Jobs = lazy(() => import('./pages/dashboard/Jobs'));
const JobDetail = lazy(() => import('./pages/dashboard/JobDetail'));
const Documents = lazy(() => import('./pages/dashboard/Documents'));
const Newsletter = lazy(() => import('./pages/dashboard/Newsletter'));
const Portfolio = lazy(() => import('./pages/dashboard/Portfolio'));
const DashboardBlog = lazy(() => import('./pages/dashboard/Blog'));
const NovaVault = lazy(() => import('./pages/dashboard/NovaVault'));
const Invoices = lazy(() => import('./pages/dashboard/Invoices'));
const Referrals = lazy(() => import('./pages/dashboard/Referrals'));
const IntakeForms = lazy(() => import('./pages/dashboard/IntakeForms'));
const WaveOne = lazy(() => import('./pages/dashboard/WaveOne'));
const Contracts = lazy(() => import('./pages/dashboard/Contracts'));
const RequirePermission = lazy(() => import('./components/dashboard/RequirePermission'));

function RouteFallback() {
  return <div style={{ minHeight: '100vh', background: '#04112B' }} />
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
            <Route path="/business-diagnostic" element={<BusinessDiagnostic />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/company" element={<Company />} />
            {/* Retired in favor of /welcome (Part 1 Phase 1) — this route stays so every
                existing "Request a Nova Audit" link/bookmark site-wide keeps working. */}
            <Route path="/request-audit" element={<Navigate to="/welcome" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/client-login" element={<ClientLogin />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />
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

            {/* CRM Dashboard — nested routes */}
            <Route path="/dashboard" element={<DashboardRoot />}>
              <Route index element={<RequirePermission permission="overview.view"><DashboardHome /></RequirePermission>} />
              <Route path="intelligence" element={<RequirePermission permission="intelligence.view"><Intelligence /></RequirePermission>} />
              <Route path="growth" element={<RequirePermission permission="growth.view"><Growth /></RequirePermission>} />
              <Route path="execution" element={<RequirePermission permission="execution.view"><Execution /></RequirePermission>} />
              <Route path="companies" element={<RequirePermission permission="companies.view"><Companies /></RequirePermission>} />
              <Route path="admin" element={<RequirePermission permission="admin.view"><Admin /></RequirePermission>} />
              <Route path="leads" element={<RequirePermission permission="growth.view"><Leads /></RequirePermission>} />
              <Route path="tasks" element={<RequirePermission permission="execution.view"><Tasks /></RequirePermission>} />
              <Route path="jobs" element={<RequirePermission permission="admin.view"><Jobs /></RequirePermission>} />
              <Route path="jobs/:id" element={<RequirePermission permission="admin.view"><JobDetail /></RequirePermission>} />
              <Route path="intake-forms" element={<RequirePermission permission="intelligence.view"><IntakeForms /></RequirePermission>} />
              <Route path="wave-one" element={<RequirePermission permission="growth.view"><WaveOne /></RequirePermission>} />
              <Route path="invoices" element={<RequirePermission permission="admin.view"><Invoices /></RequirePermission>} />
              <Route path="contracts" element={<RequirePermission permission="admin.view"><Contracts /></RequirePermission>} />
              <Route path="referrals" element={<RequirePermission permission="growth.view"><Referrals /></RequirePermission>} />
              <Route path="nova-vault" element={<RequirePermission permission="admin.view"><NovaVault /></RequirePermission>} />
              <Route path="blog" element={<RequirePermission permission="growth.view"><DashboardBlog /></RequirePermission>} />
              <Route path="documents" element={<RequirePermission permission="admin.view"><Documents /></RequirePermission>} />
              <Route path="newsletter" element={<RequirePermission permission="growth.view"><Newsletter /></RequirePermission>} />
              <Route path="portfolio" element={<RequirePermission permission="growth.view"><Portfolio /></RequirePermission>} />
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
