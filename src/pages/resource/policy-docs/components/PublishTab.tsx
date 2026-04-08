import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import DocumentDetailModal from './DocumentDetailModal';

interface PolicyDoc {
  id: string;
  title: string;
  doc_number: string;
  doc_type: string;
  issuer: string;
  department: string;
  status: string;
  publish_date: string | null;
  issue_date: string | null;
  updated_at: string;
}

interface PublishTabProps { hasEditPermission: boolean; }

export default function PublishTab({ hasEditPermission }: PublishTabProps) {
  const [docs, setDocs] = useState<PolicyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'approved' | 'published'>('approved');
  const [viewTarget, setViewTarget] = useState<PolicyDoc | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('policy_documents')
        .select('id,title,doc_number,doc_type,issuer,department,status,publish_date,issue_date,updated_at')
        .in('status', ['approved', 'published', 'archived'])
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

  const approvedDocs = docs.filter(d => d.status === 'approved');
  const publishedDocs = docs.filter(d => d.status === 'published' || d.status === 'archived');

  const handlePublish = async (doc: PolicyDoc) => {
    try {
      setPublishing(doc.id);
      await supabase
        .from('policy_documents')
        .update({
          status: 'published',
          publish_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);
      await fetchDocs();
    } finally {
      setPublishing(null);
    }
  };

  const handleArchive = async (doc: PolicyDoc) => {
    try {
      setArchiving(doc.id);
      const year = doc.publish_date
        ? new Date(doc.publish_date).getFullYear()
        : new Date().getFullYear();
      await supabase
        .from('policy_documents')
        .update({
          status: 'archived',
          archive_year: year,
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);
      await fetchDocs();
    } finally {
      setArchiving(null);
    }
  };

  const filtered = activeView === 'approved' ? approvedDocs : publishedDocs;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {activeView === 'approved'
            ? '以下文件已通过终审，可正式发布；发布后将可在差别化政策配置中选择使用'
            : '已发布文件列表，可将文件归档至历史档案库'}
        </p>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setActiveView('approved')}
            className={`px-4 py-1.5 text-sm rounded-md transition-all cursor-pointer whitespace-nowrap ${
              activeView === 'approved' ? 'bg-white text-gray-800 font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}>
            待发布 {approvedDocs.length > 0 && <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 px-1.5 rounded-full">{approvedDocs.length}</span>}
          </button>
          <button onClick={() => setActiveView('published')}
            className={`px-4 py-1.5 text-sm rounded-md transition-all cursor-pointer whitespace-nowrap ${
              activeView === 'published' ? 'bg-white text-gray-800 font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}>
            已发布
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <i className="ri-loader-4-line text-3xl text-gray-300 animate-spin"></i>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <i className="ri-file-check-line text-5xl mb-3"></i>
            <p className="text-sm">{activeView === 'approved' ? '暂无待发布文件' : '暂无已发布文件'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['文件标题', '文号', '类型', '签发人', '成文日期',
                  activeView === 'published' ? '发布日期' : '',
                  '操作'].filter(Boolean).map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900 max-w-sm truncate">{doc.title}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{doc.doc_number || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs rounded bg-teal-50 text-teal-700">{doc.doc_type}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{doc.issuer || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {doc.issue_date ? new Date(doc.issue_date).toLocaleDateString('zh-CN') : '—'}
                  </td>
                  {activeView === 'published' && (
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {doc.publish_date ? new Date(doc.publish_date).toLocaleDateString('zh-CN') : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3 text-sm">
                      <button onClick={() => setViewTarget(doc)}
                        className="text-gray-500 hover:text-gray-700 cursor-pointer whitespace-nowrap">
                        <i className="ri-eye-line mr-1"></i>查看
                      </button>
                      {hasEditPermission && activeView === 'approved' && (
                        <button onClick={() => handlePublish(doc)}
                          disabled={publishing === doc.id}
                          className="text-teal-600 hover:text-teal-800 cursor-pointer whitespace-nowrap">
                          {publishing === doc.id
                            ? <i className="ri-loader-4-line animate-spin"></i>
                            : <><i className="ri-send-plane-line mr-1"></i>正式发布</>}
                        </button>
                      )}
                      {hasEditPermission && activeView === 'published' && doc.status === 'published' && (
                        <button onClick={() => handleArchive(doc)}
                          disabled={archiving === doc.id}
                          className="text-gray-500 hover:text-gray-700 cursor-pointer whitespace-nowrap">
                          {archiving === doc.id
                            ? <i className="ri-loader-4-line animate-spin"></i>
                            : <><i className="ri-archive-line mr-1"></i>归档</>}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewTarget && (
        <DocumentDetailModal
          docId={viewTarget.id}
          onClose={() => setViewTarget(null)}
        />
      )}
    </div>
  );
}
