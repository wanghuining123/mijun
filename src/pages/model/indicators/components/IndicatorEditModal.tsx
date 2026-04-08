import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';

interface DictionaryField {
  id: string;
  name: string;
  code: string;
  unit: string | null;
  input_type: string;
}

interface Indicator {
  id: string;
  applicable_type: 'above' | 'below';
  weight: number;
}

interface IndicatorEditModalProps {
  indicator: any;
  applicableType: 'above' | 'below';
  onClose: () => void;
  onSave: (data: any) => void;
  weightError?: string;
  indicators?: Indicator[];
  editingId?: string;
  allIndicators?: Indicator[];
}

const OPERATORS = ['+', '-', '*', '/', '(', ')'];

export default function IndicatorEditModal({
  indicator,
  applicableType,
  onClose,
  onSave,
  weightError = '',
  indicators = [],
  editingId,
  allIndicators = [],
}: IndicatorEditModalProps) {
  // 多选类型及各自权重
  const [selectedTypes, setSelectedTypes] = useState<{ above: boolean; below: boolean }>(() => {
    if (indicator) {
      return {
        above: indicator.applicable_type === 'above',
        below: indicator.applicable_type === 'below',
      };
    }
    return { above: applicableType === 'above', below: applicableType === 'below' };
  });

  const [weights, setWeights] = useState<{ above: number; below: number }>(() => {
    if (indicator) {
      // 当前记录自身的权重
      const selfAbove = indicator.applicable_type === 'above' ? indicator.weight : 0;
      const selfBelow = indicator.applicable_type === 'below' ? indicator.weight : 0;

      // 从 allIndicators 中查找同名、同模板的另一种类型指标，取其权重
      const counterpartType = indicator.applicable_type === 'above' ? 'below' : 'above';
      const counterpart = allIndicators.find(
        (ind) =>
          ind.applicable_type === counterpartType &&
          ind.indicator_name === indicator.indicator_name &&
          (ind as any).template_id === indicator.template_id
      );
      const counterpartWeight = counterpart ? Number(counterpart.weight) : 0;

      return {
        above: indicator.applicable_type === 'above' ? selfAbove : counterpartWeight,
        below: indicator.applicable_type === 'below' ? selfBelow : counterpartWeight,
      };
    }
    return { above: 0, below: 0 };
  });

  const [formData, setFormData] = useState({
    indicator_name: indicator?.indicator_name || '',
    formula: indicator?.formula || '',
    unit: indicator?.unit || '',
    scoring_direction: indicator?.scoring_direction || 'positive',
  });

  const [nameError, setNameError] = useState('');
  const [formulaError, setFormulaError] = useState('');
  const [typeError, setTypeError] = useState('');
  const [weightErrors, setWeightErrors] = useState<{ above?: string; below?: string }>({});
  const [fields, setFields] = useState<DictionaryField[]>([]);
  const [showFieldList, setShowFieldList] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadFields();
  }, []);

  const loadFields = async () => {
    const { data, error } = await supabase
      .from('dictionary_fields')
      .select('id, name, code, unit, input_type')
      .eq('status', 'enabled')
      .eq('input_type', 'number')
      .order('sort_order', { ascending: true });
    if (!error && data) setFields(data);
  };

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setFormData((prev) => ({ ...prev, formula: prev.formula + text }));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newFormula =
      formData.formula.substring(0, start) + text + formData.formula.substring(end);
    setFormData((prev) => ({ ...prev, formula: newFormula }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const insertOperator = (op: string) => insertAtCursor(` ${op} `);
  const insertField = (field: DictionaryField) => insertAtCursor(`{${field.name}}`);

  // 计算某类型已用权重（排除自身）
  const getUsedWeight = (type: 'above' | 'below') => {
    const selfType = indicator?.applicable_type ?? applicableType;
    if (type === selfType) {
      // 同类型：用当前页传入的 indicators，排除自身
      return indicators
        .filter((ind) => ind.applicable_type === type && (editingId ? ind.id !== editingId : true))
        .reduce((sum, ind) => sum + Number(ind.weight), 0);
    } else {
      // 另一种类型：用 allIndicators，排除同名的对应记录
      return allIndicators
        .filter(
          (ind) =>
            ind.applicable_type === type &&
            (indicator
              ? !(
                  (ind as any).indicator_name === indicator.indicator_name &&
                  (ind as any).template_id === indicator.template_id
                )
              : true)
        )
        .reduce((sum, ind) => sum + Number(ind.weight), 0);
    }
  };

  const handleTypeToggle = (type: 'above' | 'below') => {
    setSelectedTypes((prev) => ({ ...prev, [type]: !prev[type] }));
    setTypeError('');
  };

  const handleWeightChange = (type: 'above' | 'below', val: string) => {
    setWeights((prev) => ({ ...prev, [type]: parseFloat(val) || 0 }));
    setWeightErrors((prev) => ({ ...prev, [type]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (!formData.indicator_name.trim()) {
      setNameError('请输入指标名称');
      valid = false;
    } else {
      setNameError('');
    }

    if (!formData.formula.trim()) {
      setFormulaError('请输入计算公式');
      valid = false;
    } else {
      setFormulaError('');
    }

    if (!selectedTypes.above && !selectedTypes.below) {
      setTypeError('请至少选择一种适用企业类型');
      valid = false;
    } else {
      setTypeError('');
    }

    // 校验各类型权重
    const newWeightErrors: { above?: string; below?: string } = {};
    (['above', 'below'] as const).forEach((type) => {
      if (!selectedTypes[type]) return;
      const used = getUsedWeight(type);
      const total = used + weights[type];
      if (total > 100) {
        const remaining = parseFloat((100 - used).toFixed(1));
        newWeightErrors[type] = `${type === 'above' ? '规模以上' : '规模以下'}已用 ${used.toFixed(1)}%，最多可设 ${remaining > 0 ? remaining : 0}%`;
        valid = false;
      }
    });
    setWeightErrors(newWeightErrors);

    if (!valid) return;

    // 构建多条保存数据
    const results: any[] = [];
    if (selectedTypes.above) {
      results.push({ ...formData, applicable_type: 'above', weight: weights.above });
    }
    if (selectedTypes.below) {
      results.push({ ...formData, applicable_type: 'below', weight: weights.below });
    }
    onSave(results);
  };

  const typeOptions: { key: 'above' | 'below'; label: string }[] = [
    { key: 'above', label: '规模以上' },
    { key: 'below', label: '规模以下' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {indicator ? '编辑指标' : '新增指标'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 指标名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              指标名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.indicator_name}
              onChange={(e) => { setFormData({ ...formData, indicator_name: e.target.value }); setNameError(''); }}
              placeholder="例如：米均税收"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm ${nameError ? 'border-red-400' : 'border-gray-300'}`}
            />
            {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
          </div>

          {/* 适用企业类型（多选）+ 各自权重 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              适用企业类型 <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-400 font-normal">可多选，分别配置权重</span>
            </label>
            <div className="space-y-3">
              {typeOptions.map(({ key, label }) => {
                const used = getUsedWeight(key);
                const remaining = parseFloat((100 - used).toFixed(1));
                return (
                  <div
                    key={key}
                    className={`border rounded-lg p-4 transition-colors ${
                      selectedTypes[key]
                        ? 'border-teal-400 bg-teal-50/40'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* 复选框 */}
                      <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0">
                        <div
                          onClick={() => handleTypeToggle(key)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                            selectedTypes[key]
                              ? 'bg-teal-600 border-teal-600'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {selectedTypes[key] && (
                            <i className="ri-check-line text-white text-xs"></i>
                          )}
                        </div>
                        <span className={`text-sm font-medium ${selectedTypes[key] ? 'text-teal-700' : 'text-gray-600'}`}>
                          {label}
                        </span>
                      </label>

                      {/* 权重输入（仅选中时可编辑） */}
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm text-gray-500 whitespace-nowrap">权重（%）：</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={weights[key]}
                          onChange={(e) => handleWeightChange(key, e.target.value)}
                          disabled={!selectedTypes[key]}
                          placeholder="0-100"
                          className={`w-28 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors ${
                            !selectedTypes[key]
                              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                              : weightErrors[key]
                              ? 'border-red-400'
                              : 'border-gray-300'
                          }`}
                        />
                        {selectedTypes[key] && (() => {
                          const usedExcludingSelf = used;
                          const afterCurrent = parseFloat((100 - usedExcludingSelf - weights[key]).toFixed(1));
                          const totalUsed = parseFloat((usedExcludingSelf + weights[key]).toFixed(1));
                          const isOver = totalUsed > 100;
                          return (
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              已用&nbsp;
                              <span className={`font-semibold ${isOver ? 'text-red-600' : 'text-teal-600'}`}>
                                {totalUsed}%
                              </span>
                              ，剩余&nbsp;
                              <span className={`font-semibold ${afterCurrent < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                                {afterCurrent >= 0 ? afterCurrent : 0}%
                              </span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    {selectedTypes[key] && weightErrors[key] && (
                      <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                        <i className="ri-error-warning-line text-red-500 mt-0.5 flex-shrink-0"></i>
                        <p className="text-xs text-red-600">{weightErrors[key]}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {typeError && <p className="mt-1 text-xs text-red-500">{typeError}</p>}
            {weightError && (
              <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <i className="ri-error-warning-line text-red-500 mt-0.5 flex-shrink-0"></i>
                <p className="text-xs text-red-600">{weightError}</p>
              </div>
            )}
          </div>

          {/* 计分方式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              计分方式 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, scoring_direction: 'positive' })}
                className={`flex-1 flex items-center gap-3 px-4 py-3 border-2 rounded-lg transition-colors cursor-pointer ${
                  formData.scoring_direction === 'positive'
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  formData.scoring_direction === 'positive' ? 'border-teal-500' : 'border-gray-300'
                }`}>
                  {formData.scoring_direction === 'positive' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-teal-500"></div>
                  )}
                </div>
                <div className="text-left">
                  <div className={`text-sm font-medium ${formData.scoring_direction === 'positive' ? 'text-teal-700' : 'text-gray-700'}`}>
                    正向计分
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">指标值越大，得分越高</div>
                </div>
                <i className={`ri-arrow-up-line ml-auto text-lg ${formData.scoring_direction === 'positive' ? 'text-teal-500' : 'text-gray-300'}`}></i>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, scoring_direction: 'negative' })}
                className={`flex-1 flex items-center gap-3 px-4 py-3 border-2 rounded-lg transition-colors cursor-pointer ${
                  formData.scoring_direction === 'negative'
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  formData.scoring_direction === 'negative' ? 'border-orange-400' : 'border-gray-300'
                }`}>
                  {formData.scoring_direction === 'negative' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-400"></div>
                  )}
                </div>
                <div className="text-left">
                  <div className={`text-sm font-medium ${formData.scoring_direction === 'negative' ? 'text-orange-600' : 'text-gray-700'}`}>
                    反向计分
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">指标值越大，得分越低</div>
                </div>
                <i className={`ri-arrow-down-line ml-auto text-lg ${formData.scoring_direction === 'negative' ? 'text-orange-400' : 'text-gray-300'}`}></i>
              </button>
            </div>
          </div>

          {/* 计算公式 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                计算公式 <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowFieldList((v) => !v)}
                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 cursor-pointer whitespace-nowrap"
              >
                <i className={`ri-${showFieldList ? 'eye-off' : 'eye'}-line`}></i>
                {showFieldList ? '收起字段列表' : '展开字段列表'}
              </button>
            </div>

            <div className={`border rounded-lg overflow-hidden ${formulaError ? 'border-red-400' : 'border-gray-300'}`}>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-xs text-gray-500 mr-1 whitespace-nowrap">运算符：</span>
                {OPERATORS.map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => insertOperator(op)}
                    className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded bg-white text-gray-700 text-sm font-mono hover:bg-teal-50 hover:border-teal-400 hover:text-teal-700 cursor-pointer transition-colors"
                  >
                    {op}
                  </button>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={formData.formula}
                onChange={(e) => { setFormData({ ...formData, formula: e.target.value }); setFormulaError(''); }}
                placeholder="请输入计算公式，如：税收总额 / 自有土地面积"
                rows={3}
                className="w-full px-4 py-3 focus:outline-none font-mono text-sm resize-none text-gray-800 placeholder-gray-400"
              />
            </div>
            {formulaError && <p className="mt-1 text-xs text-red-500">{formulaError}</p>}

            {showFieldList && (
              <div className="mt-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs text-gray-500 mb-2">点击字段名称可快速插入到公式中（仅显示数值类型字段）：</p>
                <div className="flex flex-wrap gap-2">
                  {fields.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => insertField(field)}
                      className="px-3 py-1 border border-teal-300 text-teal-700 bg-white rounded-full text-xs hover:bg-teal-50 hover:border-teal-500 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      {field.name}
                    </button>
                  ))}
                  {fields.length === 0 && (
                    <span className="text-xs text-gray-400">暂无可用数值类型字段</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 单位 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">单位</label>
            <input
              type="text"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              placeholder="例如：万元/亩"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            />
          </div>

          {/* 多选提示 */}
          {selectedTypes.above && selectedTypes.below && !indicator && (
            <div className="flex items-center gap-2 px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg">
              <i className="ri-information-line text-teal-600 flex-shrink-0"></i>
              <p className="text-xs text-teal-700">
                已同时选择规模以上和规模以下，保存后将在两个类型下各自生成一条指标记录。
              </p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 whitespace-nowrap cursor-pointer"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
