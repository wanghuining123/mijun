import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import ExemptEnterpriseTab from "./components/ExemptEnterpriseTab";
import ProtectionPeriodTab from "./components/ProtectionPeriodTab";
import AdjustmentItemsTab from "./components/AdjustmentItemsTab";
import { useAuth } from "../../../contexts/AuthContext";

type TabType = "exempt" | "protection" | "adjustment";

export default function SpecialCasesPage() {
  const [activeTab, setActiveTab] = useState<TabType>("exempt");
  const [enterprises, setEnterprises] = useState<Array<{ id: string; name: string }>>([]);
  const { canEdit } = useAuth();
  const hasEditPermission = canEdit('evaluation_special');

  useEffect(() => {
    loadEnterprises();
  }, []);

  const loadEnterprises = async () => {
    const { data, error } = await supabase
      .from("enterprises")
      .select("id, name")
      .order("name");

    if (!error && data) {
      setEnterprises(data);
    }
  };

  const tabs = [
    { id: "exempt" as TabType, label: "免评企业", icon: "ri-shield-cross-line" },
    { id: "protection" as TabType, label: "保护期企业", icon: "ri-shield-check-line" },
    { id: "adjustment" as TabType, label: "加减分项", icon: "ri-edit-line" },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">特殊情形处理</h1>
        <p className="text-sm text-gray-500 mt-1">
          管理免评企业、保护期企业和加减分项，确保评价结果的准确性和公平性
        </p>
      </div>

      {/* Tab 切换 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex gap-1 px-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-800"
                }`}
              >
                <i className={`${tab.icon} text-base`}></i>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 内容 */}
        <div className="p-6">
          {activeTab === "exempt" && <ExemptEnterpriseTab enterprises={enterprises} readOnly={!hasEditPermission} />}
          {activeTab === "protection" && <ProtectionPeriodTab enterprises={enterprises} readOnly={!hasEditPermission} />}
          {activeTab === "adjustment" && <AdjustmentItemsTab enterprises={enterprises} readOnly={!hasEditPermission} />}
        </div>
      </div>
    </div>
  );
}