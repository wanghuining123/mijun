import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import PolicyEditModal from './components/PolicyEditModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import { useAuth } from '../../../contexts/AuthContext';

interface Policy {
  id: string;
  policy_name: string;
  policy_type: string;
  policy_content: string;
  applicable_grades: string[];
  status: string;
  effective_date: string;
  created_at: string;
  updated_at: string;
}

const GRADE_TABS = [
  { key: 'A', label: 'A类企业', color: 'bg-emerald-500' },
  { key: 'B', label: 'B类企业', color: 'bg-blue-500' },
  { key: 'C', label: 'C类企业', color: 'bg-amber-500' },
  { key: 'D', label: 'D类企业', color: 'bg-red-500' },
];

const POLICY_TYPES = ['用地', '信贷', '用能', '其他'];

export default function PolicyPage() {
  const [activeGrade, setActiveGrade] = useState('A');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [filteredPolicies, setFilteredPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const { canEdit } = useAuth();
  const hasEditPermission = canEdit('resource_policy');

  useEffect(() => {
    fetchPolicies();
  }, []);

  useEffect(() => {
    const filtered = policies.filter(policy => 
      policy.applicable_grades.includes(activeGrade)
    );
    setFilteredPolicies(filtered);
  }, [activeGrade, policies]);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('differentiated_policies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPolicies(data || []);
    } catch (error) {
      console.error('获取政策列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSelectedPolicy(null);
    setEditModalOpen(true);
  };

  const handleEdit = (policy: Policy) => {
    setSelectedPolicy(policy);
    setEditModalOpen(true);
  };

  const handleDelete = (policy: Policy) => {
    setSelectedPolicy(policy);
    setDeleteModalOpen(true);
  };

  const handleSave = async (policyData: Partial<Policy>) => {
    try {
      if (selectedPolicy) {
        const { error } = await supabase
          .from('differentiated_policies')
          .update({ ...policyData, updated_at: new Date().toISOString() })
          .eq('id', selectedPolicy.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('differentiated_policies')
          .insert([policyData]);
        if (error) throw error;
      }
      await fetchPolicies();
      setEditModalOpen(false);
    } catch (error) {
      console.error('保存政策失败:', error);
      alert('保存失败，请重试');
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedPolicy) return;
    try {
      const { error } = await supabase
        .from('differentiated_policies')
        .delete()
        .eq('id', selectedPolicy.id);
      if (error) throw error;
      await fetchPolicies();
      setDeleteModalOpen(false);
    } catch (error) {
      console.error('删除政策失败:', error);
      alert('删除失败，请重试');
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      '用地': 'bg-purple-100 text-purple-700',
      '信贷': 'bg-blue-100 text-blue-700',
      '用能': 'bg-orange-100 text-orange-700',
      '其他': 'bg-gray-100 text-gray-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const getStatusBadge = (status: string) => {
    return status === 'active' ? (
      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">生效中</span>
    ) : (
      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">已停用</span>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">差别化政策配置</h1>
            <p className="text-sm text-gray-500 mt-1">根据企业分类等级配置差别化政策措施</p>
          </div>
          <div className="flex items-center gap-3">
            {hasEditPermission && (
              <button
                onClick={handleAdd}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
              >
                <i className="ri-add-line mr-2"></i>
                新增政策
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 等级切换标签 */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {GRADE_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveGrade(tab.key)}
              className={`px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
                activeGrade === tab.key
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${tab.color}`}></span>
                {tab.label}
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                  {policies.filter(p => p.applicable_grades.includes(tab.key)).length}
                </span>
              </div>
              {activeGrade === tab.key && (
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${tab.color}`}></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 政策列表 */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-3xl text-gray-400 animate-spin"></i>
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <i className="ri-file-list-3-line text-5xl mb-3"></i>
              <p className="text-sm">暂无{activeGrade}类企业政策</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      政策名称
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      政策类型
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      政策内容
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      适用等级
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      生效日期
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      状态
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPolicies.map(policy => (
                    <tr key={policy.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{policy.policy_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(policy.policy_type)}`}>
                          {policy.policy_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 max-w-md line-clamp-2">
                          {policy.policy_content}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-1">
                          {policy.applicable_grades.map(grade => {
                            const gradeTab = GRADE_TABS.find(t => t.key === grade);
                            return (
                              <span
                                key={grade}
                                className={`px-2 py-1 text-xs rounded ${gradeTab?.color} text-white`}
                              >
                                {grade}类
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {policy.effective_date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(policy.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {hasEditPermission ? (
                          <>
                            <button
                              onClick={() => handleEdit(policy)}
                              className="text-blue-600 hover:text-blue-800 mr-3 whitespace-nowrap"
                            >
                              <i className="ri-edit-line mr-1"></i>
                              编辑
                            </button>
                            <button
                              onClick={() => handleDelete(policy)}
                              className="text-red-600 hover:text-red-800 whitespace-nowrap"
                            >
                              <i className="ri-delete-bin-line mr-1"></i>
                              删除
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 编辑弹窗 */}
      {editModalOpen && (
        <PolicyEditModal
          policy={selectedPolicy}
          onClose={() => setEditModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {/* 删除确认弹窗 */}
      {deleteModalOpen && selectedPolicy && (
        <DeleteConfirmModal
          policyName={selectedPolicy.policy_name}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}