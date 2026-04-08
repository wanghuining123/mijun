import { useState, useEffect } from "react";
import { supabase } from "../../../../lib/supabase";
import type { UserRow } from "../page";

interface Role { id: string; name: string; code: string; }

interface Props {
  editUser: UserRow | null;
  edgeFnUrl: string;
  getToken: () => Promise<string>;
  onClose: () => void;
  onSaved: () => void;
}

const REVIEW_PERMISSION_OPTIONS = [
  { value: 'none', label: '无权限', desc: '不参与任何审批环节' },
  { value: 'level1', label: '初审', desc: '可对政策文件进行初审' },
  { value: 'level2', label: '复审', desc: '可对政策文件进行复审' },
  { value: 'level3', label: '终审', desc: '可对政策文件进行终审' },
];

export default function UserEditModal({ editUser, edgeFnUrl, getToken, onClose, onSaved }: Props) {
  const isEdit = !!editUser;
  const [phone, setPhone] = useState(editUser?.phone || "");
  const [realName, setRealName] = useState(editUser?.real_name || "");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(editUser?.roles?.id || "");
  const [isActive, setIsActive] = useState(editUser?.is_active ?? true);
  const [reviewPermission, setReviewPermission] = useState<string>((editUser as any)?.review_permission || 'none');
  const [roles, setRoles] = useState<Role[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("roles").select("id, name, code").order("created_at").then(({ data }) => setRoles(data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEdit && (!phone.trim() || !password.trim())) { setError("手机号和初始密码不能为空"); return; }
    if (!roleId) { setError("请选择角色"); return; }
    setSaving(true); setError("");

    try {
      const token = await getToken();
      if (!token) {
        setError("登录已过期，请重新登录后再试");
        setSaving(false);
        return;
      }

      const body = isEdit
        ? { action: "update", userId: editUser.id, realName: realName.trim(), roleId, isActive, reviewPermission, ...(password ? { password } : {}) }
        : { action: "create", phone: phone.trim(), password, realName: realName.trim(), roleId, reviewPermission };

      // 加 15 秒超时，防止边缘函数冷启动时卡死
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      let res: Response;
      try {
        res = await fetch(edgeFnUrl, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (fetchErr: unknown) {
        clearTimeout(timer);
        const isAbort = fetchErr instanceof Error && fetchErr.name === 'AbortError';
        setError(isAbort ? "请求超时（服务器冷启动较慢），请稍后重试" : "网络请求失败，请检查连接后重试");
        setSaving(false);
        return;
      }
      clearTimeout(timer);

      let json: Record<string, unknown>;
      try {
        json = await res.json();
      } catch {
        setError("服务器响应异常，请稍后重试");
        setSaving(false);
        return;
      }

      if (json.error) {
        setError(json.error as string);
        setSaving(false);
        return;
      }

      // 等 300ms 让数据库写入完成，再刷新列表
      await new Promise(resolve => setTimeout(resolve, 300));
      onSaved();
      onClose();
    } catch {
      setError("操作失败，请稍后重试");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{isEdit ? "编辑用户" : "新建用户"}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer rounded-md hover:bg-gray-100"><i className="ri-close-line"></i></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">姓名</label>
            <input type="text" value={realName} onChange={e => setRealName(e.target.value)} placeholder="请输入真实姓名"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">手机号 {isEdit && <span className="text-gray-400 font-normal">（不可修改）</span>}</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="请输入手机号" disabled={isEdit}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 disabled:bg-gray-50 disabled:text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{isEdit ? "新密码（留空不修改）" : "初始密码"}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isEdit ? "留空则不修改密码" : "请设置初始密码"}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">角色</label>
            <select value={roleId} onChange={e => setRoleId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 cursor-pointer">
              <option value="">请选择角色</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          {/* 审批权限 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              审批权限
              <span className="ml-2 text-xs font-normal text-gray-400">（考核政策文件管理）</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REVIEW_PERMISSION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReviewPermission(opt.value)}
                  className={`flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    reviewPermission === opt.value
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      reviewPermission === opt.value ? 'border-teal-500' : 'border-gray-300'
                    }`}>
                      {reviewPermission === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>}
                    </div>
                    <span className={`text-sm font-medium ${reviewPermission === opt.value ? 'text-teal-700' : 'text-gray-700'}`}>
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 pl-5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          {isEdit && (
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-sm font-medium text-gray-700">账号状态</span>
                <p className="text-xs text-gray-400 mt-0.5">{isActive ? "用户可正常登录系统" : "用户将无法登录系统"}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(v => !v)}
                className={`relative inline-flex flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer focus:outline-none ${isActive ? "bg-teal-500" : "bg-gray-300"}`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isActive ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap">取消</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-50">
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
