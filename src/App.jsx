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
import Dashboard from './pages/Dashboard';
import BookDemo from './pages/BookDemo';
import Careers from './pages/Careers';
import ApplicantLogin from './pages/ApplicantLogin';
import SetPassword from './pages/SetPassword';
import ApplicationStatus from './pages/ApplicationStatus';
import EmployeeDashboard from './pages/EmployeeDashboard';
import CRMHome from './pages/crm/CRMHome';
import CRMClients from './pages/crm/CRMClients';
import CRMClientDetail from './pages/crm/CRMClientDetail';
import CRMLeads from './pages/crm/CRMLeads';
import CRMLeadDetail from './pages/crm/CRMLeadDetail';
import CRMJobs from './pages/crm/CRMJobs';
import CRMJobDetail from './pages/crm/CRMJobDetail';
import CRMDocuments from './pages/crm/CRMDocuments';
import CRMNewsletter from './pages/crm/CRMNewsletter';
import CRMSettings from './pages/crm/CRMSettings';

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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/book-demo" element={<BookDemo />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/applicant-login" element={<ApplicantLogin />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/application-status" element={<ApplicationStatus />} />
          <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
          <Route path="/dashboard" element={<CRMHome />} />
          <Route path="/dashboard/clients" element={<CRMClients />} />
          <Route path="/dashboard/clients/:id" element={<CRMClientDetail />} />
          <Route path="/dashboard/leads" element={<CRMLeads />} />
          <Route path="/dashboard/leads/:id" element={<CRMLeadDetail />} />
          <Route path="/dashboard/jobs" element={<CRMJobs />} />
          <Route path="/dashboard/jobs/:id" element={<CRMJobDetail />} />
          <Route path="/dashboard/documents" element={<CRMDocuments />} />
          <Route path="/dashboard/newsletter" element={<CRMNewsletter />} />
          <Route path="/dashboard/settings" element={<CRMSettings />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
        <ChatBot />
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App