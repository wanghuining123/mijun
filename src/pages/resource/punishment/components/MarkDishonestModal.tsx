import { useState } from 'react';

interface MarkDishonestModalProps {
  enterprise: {
    id: string;
    name: string;
    credit_code: string;
  };
  onClose: () => void;
  onSave: (data: { reason: string; measures: string }) => void;
}

const COMMON_REASONS = [
  '连续两年未按时填报年度数据',
  '提供虚假数据，经核查不实',
  '拒不配合数据采集工作',
  '恶意隐瞒重要信息',
];

const COMMON_MEASURES = [
  '限制参与政府采购项目',
  '取消政策优惠资格',
  '列入重点监管名单',
  '限制获得政府性资金支持',
  '在政府网站公示失信信息',
];

export default function MarkDishonestModal({ enterprise, onClose, onSave }: MarkDishonestModalProps) {
  const [formData, setFormData] = useState({
    reason: '',
    measures: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.reason.trim()) {
      newErrors.reason = '请输入失信原因';
    }
    
    if (!formData.measures.trim()) {
      newErrors.measures = '请输入惩戒措施';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleSelectReason = (reason: string) => {
    setFormData(prev => ({
      ...prev,
      reason: prev.reason ? `${prev.reason}；${reason}` : reason,
    }));
  };

  const handleSelectMeasure = (measure: string) => {
    setFormData(prev => ({
      ...prev,
      measures: prev.measures ? `${prev.measures}；${measure}` : measure,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 弹窗头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">标记失信企业</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* 弹窗内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* 企业信息 */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-alert-line text-white text-xl"></i>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-red-900 mb-1">{enterprise.name}</h3>
                <p className="text-xs text-red-700">统一社会信用代码：{enterprise.credit_code}</p>
                <p className="text-xs text-red-600 mt-2">
                  标记为失信企业后，该企业将被列入重点监管名单，并受到相应惩戒措施
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* 失信原因 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                失信原因 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.reason}
                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none ${
                  errors.reason ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请详细描述失信原因"
              />
              {errors.reason && (
                <p className="text-xs text-red-500 mt-1">{errors.reason}</p>
              )}
              
              {/* 常用原因快捷选择 */}
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-2">常用原因（点击快速添加）：</p>
                <div className="flex flex-wrap gap-2">
                  {COMMON_REASONS.map(reason => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => handleSelectReason(reason)}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors whitespace-nowrap"
                    >
                      <i className="ri-add-line mr-1"></i>
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 惩戒措施 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                惩戒措施 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.measures}
                onChange={e => setFormData({ ...formData, measures: e.target.value })}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none ${
                  errors.measures ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请详细描述将采取的惩戒措施"
              />
              {errors.measures && (
                <p className="text-xs text-red-500 mt-1">{errors.measures}</p>
              )}
              
              {/* 常用措施快捷选择 */}
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-2">常用措施（点击快速添加）：</p>
                <div className="flex flex-wrap gap-2">
                  {COMMON_MEASURES.map(measure => (
                    <button
                      key={measure}
                      type="button"
                      onClick={() => handleSelectMeasure(measure)}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors whitespace-nowrap"
                    >
                      <i className="ri-add-line mr-1"></i>
                      {measure}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 弹窗底部 */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            <i className="ri-alert-line mr-2"></i>
            确认标记
          </button>
        </div>
      </div>
    </div>
  );
}