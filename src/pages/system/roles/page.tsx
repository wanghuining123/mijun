import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import RoleEditModal from "./components/RoleEditModal";
import { PAGE_KEYS } from "./constants";

export interface RoleRow {
  id: string;
  name: string;
  code: string;
  description: string;
  is_system: boolean;
  created_at: string;
  permCount?: number;
}

export { PAGE_KEYS };

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editRole, setEditRole] = useState<RoleRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    const { data: roleData } = await supabase.from("roles").select("*").order("created_at");
    const { data: permData } = await supabase.from("role_permissions").select("role_id, page_key");
    const rows = (roleData || []).map(r => ({
      ...r,
      permCount: (permData || []).filter(p => p.role_id === r.id && PAGE_KEYS.some(pk => pk.key === p.page_key)).length,
    }));
    setRoles(rows);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    // 先清除该角色下所有权限记录，再删角色本身
    const { error: permErr } = await supabase.from("role_permissions").delete().eq("role_id", deleteTarget.id);
    if (permErr) {
      setDeleteError("清除权限记录失败：" + permErr.message);
      setDeleting(false);
      return;
    }
    const { error: roleErr } = await supabase.from("roles").delete().eq("id", deleteTarget.id);
    if (roleErr) {
      setDeleteError(roleErr.message.includes("foreign key") || roleErr.message.includes("violates")
        ? "该角色已有用户分配，请先将相关用户改为其他角色后再删除"
        : "删除失败：" + roleErr.message);
      setDeleting(false);
      return;
    }
    setDeleteTarget(null);
    setDeleting(false);
    fetchRoles();
  };

  const roleCodeBadge: Record<string, string> = {
    system_admin: "bg-red-50 text-red-600",
    advanced_user: "bg-purple-50 text-purple-600",
    data_entry: "bg-green-50 text-green-600",
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">角色管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">管理角色定义与页面访问权限配置</p>
        </div>
        <button
          onClick={() => { setEditRole(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors whitespace-nowrap"
        >
          <i className="ri-shield-user-line"></i>新建角色
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400"><i className="ri-loader-4-line animate-spin mr-2"></i>加载中…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {roles.map(role => (
            <div key={role.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
                    <i className="ri-shield-user-line text-gray-600"></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">{role.name}</span>
                      {role.is_system && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">系统内置</span>}
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleCodeBadge[role.code] || "bg-gray-100 text-gray-600"}`}>{role.code}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{role.description || "暂无描述"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditRole(role); setModalOpen(true); }}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
                    编辑权限
                  </button>
                  {!role.is_system && (
                    <button onClick={() => setDeleteTarget(role)}
                      className="px-3 py-1.5 text-sm text-red-500 border border-red-200 hover:bg-red-50 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
                      删除
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">已配置 {role.permCount || 0} / {PAGE_KEYS.length} 个页面权限</p>
                <div className="flex flex-wrap gap-1.5">
                  {PAGE_KEYS.map(pk => {
                    const hasPerm = role.code === "system_admin";
                    return (
                      <span key={pk.key} className={`text-xs px-2 py-0.5 rounded ${hasPerm ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-400"}`}>
                        {pk.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <RoleEditModal editRole={editRole} onClose={() => setModalOpen(false)} onSaved={fetchRoles} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">确认删除角色</h3>
            <p className="text-sm text-gray-600 mb-4">确定要删除角色 <strong>{deleteTarget.name}</strong> 吗？已分配此角色的用户将失去权限。</p>
            {deleteError && (
              <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                <i className="ri-error-warning-line mr-1.5"></i>{deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteError(""); }} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap">取消</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-50">
                {deleting ? "删除中…" : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
