import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import UserEditModal from "./components/UserEditModal";

export interface UserRow {
  id: string;
  phone: string;
  real_name: string;
  is_active: boolean;
  created_at: string;
  review_permission: 'none' | 'level1' | 'level2' | 'level3';
  roles: { id: string; name: string; code: string } | null;
}

const EDGE_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/manage-users`;

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [searchText, setSearchText] = useState("");

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, phone, real_name, is_active, created_at, review_permission, roles(id, name, code)")
        .order("created_at", { ascending: false });

      if (error) {
        setFetchError("加载失败：" + error.message);
        setUsers([]);
      } else {
        setUsers((data || []) as unknown as UserRow[]);
      }
    } catch {
      setFetchError("网络请求失败，请检查连接后重试");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter(u =>
    u.phone?.includes(searchText) || u.real_name?.includes(searchText)
  );

  const roleColor: Record<string, string> = {
    system_admin: "bg-red-50 text-red-600",
    advanced_user: "bg-teal-50 text-teal-600",
    data_entry: "bg-green-50 text-green-600",
  };

  const reviewPermLabel: Record<string, { label: string; color: string }> = {
    none: { label: '无权限', color: 'bg-gray-100 text-gray-400' },
    level1: { label: '初审', color: 'bg-amber-50 text-amber-600' },
    level2: { label: '复审', color: 'bg-teal-50 text-teal-600' },
    level3: { label: '终审', color: 'bg-emerald-50 text-emerald-600' },
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">用户管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">管理系统用户账号和角色分配</p>
        </div>
        <button
          onClick={() => { setEditUser(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-user-add-line"></i>新建用户
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
              placeholder="搜索姓名或手机号" className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400"
            />
          </div>
          <span className="text-sm text-gray-500">共 {filtered.length} 个用户</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <i className="ri-loader-4-line animate-spin mr-2"></i>加载中…
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 flex items-center justify-center bg-red-50 rounded-full">
              <i className="ri-error-warning-line text-red-500 text-xl"></i>
            </div>
            <p className="text-sm text-red-500">{fetchError}</p>
            <button onClick={fetchUsers} className="px-4 py-2 text-sm text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 cursor-pointer whitespace-nowrap">
              <i className="ri-refresh-line mr-1.5"></i>重新加载
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">姓名</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">手机号</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">角色</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">审批权限</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">创建时间</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => {
                const rp = reviewPermLabel[u.review_permission || 'none'];
                return (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full">
                          <i className="ri-user-line text-gray-500 text-sm"></i>
                        </div>
                        <span className="font-medium text-gray-800">{u.real_name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.phone}</td>
                    <td className="px-4 py-3">
                      {u.roles ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${roleColor[(u.roles as any).code] || "bg-gray-100 text-gray-600"}`}>
                          {(u.roles as any).name}
                        </span>
                      ) : <span className="text-gray-400">未分配</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${rp.color}`}>
                        {rp.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${u.is_active ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-green-500" : "bg-gray-400"}`}></span>
                        {u.is_active ? "已启用" : "已禁用"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(u.created_at).toLocaleDateString("zh-CN")}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setEditUser(u); setModalOpen(true); }}
                        className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer transition-colors whitespace-nowrap"
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">暂无用户数据</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <UserEditModal
          editUser={editUser}
          edgeFnUrl={EDGE_URL}
          getToken={getToken}
          onClose={() => setModalOpen(false)}
          onSaved={fetchUsers}
        />
      )}
    </div>
  );
}
