import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { FullPageSpinner } from "./components/ui";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import ClientList from "./pages/clients/ClientList";
import ClientDetail from "./pages/clients/ClientDetail";
import VisitDetail from "./pages/visits/VisitDetail";
import VisitForm from "./pages/visits/VisitForm";
import VisitSummary from "./pages/visits/VisitSummary";
import FollowUps from "./pages/FollowUps";
import Settings from "./pages/Settings";
import AuditLog from "./pages/AuditLog";
import Reports from "./pages/Reports";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { consultant, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!consultant) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<ClientList />} />
        <Route path="/clients/:clientId" element={<ClientDetail />} />
        <Route path="/clients/:clientId/visits/new" element={<VisitForm />} />
        <Route path="/visits/:visitId" element={<VisitDetail />} />
        <Route path="/visits/:visitId/edit" element={<VisitForm />} />
        <Route path="/visits/:visitId/summary" element={<VisitSummary />} />
        <Route path="/follow-ups" element={<FollowUps />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/audit-log" element={<AuditLog />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
