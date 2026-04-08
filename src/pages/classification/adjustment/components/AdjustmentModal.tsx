import { useState, useEffect } from "react";

interface YearData {
  year: number;
  comprehensive_score: number | null;
  classification_grade: string | null;
  record_id: string | null;
}

interface EnterpriseRecord {
  id: string;
  enterprise_id: string;
  enterprise_name: string;
  industry: string;
  comprehensive_score: number;
  classification_grade: string;
  year: number;
  is_continuous_d: boolean;
}

interface AdjustmentModalProps {
  record: EnterpriseRecord;
  availableYearData?: Record<number, YearData>; // 该企业所有年份数据
  onClose: () => void;
  onSave: (adjustedGrade: string, reason: string, adjustedBy: string, year: number, recordId: string) => void;
}

export default function AdjustmentModal({
  record,
  availableYearData = {},
  onClose,
  onSave,
}: AdjustmentModalProps) {
  // 可选年份：有 record_id 的年份才能调整
  const selectableYears = Object.values(availableYearData)
    .filter((yd) => yd.record_id !== null)
    .map((yd) => yd.year)
    .sort((a, b) => b - a);

  const [selectedYear, setSelectedYear] = useState<number>(record.year);
  const [currentScore, setCurrentScore] = useState<number>(record.comprehensive_score);
  const [currentGrade, setCurrentGrade] = useState<string>(record.classification_grade);
  const [currentRecordId, setCurrentRecordId] = useState<string>(record.id);

  const [adjustedGrade, setAdjustedGrade] = useState<string>(record.classification_grade);
  const [reason, setReason] = useState<string>("");
  const [adjustedBy, setAdjustedBy] = useState<string>("");
  const [error, setError] = useState<string>("");

  // 切换年份时更新对应数据
  useEffect(() => {
    const yd = availableYearData[selectedYear];
    if (yd && yd.record_id) {
      setCurrentScore(yd.comprehensive_score ?? 0);
      setCurrentGrade(yd.classification_grade ?? "");
      setCurrentRecordId(yd.record_id);
      setAdjustedGrade(yd.classification_grade ?? "");
      setError("");
    }
  }, [selectedYear, availableYearData]);

  const grades = [
    { value: "A", label: "A类", color: "text-green-700", bg: "bg-green-50 border-green-400" },
    { value: "B", label: "B类", color: "text-cyan-700", bg: "bg-cyan-50 border-cyan-400" },
    { value: "C", label: "C类", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-400" },
    { value: "D", label: "D类", color: "text-red-700", bg: "bg-red-50 border-red-400" },
  ];

  const getGradeBadgeClass = (grade: string) => {
    switch (grade) {
      case "A": return "bg-green-100 text-green-700 border-green-200";
      case "B": return "bg-cyan-100 text-cyan-700 border-cyan-200";
      case "C": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "D": return "bg-red-100 text-red-700 border-red-200";
      default:  return "bg-gray-100 text-gray-500 border-gray-200";
    }
  };

  const handleSubmit = () => {
    setError("");

    if (adjustedGrade === currentGrade) {
      setError("调整后的等级与原等级相同，无需调整");
      return;
    }

    if (!reason.trim()) {
      setError("请填写审批原因");
      return;
    }

    if (reason.trim().length < 10) {
      setError("审批原因至少需要10个字符");
      return;
    }

    if (!adjustedBy.trim()) {
      setError("请填写审批人");
      return;
    }

    onSave(adjustedGrade, reason.trim(), adjustedBy.trim(), selectedYear, currentRecordId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">调整企业分类</h2>
            <p className="text-sm text-gray-500 mt-1">手动调整企业分类等级，需填写审批原因</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* 内容区 */}
        <div className="px-6 py-4 space-y-4">
          {/* 企业信息 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">企业名称：</span>
              <span className="text-sm font-medium text-gray-800">{record.enterprise_name}</span>
              {record.is_continuous_d && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-50 text-red-600 text-xs rounded border border-red-200 whitespace-nowrap">
                  <i className="ri-alert-line text-xs"></i>重点监管
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">所属行业：</span>
              <span className="text-sm text-gray-700">{record.industry}</span>
            </div>
          </div>

          {/* 年份选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              调整年份 <span className="text-red-500">*</span>
            </label>
            {selectableYears.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectableYears.map((year) => {
                  const yd = availableYearData[year];
                  const grade = yd?.classification_grade;
                  const isSelected = selectedYear === year;
                  return (
                    <button
                      key={year}
                      onClick={() => setSelectedYear(year)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? "border-gray-800 bg-gray-800 text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      <span>{year}年</span>
                      {grade && (
                        <span className={`px-1.5 py-0.5 text-xs rounded border ${
                          isSelected
                            ? "bg-white/20 text-white border-white/30"
                            : getGradeBadgeClass(grade)
                        }`}>
                          {grade}类
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-400 py-2">暂无可调整的年份数据</div>
            )}
          </div>

          {/* 当前年份信息 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">综合得分（{selectedYear}年）</div>
              <div className="text-lg font-semibold text-gray-800">
                {currentScore > 0 ? currentScore.toFixed(2) : "—"}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">当前等级（{selectedYear}年）</div>
              <div className="flex items-center gap-2 mt-0.5">
                {currentGrade ? (
                  <span className={`inline-flex items-center px-2.5 py-0.5 text-sm font-semibold rounded border ${getGradeBadgeClass(currentGrade)}`}>
                    {currentGrade}类
                  </span>
                ) : (
                  <span className="text-gray-400 text-sm">—</span>
                )}
              </div>
            </div>
          </div>

          {/* 调整后等级 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              调整后等级 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-3">
              {grades.map((grade) => (
                <button
                  key={grade.value}
                  onClick={() => setAdjustedGrade(grade.value)}
                  className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all cursor-pointer ${
                    adjustedGrade === grade.value
                      ? `${grade.bg} border-current`
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className={adjustedGrade === grade.value ? grade.color : ""}>{grade.label}</div>
                </button>
              ))}
            </div>
            {currentGrade && adjustedGrade && adjustedGrade !== currentGrade && (
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                <span className={`px-2 py-0.5 rounded border text-xs font-medium ${getGradeBadgeClass(currentGrade)}`}>{currentGrade}类</span>
                <i className="ri-arrow-right-line text-gray-400"></i>
                <span className={`px-2 py-0.5 rounded border text-xs font-medium ${getGradeBadgeClass(adjustedGrade)}`}>{adjustedGrade}类</span>
              </div>
            )}
          </div>

          {/* 审批原因 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              审批原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder="请详细说明调整原因，至少10个字符"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-500">至少需要10个字符</span>
              <span className="text-xs text-gray-500">{reason.length} / 500</span>
            </div>
          </div>

          {/* 审批人 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              审批人 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={adjustedBy}
              onChange={(e) => setAdjustedBy(e.target.value)}
              placeholder="请输入审批人姓名"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <i className="ri-error-warning-line text-red-600 text-base mt-0.5"></i>
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* 提示信息 */}
          <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <i className="ri-information-line text-gray-500 text-base mt-0.5"></i>
            <div className="text-sm text-gray-600">
              <p>调整后将自动同步至资源要素配置模块，更新该企业的政策匹配状态</p>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectableYears.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认调整
          </button>
        </div>
      </div>
    </div>
  );
}
