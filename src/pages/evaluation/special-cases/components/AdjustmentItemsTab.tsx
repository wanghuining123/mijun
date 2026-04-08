import { useState, useEffect, useRef } from "react";
import { supabase } from "../../../../lib/supabase";

interface AdjustmentItem {
  id: string;
  enterprise_id: string;
  enterprise_name: string;
  item_type: string;
  score_value: number;
  remark: string;
  created_by: string;
  created_at: string;
}

interface Props {
  enterprises: Array<{ id: string; name: string }>;
  readOnly?: boolean;
}

export default function AdjustmentItemsTab({ enterprises, readOnly = false }: Props) {
  const [adjustmentList, setAdjustmentList] = useState<AdjustmentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEnterprise, setSelectedEnterprise] = useState("");
  const [enterpriseQuery, setEnterpriseQuery] = useState("");
  const [showEnterpriseDropdown, setShowEnterpriseDropdown] = useState(false);
  const enterpriseInputRef = useRef<HTMLDivElement>(null);
  const [itemType, setItemType] = useState("");
  const [scoreValue, setScoreValue] = useState(0);
  const [remark, setRemark] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadAdjustmentItems();
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

  const loadAdjustmentItems = async () => {
    const { data, error } = await supabase
      .from("adjustment_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAdjustmentList(data as AdjustmentItem[]);
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
    if (!selectedEnterprise || !itemType.trim() || scoreValue === 0 || !createdBy.trim()) {
      setErrorMsg("请填写完整信息，分值不能为 0");
      return;
    }

    setLoading(true);
    const enterprise = enterprises.find((e) => e.id === selectedEnterprise);

    const { error } = await supabase.from("adjustment_items").insert({
      enterprise_id: selectedEnterprise,
      enterprise_name: enterprise?.name || "",
      item_type: itemType,
      score_value: scoreValue,
      remark: remark,
      created_by: createdBy,
    });

    setLoading(false);

    if (error) {
      setErrorMsg("添加失败：" + error.message);
      return;
    }

    setShowAddModal(false);
    setSelectedEnterprise("");
    setEnterpriseQuery("");
    setItemType("");
    setScoreValue(0);
    setRemark("");
    setCreatedBy("");
    loadAdjustmentItems();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定要删除该加减分记录吗？")) return;

    const { error } = await supabase
      .from("adjustment_items")
      .delete()
      .eq("id", id);

    if (error) {
      setErrorMsg("删除失败：" + error.message);
      return;
    }

    loadAdjustmentItems();
  };

  const filteredList = adjustmentList.filter((item) =>
    item.enterprise_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const adjustmentTypes = [
    { value: "环保处罚扣分", label: "环保处罚扣分", type: "deduct" },
    { value: "安全事故扣分", label: "安全事故扣分", type: "deduct" },
    { value: "税务违规扣分", label: "税务违规扣分", type: "deduct" },
    { value: "创新平台加分", label: "创新平台加分", type: "add" },
    { value: "科技成果加分", label: "科技成果加分", type: "add" },
    { value: "荣誉奖项加分", label: "荣誉奖项加分", type: "add" },
    { value: "其他加分项", label: "其他加分项", type: "add" },
    { value: "其他扣分项", label: "其他扣分项", type: "deduct" },
  ];

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
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer"
          >
            <i className="ri-add-line"></i>
            新增加减分项
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-4">
        <i className="ri-information-line"></i> 加减分项将在综合评价计算时自动计入，所有操作留痕可追溯
      </p>

      {errorMsg && !showAddModal && (
        <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <i className="ri-error-warning-line"></i>{errorMsg}
        </div>
      )}

      {filteredList.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <i className="ri-edit-line text-4xl mb-2"></i>
          <p className="text-sm">暂无加减分记录</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">企业名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">项目类型</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600">分值</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">备注</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">录入人</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">录入时间</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800">{item.enterprise_name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        item.score_value > 0
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {item.score_value > 0 ? (
                        <i className="ri-add-circle-fill"></i>
                      ) : (
                        <i className="ri-indeterminate-circle-fill"></i>
                      )}
                      {item.item_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${item.score_value > 0 ? "text-green-600" : "text-red-600"}`}>
                      {item.score_value > 0 ? "+" : ""}{item.score_value}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.remark || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.created_by}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(item.created_at).toLocaleString("zh-CN")}
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
              <h3 className="text-lg font-semibold text-gray-800">新增加减分项</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {errorMsg && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  <i className="ri-error-warning-line"></i>{errorMsg}
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
                  项目类型 <span className="text-red-500">*</span>
                </label>
                <select
                  value={itemType}
                  onChange={(e) => {
                    setItemType(e.target.value);
                    const selected = adjustmentTypes.find((t) => t.value === e.target.value);
                    if (selected && scoreValue === 0) {
                      setScoreValue(selected.type === "add" ? 5 : -5);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">请选择项目类型</option>
                  <optgroup label="加分项">
                    {adjustmentTypes.filter((t) => t.type === "add").map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="扣分项">
                    {adjustmentTypes.filter((t) => t.type === "deduct").map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  分值 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={scoreValue}
                  onChange={(e) => setScoreValue(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="正数为加分，负数为扣分"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {scoreValue > 0 ? "✅ 加分" : scoreValue < 0 ? "🔻 扣分" : "请输入非零分值"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">备注</label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="请输入备注信息（选填，最多500字）"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  录入人 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="请输入录入人姓名"
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">
                  <i className="ri-alert-line"></i> 加减分项将在综合评价计算时自动计入，操作留痕可追溯
                </p>
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
