
import { useState, useEffect } from "react";
import { supabase } from "../../../../lib/supabase";

interface OperationRecord {
  id: string;
  operation_type: "push" | "export_pdf";
  operation_year: number;
  template_name: string;
  rule_name: string;
  enterprise_count: number;
  created_at: string;
}

interface OperationHistoryModalProps {
  year: number;
  onClose: () => void;
}

export default function OperationHistoryModal({
  year,
  onClose,
}: OperationHistoryModalProps) {
  const [records, setRecords] = useState<OperationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  /** Load operation records for the given year */
  const loadRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("operation_audit_logs")
        .select("*")
        .eq("operation_year", year)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecords((data as OperationRecord[]) ?? []);
    } catch (err) {
      console.error("加载操作记录失败:", err);
    } finally {
      setLoading(false);
    }
  };

  /** Convert operation type to a UI config object */
  const getOperationTypeLabel = (type: string) => {
    const config = {
      push: {
        label: "推送名单",
        icon: "ri-send-plane-line",
        color: "text-teal-600",
        bg: "bg-teal-50",
        border: "border-teal-200",
      },
      export_pdf: {
        label: "导出PDF",
        icon: "ri-file-pdf-line",
        color: "text-purple-600",
        bg: "bg-purple-50",
        border: "border-purple-200",
      },
    };
    return (
      (config as Record<string, typeof config[keyof typeof config]>)[type] || {
        label: type,
        icon: "ri-file-line",
        color: "text-gray-600",
        bg: "bg-gray-50",
        border: "border-gray-200",
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col"
        style={{ width: 900, maxHeight: "85vh" }}
      >
        {/* 弹窗顶栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <i className="ri-history-line text-lg text-teal-600"></i>
            <span className="font-semibold text-gray-800">操作记录</span>
            <span className="text-sm text-gray-400 ml-1">— {year} 年度</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <i className="ri-loader-4-line text-3xl text-teal-600 animate-spin"></i>
                <p className="text-sm text-gray-500 mt-2">加载中...</p>
              </div>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <i className="ri-file-list-3-line text-5xl text-gray-300"></i>
              <p className="text-gray-500 mt-4">暂无操作记录</p>
              <p className="text-sm text-gray-400 mt-2">
                {year} 年度尚未进行推送或导出操作
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record, index) => {
                const typeConfig = getOperationTypeLabel(record.operation_type);
                return (
                  <div
                    key={record.id}
                    className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                  >
                    {/* 序号和图标 */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                      <div
                        className={`w-10 h-10 flex items-center justify-center rounded-lg ${typeConfig.bg} ${typeConfig.border} border`}
                      >
                        <i className={`${typeConfig.icon} text-lg ${typeConfig.color}`}></i>
                      </div>
                      <span className="text-xs text-gray-400">
                        #{records.length - index}
                      </span>
                    </div>

                    {/* 操作信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-medium ${typeConfig.bg} ${typeConfig.color} border ${typeConfig.border} whitespace-nowrap`}
                        >
                          {typeConfig.label}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(record.created_at).toLocaleString("zh-CN", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {/* 模板 */}
                        <div className="flex items-center gap-2">
                          <i className="ri-file-list-3-line text-sm text-gray-400"></i>
                          <div className="min-w-0">
                            <p className="text-xs text-gray-400">指标模板</p>
                            <p
                              className="text-sm text-gray-700 font-medium truncate"
                              title={record.template_name}
                            >
                              {record.template_name}
                            </p>
                          </div>
                        </div>

                        {/* 规则 */}
                        <div className="flex items-center gap-2">
                          <i className="ri-settings-3-line text-sm text-gray-400"></i>
                          <div className="min-w-0">
                            <p className="text-xs text-gray-400">分类规则</p>
                            <p
                              className="text-sm text-gray-700 font-medium truncate"
                              title={record.rule_name}
                            >
                              {record.rule_name}
                            </p>
                          </div>
                        </div>

                        {/* 企业数量 */}
                        <div className="flex items-center gap-2">
                          <i className="ri-building-line text-sm text-gray-400"></i>
                          <div className="min-w-0">
                            <p className="text-xs text-gray-400">企业数量</p>
                            <p className="text-sm text-gray-700 font-medium">
                              {record.enterprise_count} 家
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部统计 */}
        {!loading && records.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>
                共{" "}
                <span className="font-medium text-gray-800">
                  {records.length}
                </span>{" "}
                条操作记录
              </span>
              <span className="text-gray-300">|</span>
              <span>
                推送{" "}
                <span className="font-medium text-teal-600">
                  {records.filter((r) => r.operation_type === "push").length}
                </span>{" "}
                次
              </span>
              <span className="text-gray-300">|</span>
              <span>
                导出{" "}
                <span className="font-medium text-purple-600">
                  {records.filter(
                    (r) => r.operation_type === "export_pdf"
                  ).length}
                </span>{" "}
                次
              </span>
            </div>
            <button
              onClick={loadRecords}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line"></i>
              刷新
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
