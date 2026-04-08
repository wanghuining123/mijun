import { useState, useEffect, useRef } from "react";
import { supabase } from "../../../../lib/supabase";

interface ProtectionPeriodEnterprise {
  id: string;
  enterprise_id: string;
  enterprise_name: string;
  protection_reason: string;
  protection_months: number;
  start_date: string;
  end_date: string;
  status: "active" | "expired";
  marked_by: string;
  marked_at: string;
}

interface Props {
  enterprises: Array<{ id: string; name: string }>;
  readOnly?: boolean;
}

export default function ProtectionPeriodTab({ enterprises, readOnly = false }: Props) {
  const [protectionList, setProtectionList] = useState<ProtectionPeriodEnterprise[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEnterprise, setSelectedEnterprise] = useState("");
  const [enterpriseQuery, setEnterpriseQuery] = useState("");
  const [showEnterpriseDropdown, setShowEnterpriseDropdown] = useState(false);
  const enterpriseInputRef = useRef<HTMLDivElement>(null);
  const [protectionReason, setProtectionReason] = useState("");
  const [protectionMonths, setProtectionMonths] = useState(12);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [markedBy, setMarkedBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadProtectionEnterprises();
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

  const loadProtectionEnterprises = async () => {
    const { data, error } = await supabase
      .from("protection_period_enterprises")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProtectionList(data as ProtectionPeriodEnterprise[]);
    }
  };

  const calculateEndDate = (start: string, months: number) => {
    const date = new Date(start);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split("T")[0];
  };

  const getStatus = (endDate: string): "active" | "expired" => {
    return new Date(endDate) > new Date() ? "active" : "expired";
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
    if (!selectedEnterprise || !protectionReason.trim() || !markedBy.trim()) {
      setErrorMsg("请填写完整信息");
      return;
    }

    setLoading(true);
    const enterprise = enterprises.find((e) => e.id === selectedEnterprise);
    const endDate = calculateEndDate(startDate, protectionMonths);

    const { error } = await supabase.from("protection_period_enterprises").insert({
      enterprise_id: selectedEnterprise,
      enterprise_name: enterprise?.name || "",
      protection_reason: protectionReason,
      protection_months: protectionMonths,
      start_date: startDate,
      end_date: endDate,
      status: getStatus(endDate),
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
    setProtectionReason("");
    setProtectionMonths(12);
    setStartDate(new Date().toISOString().split("T")[0]);
    setMarkedBy("");
    loadProtectionEnterprises();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定要删除该保护期企业标记吗？")) return;

    const { error } = await supabase
      .from("protection_period_enterprises")
      .delete()
      .eq("id", id);

    if (error) {
      setErrorMsg("删除失败：" + error.message);
      return;
    }

    loadProtectionEnterprises();
  };

  const filteredList = protectionList.filter((item) =>
    item.enterprise_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const commonReasons = ["首次升规企业", "新设立企业", "重组企业", "其他特殊情况"];

  return (
    <div>
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
            onClick={() => { setShowAddModal(true); setErrorMsg(""); }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            新增保护期企业
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-4">
        <i className="ri-information-line"></i> 保护期内的企业暂不参与评价，如首次升规企业可免评1年
      </p>

      {filteredList.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <i className="ri-shield-check-line text-4xl mb-2"></i>
          <p className="text-sm">暂无保护期企业</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">企业名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">保护原因</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600">保护期时长</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">开始日期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">到期日期</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600">状态</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800">{item.enterprise_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.protection_reason}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center">{item.protection_months} 个月</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(item.start_date).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(item.end_date).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.status === "active" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                        <i className="ri-checkbox-circle-fill"></i>保护中
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        <i className="ri-time-line"></i>已到期
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!readOnly && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-700 text-sm cursor-pointer"
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
              <h3 className="text-lg font-semibold text-gray-800">新增保护期企业</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
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
                  保护原因 <span className="text-red-500">*</span>
                </label>
                <select
                  value={commonReasons.includes(protectionReason) ? protectionReason : ""}
                  onChange={(e) => setProtectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 mb-2"
                >
                  <option value="">请选择保护原因</option>
                  {commonReasons.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="或输入自定义原因"
                  value={protectionReason}
                  onChange={(e) => setProtectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  保护期时长（月） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="36"
                  value={protectionMonths}
                  onChange={(e) => setProtectionMonths(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-gray-500 mt-1">建议设置 1-36 个月</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  开始日期 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                <p className="text-xs text-teal-700">
                  <i className="ri-information-line"></i> 到期日期将自动计算为：
                  <strong className="ml-1">
                    {new Date(calculateEndDate(startDate, protectionMonths)).toLocaleDateString("zh-CN")}
                  </strong>
                </p>
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
                onClick={() => setShowAddModal(false)}
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
