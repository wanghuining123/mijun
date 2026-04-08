import { useState, useEffect } from 'react';
import PolicyDocPickerModal from './PolicyDocPickerModal';

interface Policy {
  id: string;
  policy_name: string;
  policy_type: string;
  policy_content: string;
  applicable_grades: string[];
  status: string;
  effective_date: string;
}

interface PolicyEditModalProps {
  policy: Policy | null;
  onClose: () => void;
  onSave: (data: Partial<Policy>) => void;
}

const POLICY_TYPES = ['用地', '信贷', '用能', '其他'];
const GRADES = ['A', 'B', 'C', 'D'];

export default function PolicyEditModal({ policy, onClose, onSave }: PolicyEditModalProps) {
  const [formData, setFormData] = useState({
    policy_name: '',
    policy_type: '用地',
    policy_content: '',
    applicable_grades: [] as string[],
    status: 'active',
    effective_date: new Date().toISOString().split('T')[0],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDocPicker, setShowDocPicker] = useState(!policy);
  const [sourceDocTitle, setSourceDocTitle] = useState('');

  useEffect(() => {
    if (policy) {
      setFormData({
        policy_name: policy.policy_name,
        policy_type: policy.policy_type,
        policy_content: policy.policy_content,
        applicable_grades: policy.applicable_grades,
        status: policy.status,
        effective_date: policy.effective_date,
      });
    }
  }, [policy]);

  const handleDocSelect = (doc: { id: string; title: string; doc_number: string; content: string }) => {
    setFormData(f => ({
      ...f,
      policy_name: doc.title,
      policy_content: doc.content ? doc.content.slice(0, 500) : '',
    }));
    setSourceDocTitle(doc.title);
    setShowDocPicker(false);
  };

  const handleGradeToggle = (grade: string) => {
    setFormData(prev => ({
      ...prev,
      applicable_grades: prev.applicable_grades.includes(grade)
        ? prev.applicable_grades.filter(g => g !== grade)
        : [...prev.applicable_grades, grade],
    }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.policy_name.trim()) {
      newErrors.policy_name = '请输入政策名称';
    }
    
    if (!formData.policy_content.trim()) {
      newErrors.policy_content = '请输入政策内容';
    }
    
    if (formData.applicable_grades.length === 0) {
      newErrors.applicable_grades = '请至少选择一个适用等级';
    }
    
    if (!formData.effective_date) {
      newErrors.effective_date = '请选择生效日期';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      A: 'bg-emerald-500',
      B: 'bg-blue-500',
      C: 'bg-amber-500',
      D: 'bg-red-500',
    };
    return colors[grade] || 'bg-gray-500';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 弹窗头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {policy ? '编辑政策' : '新增政策'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* 弹窗内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* 来源文件提示 */}
          {!policy && sourceDocTitle && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-700">
              <i className="ri-file-check-line"></i>
              <span>来源文件：{sourceDocTitle}</span>
              <button onClick={() => setShowDocPicker(true)} className="ml-auto text-xs text-teal-500 hover:text-teal-700 cursor-pointer whitespace-nowrap">重新选择</button>
            </div>
          )}
          <div className="space-y-4">
            {/* 政策名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                政策名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.policy_name}
                onChange={e => setFormData({ ...formData, policy_name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.policy_name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请输入政策名称"
              />
              {errors.policy_name && (
                <p className="text-xs text-red-500 mt-1">{errors.policy_name}</p>
              )}
            </div>

            {/* 政策类型 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                政策类型 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.policy_type}
                onChange={e => setFormData({ ...formData, policy_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {POLICY_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* 政策内容 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                政策内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.policy_content}
                onChange={e => setFormData({ ...formData, policy_content: e.target.value })}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none ${
                  errors.policy_content ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请输入政策内容描述"
              />
              {errors.policy_content && (
                <p className="text-xs text-red-500 mt-1">{errors.policy_content}</p>
              )}
            </div>

            {/* 适用等级 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                适用等级 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                {GRADES.map(grade => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => handleGradeToggle(grade)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      formData.applicable_grades.includes(grade)
                        ? `${getGradeColor(grade)} text-white shadow-md`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <i className={`${
                      formData.applicable_grades.includes(grade)
                        ? 'ri-checkbox-circle-fill'
                        : 'ri-checkbox-blank-circle-line'
                    } mr-1`}></i>
                    {grade}类企业
                  </button>
                ))}
              </div>
              {errors.applicable_grades && (
                <p className="text-xs text-red-500 mt-1">{errors.applicable_grades}</p>
              )}
            </div>

            {/* 生效日期 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                生效日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.effective_date}
                onChange={e => setFormData({ ...formData, effective_date: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.effective_date ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.effective_date && (
                <p className="text-xs text-red-500 mt-1">{errors.effective_date}</p>
              )}
            </div>

            {/* 状态 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                状态
              </label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="active">生效中</option>
                <option value="inactive">已停用</option>
              </select>
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
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
          >
            <i className="ri-save-line mr-2"></i>
            保存
          </button>
        </div>
      </div>

      {showDocPicker && !policy && (
        <PolicyDocPickerModal
          onClose={() => { if (!sourceDocTitle) onClose(); else setShowDocPicker(false); }}
          onSelect={handleDocSelect}
        />
      )}
    </div>
  );
}