import { useState, useEffect, useCallback } from 'react';
import { useDictionaryFields } from '../../../hooks/useDictionaryFields';
import FieldEditModal from './FieldEditModal';
import FieldChangeHistoryModal from './FieldChangeHistoryModal';
import { PendingChange } from '../../../hooks/useDictionaryVersions';
import { supabase } from '../../../lib/supabase';

interface FieldConfigTabProps {
  onPendingChangesUpdate: (changes: PendingChange[]) => void;
  readOnly?: boolean;
}

// 检查字段是否在企业数据中已被使用（有实际填报数据）
async function checkFieldInUse(fieldCode: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('enterprise_year_records')
      .select(fieldCode)
      .not(fieldCode, 'is', null)
      .limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

// 检查字段是否被指标体系的计算公式引用
async function checkFieldInFormula(fieldName: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('evaluation_indicators')
      .select('indicator_name, formula')
      .eq('is_enabled', true);
    if (error || !data) return [];
    const matched = data.filter(
      (ind) => ind.formula && ind.formula.includes(`{${fieldName}}`)
    );
    // 去重：同名指标只显示一次
    const uniqueNames = Array.from(new Set(matched.map((ind) => ind.indicator_name)));
    return uniqueNames;
  } catch {
    return [];
  }
}

// 批量获取所有被引用字段名 -> 引用它的指标列表
async function fetchAllFormulaReferences(): Promise<Record<string, string[]>> {
  try {
    const { data, error } = await supabase
      .from('evaluation_indicators')
      .select('indicator_name, formula')
      .eq('is_enabled', true);
    if (error || !data) return {};

    const refMap: Record<string, string[]> = {};
    data.forEach((ind) => {
      if (!ind.formula) return;
      const matches = ind.formula.match(/\{([^}]+)\}/g);
      if (!matches) return;
      matches.forEach((m: string) => {
        const fieldName = m.slice(1, -1);
        if (!refMap[fieldName]) refMap[fieldName] = [];
        // 去重：同名指标只记录一次
        if (!refMap[fieldName].includes(ind.indicator_name)) {
          refMap[fieldName].push(ind.indicator_name);
        }
      });
    });
    return refMap;
  } catch {
    return {};
  }
}

