import { useState, useEffect, useRef } from "react";
import { supabase } from "../../../../lib/supabase";

interface ExemptEnterprise {
  id: string;
  enterprise_id: string;
  enterprise_name: string;
  exempt_reason: string;
  marked_by: string;
  marked_at: string;
}

interface Props {
  enterprises: Array<{ id: string; name: string }>;
  readOnly?: boolean;
}

export default function ExemptEnterpriseTab({ enterprises, readOnly = false }: Props) {
  const [exemptList, setExemptList] = useState<ExemptEnterprise[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEnterprise, setSelectedEnterprise] = useState("");
  const [enterpriseQuery, setEnterpriseQuery] = useState("");
  const [showEnterpriseDropdown, setShowEnterpriseDropdown] = useState(false);
  const enterpriseInputRef = useRef<HTMLDivElement>(null);
  const [exemptReason, setExemptReason] = useState("");
  const [markedBy, setMarkedBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadExemptEnterprises();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (enterpriseInputRef.current && !enterpriseInputRef.current.contains(e.target as Node)) {
        setShowEnterpriseDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadExemptEnterprises = async () => {
    const { data, error } = await supabase
      .from("exempt_enterprises")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setExemptList(data as ExemptEnterprise[]);
    }
  };

  const filteredEnterprises = enterprises.filter((e) =>
    e.name.toLowerCase().includes(enterpriseQuery.toLowerCase())
  );

  const handleSelectEnterprise = (ent: { id: string; name: string }) => {
    setSelectedEnterprise(ent.id);
    setEnterpriseQuery(ent.name);
    setShowEnterpriseDropdown(false);
  };

  const handleAdd = async () => {
    setErrorMsg("");
    if (!selectedEnterprise || !exemptReason.trim() || !markedBy.trim()) {
      setErrorMsg("请填写完整信息");
      return;
    }

    setLoading(true);
    const enterprise = enterprises.find((e) => e.id === selectedEnterprise);

    const { error } = await supabase.from("exempt_enterprises").insert({
      enterprise_id: selectedEnterprise,
      enterprise_name: enterprise?.name || "",
      exempt_reason: exemptReason,
      marked_by: markedBy,
      marked_at: new Date().toISOString(),
    });

    setLoading(false);

    if (error) {
      setErrorMsg("添加失败：" + error.message);
      return;
    }

    setShowAddModal(false);
    setSelectedEnterprise("");
    setEnterpriseQuery("");
    setExemptReason("");
    setMarkedBy("");
    loadExemptEnterprises();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除该免评企业标记吗？")) return;

    const { error } = await supabase
      .from("exempt_enterprises")
      .delete()
      .eq("id", id);

    if (error) {
      alert("删除失败：" + error.message);
      return;
    }

    loadExemptEnterprises();
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setSelectedEnterprise("");
    setEnterpriseQuery("");
    setExemptReason("");
    setMarkedBy("");
    setErrorMsg("");
  };

  const filteredList = exemptList.filter((item) =>
    item.enterprise_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const commonReasons = [
    "采矿业",
    "电力供应业",
    "燃气供应业",
    "水的生产和供应业",
    "其他特殊行业",
  ];

  return (
    <div>
      {/* 搜索和操作栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-80">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="搜索企业名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            新增免评企业
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-4">
        <i className="ri-information-line mr-1"></i>
        标记为免评的企业将不参与综合评价计算，适用于采矿业、电力供应业等特殊行业
      </p>

      {/* 列表 */}
      {filteredList.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="w-10 h-10 flex items-center justify-center mx-auto mb-2">
            <i className="ri-shield-cross-line text-4xl"></i>
          </div>
          <p className="text-sm">暂无免评企业</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">企业名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">免评原因</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">标记人</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">标记时间</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800">{item.enterprise_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.exempt_reason}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.marked_by}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(item.marked_at).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!readOnly && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-500 hover:text-red-700 text-sm cursor-pointer"
                      >
                        <i className="ri-delete-bin-line"></i> 删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 新增弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">新增免评企业</h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {errorMsg && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  <i className="ri-error-warning-line"></i>
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择企业 <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={enterpriseInputRef}>
                  <input
                    type="text"
                    placeholder="输入企业名称搜索..."
                    value={enterpriseQuery}
                    onChange={(e) => {
                      setEnterpriseQuery(e.target.value);
                      setSelectedEnterprise("");
                      setShowEnterpriseDropdown(true);
                    }}
                    onFocus={() => setShowEnterpriseDropdown(true)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 pr-8"
                  />
                  <i className="ri-search-line absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                  {showEnterpriseDropdown && filteredEnterprises.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredEnterprises.map((ent) => (
                        <div
                          key={ent.id}
                          onMouseDown={() => handleSelectEnterprise(ent)}
                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-teal-50 hover:text-teal-700 ${
                            selectedEnterprise === ent.id ? "bg-teal-50 text-teal-700 font-medium" : "text-gray-700"
                          }`}
                        >
                          {ent.name}
                        </div>
                      ))}
                    </div>
                  )}
                  {showEnterpriseDropdown && enterpriseQuery && filteredEnterprises.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
                      未找到匹配企业
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  免评原因 <span className="text-red-500">*</span>
                </label>
                <select
                  value={commonReasons.includes(exemptReason) ? exemptReason : ""}
                  onChange={(e) => setExemptReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 mb-2"
                >
                  <option value="">请选择常用原因（可选）</option>
                  {commonReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="或输入自定义原因"
                  value={exemptReason}
                  onChange={(e) => setExemptReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  标记人 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="请输入标记人姓名"
                  value={markedBy}
                  onChange={(e) => setMarkedBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 whitespace-nowrap cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                disabled={loading}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium whitespace-nowrap disabled:opacity-50 cursor-pointer"
              >
                {loading ? "添加中..." : "确定"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
