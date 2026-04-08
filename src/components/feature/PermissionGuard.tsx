import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

interface Props {
  pageKey?: string;
  children: ReactNode;
}

export default function PermissionGuard({ pageKey, children }: Props) {
  const { user, loading, canView } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (pageKey && !canView(pageKey)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-24">
        <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-full mb-4">
          <i className="ri-lock-2-line text-2xl text-gray-400"></i>
        </div>
        <h2 className="text-lg font-semibold text-gray-700 mb-1">无访问权限</h2>
        <p className="text-sm text-gray-400">您没有权限访问此页面，请联系系统管理员</p>
      </div>
    );
  }
  return <>{children}</>;
}