export default function FieldConfigTab({ onPendingChangesUpdate, readOnly = false }: FieldConfigTabProps) {
  const { fields, loading, refetch, deleteField } = useDictionaryFields();
  const [editingField, setEditingField] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [historyField, setHistoryField] = useState<any>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  // 字段被引用映射：fieldName -> 引用它的指标名称列表
  const [formulaRefMap, setFormulaRefMap] = useState<Record<string, string[]>>({});
  const [refMapLoading, setRefMapLoading] = useState(false);
  // 字段使用中提示弹窗
  const [inUseAlert, setInUseAlert] = useState<{
    show: boolean;
    fieldName: string;
    action: string;
    reason: 'data' | 'formula';
    formulaIndicators: string[];
  }>({ show: false, fieldName: '', action: '', reason: 'data', formulaIndicators: [] });
  // 正在检查中的字段 id
  const [checkingFieldId, setCheckingFieldId] = useState<string | null>(null);

  useEffect(() => {
    refetch();
  }, []);

  // 字段加载完成后，批量拉取公式引用关系
  useEffect(() => {
    if (!loading && fields.length > 0) {
      setRefMapLoading(true);
      fetchAllFormulaReferences().then((map) => {
        setFormulaRefMap(map);
        setRefMapLoading(false);
      });
    }
  }, [loading, fields.length]);

  useEffect(() => {
    onPendingChangesUpdate(pendingChanges);
  }, [pendingChanges, onPendingChangesUpdate]);

  const handleAddField = () => {
    setEditingField(null);
    setIsEditModalOpen(true);
  };

  const handleEditField = (field: any) => {
    setEditingField(field);
    setIsEditModalOpen(true);
  };

  const handleSaveField = (fieldData: any, isNew: boolean) => {
    if (isNew) {
      const newChange: PendingChange = {
        operation: 'add',
        after_snapshot: fieldData
      };
      setPendingChanges([...pendingChanges, newChange]);
    } else {
      const existingField = fields.find(f => f.id === editingField.id);
      const newChange: PendingChange = {
        field_id: editingField.id,
        operation: 'update',
        before_snapshot: existingField,
        after_snapshot: { ...fieldData, id: editingField.id }
      };
      const existingChangeIndex = pendingChanges.findIndex(
        c => c.field_id === editingField.id
      );
      if (existingChangeIndex >= 0) {
        const updated = [...pendingChanges];
        updated[existingChangeIndex] = newChange;
        setPendingChanges(updated);
      } else {
        setPendingChanges([...pendingChanges, newChange]);
      }
    }
    setIsEditModalOpen(false);
    setEditingField(null);
  };

  const handleDeleteField = useCallback(async (field: any) => {
    setCheckingFieldId(field.id);
    try {
      const formulaIndicators = await checkFieldInFormula(field.name);
      if (formulaIndicators.length > 0) {
        setInUseAlert({ show: true, fieldName: field.name, action: '删除', reason: 'formula', formulaIndicators });
        return;
      }
      const inUse = await checkFieldInUse(field.code);
      if (inUse) {
        setInUseAlert({ show: true, fieldName: field.name, action: '删除', reason: 'data', formulaIndicators: [] });
        return;
      }
      if (window.confirm('确认删除该字段？删除后将无法恢复。')) {
        const newChange: PendingChange = {
          field_id: field.id,
          operation: 'delete',
          before_snapshot: field,
          after_snapshot: null
        };
        setPendingChanges(prev => [...prev, newChange]);
      }
    } finally {
      setCheckingFieldId(null);
    }
  }, [fields, pendingChanges]);

  const handleViewHistory = (field: any) => {
    setHistoryField(field);
    setIsHistoryModalOpen(true);
  };

  const hasPendingChange = (fieldId: string) =>
    pendingChanges.some(c => c.field_id === fieldId);

  const isMarkedForDeletion = (fieldId: string) =>
    pendingChanges.some(c => c.field_id === fieldId && c.operation === 'delete');

  const groupedFields = fields.reduce((acc, field) => {
    const category = field.category || field.group_name || '其他信息';
    if (!acc[category]) acc[category] = [];
    acc[category].push(field);
    return acc;
  }, {} as Record<string, any[]>);

  const clearPendingChanges = () => setPendingChanges([]);

  useEffect(() => {
    (window as any).__clearPendingChanges = clearPendingChanges;
    return () => { delete (window as any).__clearPendingChanges; };
  }, []);

  // 被引用字段数量统计
  const referencedCount = fields.filter(f => (formulaRefMap[f.name] || []).length > 0).length;

  return (
    <div className="space-y-6">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>共 {fields.length} 个字段</span>
          {!refMapLoading && referencedCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full text-xs font-medium border border-teal-200">
              <i className="ri-links-line text-xs"></i>
              {referencedCount} 个已被指标引用
            </span>
          )}
          {pendingChanges.length > 0 && (
            <span className="text-orange-600">
              （{pendingChanges.length} 个待发布变更）
            </span>
          )}
        </div>
        {!readOnly && (
          <button
            onClick={handleAddField}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <i className="ri-add-line"></i>
            新增字段
          </button>
        )}
      </div>

      {/* 字段列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : Object.keys(groupedFields).length === 0 ? (
        <div className="text-center py-12 text-gray-500">暂无字段配置</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedFields).map(([category, categoryFields]) => (
            <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">{category}</h3>
                {/* 分组内被引用字段数 */}
                {!refMapLoading && (() => {
                  const cnt = (categoryFields as any[]).filter(f => (formulaRefMap[f.name] || []).length > 0).length;
                  return cnt > 0 ? (
                    <span className="text-xs text-teal-600 flex items-center gap-1">
                      <i className="ri-links-line"></i>
                      {cnt} 个被引用
                    </span>
                  ) : null;
                })()}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">字段名称</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">字段类型</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">是否必填</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">提示语</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">版本</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">状态</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-gray-600 whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(categoryFields as any[]).map((field) => {
                      const isChecking = checkingFieldId === field.id;
                      const markedDelete = isMarkedForDeletion(field.id);
                      const refIndicators: string[] = formulaRefMap[field.name] || [];
                      const isReferenced = refIndicators.length > 0;
                      return (
                        <tr
                          key={field.id}
                          className={`hover:bg-gray-50 transition-colors ${markedDelete ? 'opacity-50 bg-red-50' : ''}`}
                        >
                          {/* 字段名称 + 被引用标记 */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-gray-900 font-medium">{field.name}</span>
                              {isReferenced && !refMapLoading && (
                                <span
                                  className="group relative inline-flex items-center gap-1 px-1.5 py-0.5 bg-teal-50 text-teal-700 text-xs rounded border border-teal-200 cursor-default whitespace-nowrap"
                                  title={`被引用于：${refIndicators.join('、')}`}
                                >
                                  <i className="ri-links-line text-xs"></i>
                                  被引用
                                  {/* Tooltip */}
                                  <span className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-20 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg min-w-max max-w-xs">
                                    <span className="block font-medium mb-1 text-teal-300">引用此字段的指标：</span>
                                    {refIndicators.map((name, i) => (
                                      <span key={i} className="block leading-5">· {name}</span>
                                    ))}
                                  </span>
                                </span>
                              )}
                              {refMapLoading && (
                                <span className="w-3 h-3 border-2 border-teal-400 border-t-transparent rounded-full animate-spin inline-block"></span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-600">
                            {field.type === 'text' || field.input_type === 'text'
                              ? '文本'
                              : field.type === 'number' || field.input_type === 'number'
                              ? '数字'
                              : field.type === 'date' || field.input_type === 'date'
                              ? '日期'
                              : field.type === 'select' || field.input_type === 'dropdown'
                              ? '下拉'
                              : field.type || field.input_type}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-600">
                            {field.required ? '是' : '否'}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-600">
                            {field.placeholder || '-'}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-600">
                            {field.current_version || '-'}
                          </td>
                          <td className="px-5 py-4">
                            {markedDelete ? (
                              <span className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded whitespace-nowrap">
                                待删除
                              </span>
                            ) : hasPendingChange(field.id) ? (
                              <span className="px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded whitespace-nowrap">
                                待发布
                              </span>
                            ) : field.status === 'disabled' ? (
                              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded whitespace-nowrap">
                                已禁用
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded whitespace-nowrap">
                                已启用
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!markedDelete && (
                                <>
                                  <button
                                    onClick={() => handleViewHistory(field)}
                                    className="text-gray-600 hover:text-blue-600 transition-colors cursor-pointer"
                                    title="变更历史"
                                  >
                                    <i className="ri-history-line text-base"></i>
                                  </button>
                                  {!readOnly && (
                                    <>
                                      <button
                                        onClick={() => handleEditField(field)}
                                        className="text-gray-600 hover:text-blue-600 transition-colors cursor-pointer"
                                        title="编辑"
                                      >
                                        <i className="ri-edit-line text-base"></i>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteField(field)}
                                        disabled={isChecking}
                                        className="text-gray-600 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        title={isReferenced ? '该字段已被指标公式引用，不可删除' : '删除'}
                                      >
                                        {isChecking
                                          ? <i className="ri-loader-4-line text-base animate-spin"></i>
                                          : <i className="ri-delete-bin-line text-base"></i>
                                        }
                                      </button>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 待新增字段区域 */}
      {pendingChanges.filter(c => c.operation === 'add').length > 0 && (
        <div className="border border-orange-200 rounded-lg overflow-hidden bg-orange-50">
          <div className="bg-orange-100 px-5 py-3 border-b border-orange-200">
            <h3 className="text-sm font-semibold text-orange-900 flex items-center gap-2">
              <i className="ri-add-circle-line"></i>
              待新增字段
            </h3>
          </div>
          <div className="p-5 space-y-3">
            {pendingChanges
              .filter(c => c.operation === 'add')
              .map((change, index) => (
                <div key={index} className="p-4 bg-white rounded-lg border border-orange-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          {change.after_snapshot.name}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded whitespace-nowrap">
                          {change.after_snapshot.type === 'text' || change.after_snapshot.input_type === 'text'
                            ? '文本'
                            : change.after_snapshot.type === 'number' || change.after_snapshot.input_type === 'number'
                            ? '数字'
                            : change.after_snapshot.type === 'date' || change.after_snapshot.input_type === 'date'
                            ? '日期'
                            : change.after_snapshot.type === 'select' || change.after_snapshot.input_type === 'dropdown'
                            ? '下拉'
                            : change.after_snapshot.type || change.after_snapshot.input_type}
                        </span>
                        {change.after_snapshot.required && (
                          <span className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded whitespace-nowrap">
                            必填
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        分类：{change.after_snapshot.category || change.after_snapshot.group_name}
                      </p>
                      {change.after_snapshot.placeholder && (
                        <p className="text-sm text-gray-600 mt-1">
                          提示语：{change.after_snapshot.placeholder}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setPendingChanges(pendingChanges.filter((_, i) => i !== index))}
                      className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="取消新增"
                    >
                      <i className="ri-close-line text-lg"></i>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {isEditModalOpen && (
        <FieldEditModal
          field={editingField}
          onClose={() => { setIsEditModalOpen(false); setEditingField(null); }}
          onSave={handleSaveField}
        />
      )}

      {/* 变更历史弹窗 */}
      {isHistoryModalOpen && historyField && (
        <FieldChangeHistoryModal
          field={historyField}
          onClose={() => { setIsHistoryModalOpen(false); setHistoryField(null); }}
        />
      )}

      {/* 字段使用中提示弹窗 */}
      {inUseAlert.show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-amber-100">
                <i className="ri-error-warning-line text-xl text-amber-600"></i>
              </div>
              <h3 className="text-base font-semibold text-gray-800">无法{inUseAlert.action}</h3>
            </div>
            {inUseAlert.reason === 'formula' ? (
              <>
                <p className="text-sm text-gray-600 leading-relaxed mb-2">
                  字段「<span className="font-medium text-gray-900">{inUseAlert.fieldName}</span>」已被以下指标的计算公式引用：
                </p>
                <ul className="mb-4 space-y-1">
                  {inUseAlert.formulaIndicators.map((name, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <i className="ri-function-line text-teal-500 flex-shrink-0"></i>
                      <span>{name}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                  请先前往「指标体系管理」修改或删除引用该字段的指标，再回来删除此字段。
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 leading-relaxed mb-2">
                  字段「<span className="font-medium text-gray-900">{inUseAlert.fieldName}</span>」已在企业数据中有填报记录，
                </p>
                <p className="text-sm text-gray-600 leading-relaxed mb-6">
                  为保证历史数据完整性，<strong>已使用的字段不可{inUseAlert.action}</strong>。如需停用，请先清除相关企业数据中该字段的填报内容。
                </p>
              </>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setInUseAlert({ show: false, fieldName: '', action: '', reason: 'data', formulaIndicators: [] })}
                className="px-5 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
