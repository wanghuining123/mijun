interface DeleteConfirmModalProps {
  policyName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({ policyName, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* 弹窗头部 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <i className="ri-error-warning-line text-xl text-red-600"></i>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">确认删除</h2>
          </div>
        </div>

        {/* 弹窗内容 */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600">
            确定要删除政策「<span className="font-medium text-gray-900">{policyName}</span>」吗？
          </p>
          <p className="text-sm text-gray-500 mt-2">
            删除后将无法恢复，请谨慎操作。
          </p>
        </div>

        {/* 弹窗底部 */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            <i className="ri-delete-bin-line mr-2"></i>
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}