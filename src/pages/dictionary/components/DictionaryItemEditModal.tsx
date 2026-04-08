import { useState, useEffect } from 'react';

interface DictionaryItemEditModalProps {
  mode: 'add' | 'edit';
  item: any;
  onClose: () => void;
  onSave: (data: any) => void;
}

export default function DictionaryItemEditModal({
  mode,
  item,
  onClose,
  onSave,
}: DictionaryItemEditModalProps) {
  const [formData, setFormData] = useState({ name: '' });

  useEffect(() => {
    if (item) {
      setFormData({ name: item.name ?? '' });
    } else {
      setFormData({ name: '' });
    }
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    try {
      onSave(formData);
    } catch (err) {
      console.error('Error while saving dictionary item:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {mode === 'add' ? '新增字典项' : '编辑字典项'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-5">
            {/* 字典编码 — 系统自动生成提示 */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <i className="ri-magic-line text-gray-400 text-base"></i>
              <p className="text-sm text-gray-500">字典编码将由系统自动生成，无需手动填写</p>
            </div>

            {/* 字典名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                字典名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="请输入字典名称"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              确认保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
