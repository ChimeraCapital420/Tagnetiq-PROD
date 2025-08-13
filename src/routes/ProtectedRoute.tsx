import React from "react";
import { Navigate } from "react-router-dom";

type Props = {
  isAllowed: boolean;
  to?: string;
  children: React.ReactNode;
};

export default function ProtectedRoute({ isAllowed, to = "/", children }: Props) {
  if (!isAllowed) return <Navigate to={to} replace />;
  return <>{children}</>;
}
