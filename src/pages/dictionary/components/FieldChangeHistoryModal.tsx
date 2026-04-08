import { useEffect, useState } from 'react';
import { useDictionaryVersions, FieldHistory } from '../../../hooks/useDictionaryVersions';

interface FieldChangeHistoryModalProps {
  /** Field data used to display name, code and lookup history */
  field: {
    id: string;
    name: string;
    code: string;
    /** other possible properties */
    [key: string]: any;
  };
  /** Callback to close the modal */
  onClose: () => void;
}

/**
 * Modal component that shows the change history of a dictionary field.
 * Fetches real data from Supabase dictionary_field_history table.
 */
export default function FieldChangeHistoryModal({
  field,
  onClose,
}: FieldChangeHistoryModalProps) {
  const { getFieldHistory } = useDictionaryVersions();
  const [history, setHistory] = useState<FieldHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      if (field?.id) {
        setLoading(true);
        const data = await getFieldHistory(field.id);
        setHistory(data);
        setLoading(false);
      }
    };
    loadHistory();
  }, [field?.id]);

  // 生成变更详情描述
  const generateChangeDetail = (record: FieldHistory): string => {
    const before = record.before_snapshot;
    const after = record.after_snapshot;

    if (record.operation_type === 'add') {
      return `新增字段：${after.name}（${after.type === 'text' ? '文本' : after.type === 'number' ? '数字' : after.type === 'date' ? '日期' : after.type === 'select' ? '下拉' : after.type}）${after.required ? '，必填' : ''}`;
    }

    if (record.operation_type === 'delete') {
      return `删除字段：${before?.name || '未知'}`;
    }

    // 修改操作 - 对比前后差异
    const changes: string[] = [];
    
    if (before?.name !== after.name) {
      changes.push(`字段名称：${before?.name} → ${after.name}`);
    }
    
    if (before?.type !== after.type) {
      const typeMap: Record<string, string> = {
        text: '文本',
        number: '数字',
        date: '日期',
        select: '下拉'
      };
      changes.push(`字段类型：${typeMap[before?.type] || before?.type} → ${typeMap[after.type] || after.type}`);
    }
    
    if (before?.required !== after.required) {
      changes.push(`必填状态：${before?.required ? '必填' : '非必填'} → ${after.required ? '必填' : '非必填'}`);
    }
    
    if (before?.placeholder !== after.placeholder) {
      changes.push(`提示语：${before?.placeholder || '无'} → ${after.placeholder || '无'}`);
    }

    if (before?.category !== after.category) {
      changes.push(`所属分类：${before?.category} → ${after.category}`);
    }

    return changes.length > 0 ? changes.join('；') : '字段配置已更新';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">字段变更历史</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-600">{field?.name ?? '未知字段'}</span>
              <code className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
                {field?.code || ''}
              </code>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            aria-label="关闭"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-500 py-12">暂无变更记录</p>
          ) : (
            <div className="space-y-4">
              {history.map((record, index) => (
                <div
                  key={record.id}
                  className="border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 text-xs rounded whitespace-nowrap ${
                          record.operation_type === 'add'
                            ? 'bg-blue-50 text-blue-700'
                            : record.operation_type === 'update'
                            ? 'bg-orange-50 text-orange-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {record.operation_type === 'add' ? '新增' : record.operation_type === 'update' ? '修改' : '删除'}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{record.version_number}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(record.created_at).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })} · {record.operator}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{generateChangeDetail(record)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}