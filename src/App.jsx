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
import Resources from './pages/Resources';
import Article from './pages/Article';
import Login from './pages/Login';
import Register from './pages/Register';
import BookDemo from './pages/BookDemo';
import Careers from './pages/Careers';
import ApplicantLogin from './pages/ApplicantLogin';
import SetPassword from './pages/SetPassword';
import ApplicationStatus from './pages/ApplicationStatus';
import EmployeeDashboard from './pages/EmployeeDashboard';
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
          <Route path="/resources" element={<Resources />} />
          <Route path="/resources/:slug" element={<Article />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/book-demo" element={<BookDemo />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/applicant-login" element={<ApplicantLogin />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/application-status" element={<ApplicationStatus />} />
          <Route path="/employee-dashboard" element={<EmployeeDashboard />} />

          {/* CRM Dashboard — nested routes */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="leads" element={<Leads />} />
            <Route path="leads/:id" element={<LeadDetail />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="jobs/:id" element={<JobDetail />} />
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