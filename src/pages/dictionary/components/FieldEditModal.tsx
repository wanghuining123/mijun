import React, { useState, useEffect } from 'react';

interface FieldEditModalProps {
  field: any;
  onClose: () => void;
  onSave: (data: any, isNew: boolean) => void;
}

const GROUP_OPTIONS = ['基础信息', '用地信息', '经济能耗信息', '其他信息'];

/** 根据字段名称自动生成唯一编码（field_ + 时间戳 + 随机数） */
function generateFieldCode(name: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  const safeName = name
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
    .slice(0, 6);
  return `field_${safeName}_${ts}${rand}`;
}

/** 生成变更摘要 */
function generateChangeSummary(before: any, after: any, mode: 'add' | 'edit'): string[] {
  if (mode === 'add') {
    return [`新增字段「${after.name}」`];
  }
  
  const changes: string[] = [];
  if (before.name !== after.name) {
    changes.push(`字段名称：${before.name} → ${after.name}`);
  }
  if (before.inputType !== after.inputType) {
    const typeMap: Record<string, string> = {
      text: '文本', number: '数值', date: '日期', dropdown: '下拉单选'
    };
    changes.push(`输入类型：${typeMap[before.inputType]} → ${typeMap[after.inputType]}`);
  }
  if (before.required !== after.required) {
    changes.push(`必填状态：${before.required ? '必填' : '选填'} → ${after.required ? '必填' : '选填'}`);
  }
  if (before.groupName !== after.groupName) {
    changes.push(`所属分组：${before.groupName} → ${after.groupName}`);
  }
  if (before.placeholder !== after.placeholder) {
    changes.push(`提示语：${before.placeholder || '无'} → ${after.placeholder || '无'}`);
  }
  if (before.unit !== after.unit) {
    changes.push(`单位：${before.unit || '无'} → ${after.unit || '无'}`);
  }
  if (before.sortOrder !== after.sortOrder) {
    changes.push(`排序号：${before.sortOrder} → ${after.sortOrder}`);
  }
  
  return changes.length > 0 ? changes : ['无实质性变更'];
}

export default function FieldEditModal({ field, onClose, onSave }: FieldEditModalProps) {
  const mode: 'add' | 'edit' = field ? 'edit' : 'add';
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    inputType: 'text',
    required: false,
    placeholder: '',
    unit: '',
    sortOrder: 99,
    groupName: '其他信息',
  });
  const [originalData, setOriginalData] = useState<any>(null);
  const [changeSummary, setChangeSummary] = useState<string[]>([]);

  useEffect(() => {
    if (field) {
      const data = {
        name: field.name ?? '',
        code: field.code ?? '',
        inputType: field.input_type ?? field.inputType ?? 'text',
        required: !!field.required,
        placeholder: field.placeholder ?? '',
        unit: field.unit ?? '',
        sortOrder: field.sort_order ?? field.sortOrder ?? 99,
        groupName: field.group_name ?? field.groupName ?? '其他信息',
      };
      setFormData(data);
      setOriginalData(data);
    }
  }, [field]);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    // 生成变更摘要
    const summary = generateChangeSummary(originalData || {}, formData, mode);
    setChangeSummary(summary);
    setStep(2);
  };

  const handleConfirmSave = () => {
    const isNew = mode === 'add';
    const code = isNew ? generateFieldCode(formData.name) : formData.code;
    onSave({ ...formData, code }, isNew);
  };

  const isInUse = Boolean(field?.in_use || field?.inUse);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {mode === 'add' ? '新增字段' : '编辑字段'}
            {step === 2 && ' - 保存配置确认'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Step 1: 编辑字段内容 */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="p-6 space-y-5">
            {/* 字段名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                字段名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="请输入字段名称"
              />
              {mode === 'add' && (
                <p className="mt-1 text-xs text-gray-400">字段编码将由系统自动生成</p>
              )}
            </div>

            {/* 所属分组 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                所属分组 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.groupName}
                onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {GROUP_OPTIONS.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">决定该字段在企业填报表单中显示的区块位置</p>
            </div>

            {/* 输入类型 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                输入类型 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.inputType}
                onChange={(e) => setFormData({ ...formData, inputType: e.target.value })}
                disabled={isInUse}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="text">文本</option>
                <option value="number">数值</option>
                <option value="date">日期</option>
                <option value="dropdown">下拉单选</option>
              </select>
              {isInUse && (
                <p className="mt-1 text-xs text-orange-600">使用中的字段不可修改输入类型</p>
              )}
            </div>

            {/* 是否必填 */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.required}
                  onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700">设为必填项</span>
              </label>
            </div>

            {/* 字段提示语 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">字段输入提示语</label>
              <input
                type="text"
                value={formData.placeholder}
                onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="填写后将显示在输入框下方，引导用户填写"
              />
            </div>

            {/* 单位（仅数值类型） */}
            {formData.inputType === 'number' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">单位</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="如：万元、平方米、人等"
                />
              </div>
            )}

            {/* 排序号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                展示排序号 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value ? parseInt(e.target.value) : 99 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="数字越小越靠前"
              />
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
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
                下一步
              </button>
            </div>
          </form>
        )}

        {/* Step 2: 保存配置确认 */}
        {step === 2 && (
          <div className="p-6">
            {/* 提示信息 */}
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3">
              <i className="ri-information-line text-orange-600 text-xl mt-0.5"></i>
              <div className="flex-1">
                <p className="text-sm text-orange-900 font-medium mb-1">配置变更确认</p>
                <p className="text-sm text-orange-800">
                  本次修改将暂存为待发布状态，需点击「发布配置」按钮后才会正式生效并应用于新数据录入。
                </p>
              </div>
            </div>

            {/* 变更摘要 */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">本次变更内容</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                {changeSummary.map((item, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <i className="ri-arrow-right-s-line text-emerald-600 mt-0.5"></i>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                返回修改
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                确认保存
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}