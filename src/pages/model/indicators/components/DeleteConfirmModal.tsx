interface DeleteConfirmModalProps {
  indicatorName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({ indicatorName, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <i className="ri-error-warning-line text-2xl text-red-600"></i>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 text-center mt-4">确认删除指标</h3>
          <p className="text-sm text-gray-600 text-center mt-2">
            确定要删除指标「<span className="font-medium text-gray-900">{indicatorName}</span>」吗？
          </p>
          <p className="text-xs text-gray-500 text-center mt-1">
            删除后该指标将不再参与企业评价计算
          </p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 whitespace-nowrap"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}