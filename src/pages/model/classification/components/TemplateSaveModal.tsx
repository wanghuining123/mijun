import { useState } from 'react';

interface TemplateSaveModalProps {
  onClose: () => void;
  onSave: (templateName: string) => void;
}

export default function TemplateSaveModal({ onClose, onSave }: TemplateSaveModalProps) {
  const [templateName, setTemplateName] = useState('');

  const handleSubmit = () => {
    if (!templateName.trim()) {
      alert('请输入模板名称');
      return;
    }
    onSave(templateName.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">保存为模板</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="px-6 py-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            模板名称
          </label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="如：2024年度标准、高新区专用等"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            autoFocus
          />
          <p className="text-xs text-gray-500 mt-2">
            将保存当前所有行业的分类规则配置
          </p>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 whitespace-nowrap"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}