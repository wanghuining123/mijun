interface AdjustmentHistory {
  id: string;
  year: number;
  original_grade: string;
  adjusted_grade: string;
  reason: string;
  adjusted_by: string;
  adjusted_at: string;
}

interface AdjustmentHistoryModalProps {
  enterpriseName: string;
  history: AdjustmentHistory[];
  onClose: () => void;
}

export default function AdjustmentHistoryModal({
  enterpriseName,
  history,
  onClose,
}: AdjustmentHistoryModalProps) {
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A":
        return "text-green-700";
      case "B":
        return "text-cyan-700";
      case "C":
        return "text-yellow-700";
      case "D":
        return "text-red-700";
      default:
        return "text-gray-700";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">调整记录</h2>
            <p className="text-sm text-gray-500 mt-1">{enterpriseName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* 内容区 */}
        <div className="px-6 py-4">
          {history.length === 0 ? (
            <div className="text-center py-12">
              <i className="ri-history-line text-5xl text-gray-300"></i>
              <p className="text-gray-500 mt-4">暂无调整记录</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((record, index) => (
                <div
                  key={record.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  {/* 调整信息头部 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-600">
                        {record.year}年度
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <i className="ri-time-line"></i>
                      {formatDate(record.adjusted_at)}
                    </div>
                  </div>

                  {/* 等级变更 */}
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className={`text-base font-semibold ${getGradeColor(
                        record.original_grade
                      )}`}
                    >
                      {record.original_grade}类
                    </span>
                    <i className="ri-arrow-right-line text-gray-400"></i>
                    <span
                      className={`text-base font-semibold ${getGradeColor(
                        record.adjusted_grade
                      )}`}
                    >
                      {record.adjusted_grade}类
                    </span>
                  </div>

                  {/* 审批原因 */}
                  <div className="bg-white rounded p-3 border border-gray-200">
                    <div className="flex items-start gap-2 mb-2">
                      <i className="ri-file-text-line text-gray-400 text-sm mt-0.5"></i>
                      <span className="text-xs font-medium text-gray-600">
                        审批原因
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed pl-5">
                      {record.reason}
                    </p>
                  </div>

                  {/* 审批人 */}
                  <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
                    <i className="ri-user-line"></i>
                    <span>审批人：</span>
                    <span className="font-medium text-gray-800">
                      {record.adjusted_by}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}