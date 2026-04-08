import { useState } from 'react';

interface TemplateSaveModalProps {
  onClose: () => void;
  onSave: (templateName: string) => void;
}

export default function TemplateSaveModal({ onClose, onSave }: TemplateSaveModalProps) {
  const [templateName, setTemplateName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      alert('请输入模板名称');
      return;
    }
    onSave(templateName.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">保存为模板</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              模板名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="例如：2024年度标准模板"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2">
              将当前所有指标配置保存为模板，方便后续快速切换使用
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 whitespace-nowrap"
            >
              保存模板
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}