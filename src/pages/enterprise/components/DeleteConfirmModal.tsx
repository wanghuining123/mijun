interface Props {
  enterpriseName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function DeleteConfirmModal({ enterpriseName, onConfirm, onCancel, loading }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel}></div>

      {/* 弹窗内容 */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">确认删除</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <i className="ri-alert-line text-red-600 text-xl"></i>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-800 mb-2">
                您确定要删除企业「<span className="font-semibold">{enterpriseName}</span>」吗？
              </p>
              <p className="text-sm text-red-600 font-medium">
                删除后该企业所有年度数据将被清除，不可恢复！
              </p>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <i className="ri-loader-4-line animate-spin"></i>}
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
