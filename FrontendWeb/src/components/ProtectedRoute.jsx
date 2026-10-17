import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ user, allowedRoles, children }) {
  if (!user || !user.token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}