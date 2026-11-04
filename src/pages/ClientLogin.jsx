import { Navigate, useLocation } from 'react-router-dom';
import { safeReturnTo } from '../lib/returnTo.js';
// One real sign-in; the verified membership determines the accessible workspace.
export default function ClientLogin() {
  const location=useLocation();const next=safeReturnTo(new URLSearchParams(location.search).get('returnTo'));
  return <Navigate replace to={`/login?returnTo=${encodeURIComponent(next)}`} />;
}
