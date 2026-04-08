import { PendingChange } from '../../../hooks/useDictionaryVersions';

interface PublishConfirmModalProps {
  pendingChanges: PendingChange[];
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PublishConfirmModal({
  pendingChanges,
  onConfirm,
  onCancel,
}: PublishConfirmModalProps) {
  const getOperationText = (operation: string) => {
    switch (operation) {
      case 'add':
        return '新增';
      case 'update':
        return '修改';
      case 'delete':
        return '删除';
      default:
        return operation;
    }
  };

  const getChangeSummary = (change: PendingChange) => {
    const changes: string[] = [];
    
    if (change.operation === 'add') {
      const s = change.after_snapshot;
      const typeMap: Record<string, string> = {
        text: '文本', number: '数值', date: '日期', dropdown: '下拉单选', select: '下拉单选'
      };
      changes.push(`字段名称：${s?.name}`);
      changes.push(`输入类型：${typeMap[s?.input_type ?? s?.inputType] ?? s?.input_type ?? s?.inputType}`);
      changes.push(`所属分组：${s?.group_name ?? s?.groupName}`);
      if (s?.required) changes.push('必填：是');
      if (s?.placeholder) changes.push(`提示语：${s.placeholder}`);
      if (s?.unit) changes.push(`单位：${s.unit}`);
      return changes;
    }
    
    if (change.operation === 'delete') {
      return [`删除字段「${change.before_snapshot?.name}」`];
    }
    
    if (change.operation === 'update' && change.before_snapshot && change.after_snapshot) {
      const before = change.before_snapshot;
      const after = change.after_snapshot;

      const typeMap: Record<string, string> = {
        text: '文本', number: '数值', date: '日期', dropdown: '下拉单选', select: '下拉单选'
      };

      // 名称
      const beforeName = before.name;
      const afterName = after.name;
      if (beforeName !== afterName) {
        changes.push(`字段名称：${beforeName} → ${afterName}`);
      }

      // 输入类型（兼容驼峰和下划线）
      const beforeType = before.input_type ?? before.inputType;
      const afterType = after.input_type ?? after.inputType;
      if (beforeType !== afterType) {
        changes.push(`输入类型：${typeMap[beforeType] ?? beforeType} → ${typeMap[afterType] ?? afterType}`);
      }

      // 必填
      const beforeRequired = !!before.required;
      const afterRequired = !!after.required;
      if (beforeRequired !== afterRequired) {
        changes.push(`必填：${beforeRequired ? '是' : '否'} → ${afterRequired ? '是' : '否'}`);
      }

      // 所属分组
      const beforeGroup = before.group_name ?? before.groupName;
      const afterGroup = after.group_name ?? after.groupName;
      if (beforeGroup !== afterGroup) {
        changes.push(`所属分组：${beforeGroup} → ${afterGroup}`);
      }

      // 提示语
      const beforePlaceholder = before.placeholder ?? '';
      const afterPlaceholder = after.placeholder ?? '';
      if (beforePlaceholder !== afterPlaceholder) {
        changes.push(`提示语：${beforePlaceholder || '无'} → ${afterPlaceholder || '无'}`);
      }

      // 单位
      const beforeUnit = before.unit ?? '';
      const afterUnit = after.unit ?? '';
      if (beforeUnit !== afterUnit) {
        changes.push(`单位：${beforeUnit || '无'} → ${afterUnit || '无'}`);
      }

      // 排序
      const beforeSort = before.sort_order ?? before.sortOrder;
      const afterSort = after.sort_order ?? after.sortOrder;
      if (beforeSort !== afterSort) {
        changes.push(`排序号：${beforeSort} → ${afterSort}`);
      }
    }
    
    return changes;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
              <i className="ri-alert-line text-xl text-orange-600"></i>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">确认发布配置</h3>
          </div>
          <p className="text-sm text-gray-600 ml-13">
            当前配置将应用于新数据录入，历史数据展示依据原版本字典，确认继续？
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">待发布的变更</h4>
              <span className="text-sm text-gray-500">共 {pendingChanges.length} 项</span>
            </div>
          </div>

          <div className="space-y-3">
            {pendingChanges.map((change, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap mt-0.5 ${
                    change.operation === 'add'
                      ? 'bg-green-50 text-green-700'
                      : change.operation === 'update'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {getOperationText(change.operation)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 mb-1">
                      {(change.after_snapshot ?? change.before_snapshot)?.name}
                    </div>
                    <div className="space-y-1">
                      {getChangeSummary(change).map((summary, idx) => (
                        <div key={idx} className="text-sm text-gray-600">
                          {summary}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <i className="ri-information-line text-amber-600 text-base mt-0.5"></i>
              <div className="text-sm text-amber-800 leading-relaxed">
                <p className="font-medium mb-1">发布后的影响：</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>新的字段配置将立即在企业数据填报模块中生效</li>
                  <li>已录入的历史数据将继续使用原版本字典展示</li>
                  <li>系统将自动生成新版本号并记录变更历史</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors whitespace-nowrap flex items-center gap-2"
          >
            <i className="ri-check-line text-base"></i>
            确认发布
          </button>
        </div>
      </div>
    </div>
  );
}