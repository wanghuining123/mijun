import { useState } from 'react';
import { useDictionaryFields } from '../../../hooks/useDictionaryFields';
import { useDictionaryItems } from '../../../hooks/useDictionaryItems';
import DictionaryItemEditModal from './DictionaryItemEditModal';

const PAGE_SIZE = 10;

interface DictionaryItemTabProps {
  readOnly?: boolean;
}

export default function DictionaryItemTab({ readOnly = false }: DictionaryItemTabProps) {
  const { fields, loading: fieldsLoading } = useDictionaryFields();
  const dropdownFields = fields.filter((f) => f.input_type === 'dropdown');

  const [selectedFieldCode, setSelectedFieldCode] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editMode, setEditMode] = useState<'add' | 'edit'>('add');
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false, message: '', type: 'success',
  });

  const effectiveCode = selectedFieldCode || dropdownFields[0]?.code || '';
  const currentField = dropdownFields.find((f) => f.code === effectiveCode);

  const { items, loading: itemsLoading, addItem, updateItem, deleteItem, moveUp, moveDown } =
    useDictionaryItems(effectiveCode);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 2500);
  };

  const handleFieldChange = (code: string) => {
    setSelectedFieldCode(code);
    setCurrentPage(1);
  };

  const handleAddItem = () => {
    setEditMode('add');
    setSelectedItem(null);
    setShowEditModal(true);
  };

  const handleEditItem = (item: any) => {
    setEditMode('edit');
    setSelectedItem(item);
    setShowEditModal(true);
  };

  const handleMoveUp = async (item: any) => {
    const result = await moveUp(item.id);
    if (!result.success) showToast('排序失败，请重试', 'error');
  };

  const handleMoveDown = async (item: any) => {
    const result = await moveDown(item.id);
    if (!result.success) showToast('排序失败，请重试', 'error');
  };

  const handleDeleteItem = async (item: any) => {
    if (!window.confirm('确认删除该字典项吗？')) return;
    const result = await deleteItem(item.id);
    if (result.success) {
      showToast('删除成功', 'success');
    } else {
      showToast('删除失败，请重试', 'error');
    }
  };

  const handleSave = async (data: { name: string }) => {
    if (editMode === 'add') {
      const result = await addItem(effectiveCode, data.name);
      if (result.success) {
        showToast('新增成功', 'success');
        setShowEditModal(false);
      } else {
        showToast(result.error || '新增失败', 'error');
      }
    } else {
      const result = await updateItem(selectedItem.id, data.name);
      if (result.success) {
        showToast('保存成功', 'success');
        setShowEditModal(false);
      } else {
        showToast(result.error || '保存失败', 'error');
      }
    }
  };

  if (fieldsLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500">加载字段配置中...</p>
      </div>
    );
  }

  return (
    <div>
      {/* 字段选择器 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <i className="ri-information-line text-amber-600 text-base mt-0.5"></i>
          <p className="text-sm text-amber-800">
            此处仅展示「字段配置管理」中输入类型为<strong>下拉单选</strong>的字段。在此配置的字典项将直接同步至企业填报表单的下拉选项。
          </p>
        </div>
        <label className="block text-sm font-medium text-gray-700 mb-2">选择字段</label>
        {dropdownFields.length === 0 ? (
          <p className="text-sm text-gray-400">暂无下拉类型字段，请先在「字段配置管理」中新增下拉字段</p>
        ) : (
          <select
            value={effectiveCode}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {dropdownFields.map((field) => (
              <option key={field.code} value={field.code}>
                {field.name}（{field.code}）
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 字典项列表 */}
      {dropdownFields.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              {currentField?.name ?? '请选择字段'} — 字典项列表
              <span className="ml-2 text-sm font-normal text-gray-400">共 {items.length} 项</span>
            </h3>
            {!readOnly && (
              <button
                onClick={handleAddItem}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer"
              >
                <i className="ri-add-line text-base"></i>
                新增字典项
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            {itemsLoading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-3"></div>
                <p className="text-sm text-gray-400">加载中...</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap w-16">排序</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">字典名称</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pagedItems.map((item, index) => {
                    const realIndex = (safePage - 1) * PAGE_SIZE + index;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-500">{realIndex + 1}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{item.name}</td>
                        <td className="px-6 py-4">
                          {readOnly ? (
                            <span className="text-xs text-gray-300">—</span>
                          ) : (
                            <div className="flex items-center gap-3">
                              <button onClick={() => handleEditItem(item)} className="text-blue-600 hover:text-blue-700 text-sm whitespace-nowrap cursor-pointer">编辑</button>
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={() => handleMoveUp(item)}
                                disabled={realIndex === 0}
                                className={`text-sm whitespace-nowrap ${realIndex === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-gray-700 cursor-pointer'}`}
                              >上移</button>
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={() => handleMoveDown(item)}
                                disabled={realIndex === items.length - 1}
                                className={`text-sm whitespace-nowrap ${realIndex === items.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-gray-700 cursor-pointer'}`}
                              >下移</button>
                              <span className="text-gray-300">|</span>
                              <button onClick={() => handleDeleteItem(item)} className="text-red-600 hover:text-red-700 text-sm whitespace-nowrap cursor-pointer">删除</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {pagedItems.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-gray-400">
                        <i className="ri-inbox-line text-3xl block mb-2"></i>
                        暂无字典项，点击「新增字典项」添加
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* 翻页器 */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              共 <span className="font-medium text-gray-700">{items.length}</span> 条记录，第{' '}
              <span className="font-medium text-gray-700">{safePage}</span> /{' '}
              <span className="font-medium text-gray-700">{totalPages}</span> 页
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(1)} disabled={safePage === 1}
                className="px-2 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer">
                <i className="ri-skip-back-line"></i>
              </button>
              <button onClick={() => setCurrentPage(Math.max(1, safePage - 1))} disabled={safePage === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer">
                上一页
              </button>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let start = 1;
                if (totalPages > 5) {
                  if (safePage <= 3) start = 1;
                  else if (safePage >= totalPages - 2) start = totalPages - 4;
                  else start = safePage - 2;
                }
                const pageNum = start + i;
                return (
                  <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-md text-sm whitespace-nowrap cursor-pointer transition-colors ${safePage === pageNum ? 'bg-emerald-600 text-white border border-emerald-600' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    {pageNum}
                  </button>
                );
              })}
              <button onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer">
                下一页
              </button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={safePage >= totalPages}
                className="px-2 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer">
                <i className="ri-skip-forward-line"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <DictionaryItemEditModal
          mode={editMode}
          item={selectedItem}
          onClose={() => setShowEditModal(false)}
          onSave={handleSave}
        />
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 text-white text-sm ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            <i className={toast.type === 'success' ? 'ri-checkbox-circle-line text-lg' : 'ri-error-warning-line text-lg'}></i>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
