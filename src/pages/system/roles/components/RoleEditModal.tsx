import { useState, useEffect } from "react";
import { supabase } from "../../../../lib/supabase";
import { PAGE_KEYS } from "../constants";
import type { RoleRow } from "../page";

interface Props {
  editRole: RoleRow | null;
  onClose: () => void;
  onSaved: () => void;
}

interface PermState {
  can_view: boolean;
  can_edit: boolean;
}

const groups = [...new Set(PAGE_KEYS.map(p => p.group))];

export default function RoleEditModal({ editRole, onClose, onSaved }: Props) {
  const isEdit = !!editRole;
  const [name, setName] = useState(editRole?.name || "");
  const [description, setDescription] = useState(editRole?.description || "");
  const [perms, setPerms] = useState<Record<string, PermState>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const init: Record<string, PermState> = {};
    PAGE_KEYS.forEach(p => { init[p.key] = { can_view: false, can_edit: false }; });
    if (editRole) {
      if (editRole.code === "system_admin") {
        PAGE_KEYS.forEach(p => { init[p.key] = { can_view: true, can_edit: true }; });
      } else {
        supabase.from("role_permissions").select("page_key, can_view, can_edit").eq("role_id", editRole.id).then(({ data }) => {
          (data || []).forEach(d => { if (init[d.page_key]) init[d.page_key] = { can_view: d.can_view, can_edit: d.can_edit }; });
          setPerms({ ...init });
        });
        return;
      }
    }
    setPerms(init);
  }, [editRole]);

  const toggleView = (key: string) => {
    setPerms(prev => ({
      ...prev,
      [key]: { can_view: !prev[key].can_view, can_edit: !prev[key].can_view ? prev[key].can_edit : false },
    }));
  };

  const toggleEdit = (key: string) => {
    setPerms(prev => ({
      ...prev,
      [key]: { can_view: prev[key].can_edit ? prev[key].can_view : true, can_edit: !prev[key].can_edit },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("角色名称不能为空"); return; }
    setSaving(true); setError("");

    let roleId = editRole?.id;
    if (!isEdit) {
      const code = `custom_${Date.now()}`;
      const { data, error: err } = await supabase.from("roles").insert({ name: name.trim(), code, description: description.trim() }).select().maybeSingle();
      if (err || !data) { setError(err?.message || "创建失败"); setSaving(false); return; }
      roleId = data.id;
    } else {
      await supabase.from("roles").update({ name: name.trim(), description: description.trim() }).eq("id", roleId);
      await supabase.from("role_permissions").delete().eq("role_id", roleId);
    }

    const inserts = PAGE_KEYS
      .filter(p => perms[p.key]?.can_view || perms[p.key]?.can_edit)
      .map(p => ({ role_id: roleId, page_key: p.key, can_view: perms[p.key].can_view, can_edit: perms[p.key].can_edit }));
    if (inserts.length > 0) {
      const { error: pErr } = await supabase.from("role_permissions").insert(inserts);
      if (pErr) { setError(pErr.message); setSaving(false); return; }
    }

    onSaved(); onClose();
  };

  const isSystemAdmin = editRole?.code === "system_admin";

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg border border-gray-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{isEdit ? "编辑角色" : "新建角色"}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer rounded-md hover:bg-gray-100"><i className="ri-close-line"></i></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
            {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">角色名称</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="如：数据录入专员"
                disabled={editRole?.is_system}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">描述（可选）</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="角色用途说明"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">页面权限配置</label>
              {isSystemAdmin ? (
                <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">系统管理员默认拥有所有页面的完整权限，不可修改。</div>
              ) : (
                <div className="space-y-4">
                  {groups.map(group => (
                    <div key={group}>
                      <p className="text-xs font-semibold text-gray-400 uppercase mb-2">{group}</p>
                      <div className="space-y-1.5">
                        {PAGE_KEYS.filter(p => p.group === group).map(p => (
                          <div key={p.key} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-50">
                            <span className="text-sm text-gray-700">{p.label}</span>
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" checked={perms[p.key]?.can_view || false} onChange={() => toggleView(p.key)}
                                  className="w-3.5 h-3.5 accent-blue-500 cursor-pointer" />
                                <span className="text-xs text-gray-500">可查看</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" checked={perms[p.key]?.can_edit || false} onChange={() => toggleEdit(p.key)}
                                  className="w-3.5 h-3.5 accent-blue-500 cursor-pointer" />
                                <span className="text-xs text-gray-500">可编辑</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap">取消</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-50">
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
