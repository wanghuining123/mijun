import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import DocumentEditorModal from './DocumentEditorModal';

interface PolicyDoc {
  id: string;
  title: string;
  doc_number: string;
  doc_type: string;
  department: string;
  status: string;
  reject_reason: string;
  created_at: string;
  updated_at: string;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'bg-gray-100 text-gray-600' },
  rejected: { label: '已退回', cls: 'bg-red-100 text-red-600' },
};

interface DraftTabProps {
  hasEditPermission: boolean;
}

export default function DraftTab({ hasEditPermission }: DraftTabProps) {
  const [docs, setDocs] = useState<PolicyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<PolicyDoc | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [submitConfirm, setSubmitConfirm] = useState<PolicyDoc | null>(null);
  const { user, profile } = useAuth();

  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('policy_documents')
        .select('id,title,doc_number,doc_type,department,status,reject_reason,created_at,updated_at')
        .in('status', ['draft', 'rejected'])
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setDocs(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id);
      await supabase.from('policy_documents').delete().eq('id', id);
      await fetchDocs();
    } finally {
      setDeleting(null);
    }
  };

  const handleSubmitReview = async (doc: PolicyDoc) => {
    // 先清理该文件旧的审核记录（重新提交时避免冲突）
    await supabase.from('policy_doc_reviews').delete().eq('document_id', doc.id);
    await supabase
      .from('policy_documents')
      .update({ status: 'reviewing', current_review_level: 1, reject_reason: '', updated_at: new Date().toISOString() })
      .eq('id', doc.id);
    await supabase.from('policy_doc_reviews').insert({
      document_id: doc.id,
      review_level: 1,
      status: 'pending',
    });
    setSubmitConfirm(null);
    await fetchDocs();
  };

  return (
    <div className="h-full overflow-auto p-6">
      {/* 操作栏 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">管理草稿文件，完成编辑后提交审核流程</p>
        {hasEditPermission && (
          <button
            onClick={() => { setEditingDoc(null); setEditorOpen(true); }}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
          >
            <i className="ri-add-line"></i>
            新建文件
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <i className="ri-loader-4-line text-3xl text-gray-300 animate-spin"></i>
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <i className="ri-draft-line text-5xl mb-3"></i>
            <p className="text-sm">暂无草稿文件</p>
            {hasEditPermission && (
              <button onClick={() => { setEditingDoc(null); setEditorOpen(true); }}
                className="mt-3 text-sm text-teal-600 hover:text-teal-700 cursor-pointer whitespace-nowrap">
                点击新建文件
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['文件标题', '文号', '类型', '起草部门', '最后修改', '状态', '操作'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map(doc => {
                const st = STATUS_MAP[doc.status] || STATUS_MAP.draft;
                return (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 max-w-xs truncate">{doc.title}</div>
                      {doc.reject_reason && (
                        <div className="text-xs text-red-500 mt-0.5 truncate max-w-xs">退回原因：{doc.reject_reason}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{doc.doc_number || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded bg-teal-50 text-teal-700">{doc.doc_type}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{doc.department || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(doc.updated_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {hasEditPermission ? (
                        <div className="flex items-center gap-3 text-sm">
                          <button onClick={() => { setEditingDoc(doc); setEditorOpen(true); }}
                            className="text-teal-600 hover:text-teal-800 cursor-pointer whitespace-nowrap">
                            <i className="ri-edit-line mr-1"></i>编辑
                          </button>
                          <button onClick={() => setSubmitConfirm(doc)}
                            className="text-emerald-600 hover:text-emerald-800 cursor-pointer whitespace-nowrap">
                            <i className="ri-send-plane-line mr-1"></i>提交审核
                          </button>
                          <button onClick={() => handleDelete(doc.id)}
                            disabled={deleting === doc.id}
                            className="text-red-500 hover:text-red-700 cursor-pointer whitespace-nowrap">
                            {deleting === doc.id ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-delete-bin-line"></i>}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 提交审核确认 */}
      {submitConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 flex items-center justify-center bg-emerald-50 rounded-lg">
                <i className="ri-git-branch-line text-emerald-600 text-xl"></i>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">确认提交审核？</h3>
                <p className="text-sm text-gray-500 mt-1">
                  文件「<span className="font-medium text-gray-700">{submitConfirm.title}</span>」
                  将进入初审→复审→终审流程，提交后将无法编辑。
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setSubmitConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap">取消</button>
              <button onClick={() => handleSubmitReview(submitConfirm)}
                className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer whitespace-nowrap">
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}

      {editorOpen && (
        <DocumentEditorModal
          doc={editingDoc as any}
          onClose={() => setEditorOpen(false)}
          onSaved={() => { setEditorOpen(false); fetchDocs(); }}
        />
      )}
    </div>
  );
}
