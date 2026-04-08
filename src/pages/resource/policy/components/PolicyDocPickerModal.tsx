import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';

interface ApprovedDoc {
  id: string;
  title: string;
  doc_number: string;
  doc_type: string;
  issuer: string;
  content: string;
  publish_date: string | null;
}

interface PolicyDocPickerModalProps {
  onClose: () => void;
  onSelect: (doc: ApprovedDoc) => void;
}

export default function PolicyDocPickerModal({ onClose, onSelect }: PolicyDocPickerModalProps) {
  const [docs, setDocs] = useState<ApprovedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    supabase
      .from('policy_documents')
      .select('id,title,doc_number,doc_type,issuer,content,publish_date')
      .in('status', ['approved', 'published', 'archived'])
      .order('publish_date', { ascending: false })
      .then(({ data }) => { setDocs(data || []); setLoading(false); });
  }, []);

  const filtered = docs.filter(d =>
    !searchText || d.title.includes(searchText) || d.doc_number.includes(searchText)
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">选择审批通过的政策文件</h2>
            <p className="text-xs text-gray-500 mt-0.5">仅显示已审批通过或已发布的文件</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
        <div className="px-6 py-3 border-b border-gray-100">
          <input value={searchText} onChange={e => setSearchText(e.target.value)}
            placeholder="搜索文件标题或文号..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <i className="ri-loader-4-line text-3xl text-gray-300 animate-spin"></i>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <i className="ri-file-check-line text-4xl mb-2"></i>
              <p className="text-sm">暂无已审批通过的政策文件</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(doc => (
                <button key={doc.id} onClick={() => onSelect(doc)}
                  className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-teal-400 hover:bg-teal-50 transition-all cursor-pointer group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate group-hover:text-teal-700">{doc.title}</div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{doc.doc_number || '—'}</span>
                        <span className="px-1.5 py-0.5 bg-teal-50 text-teal-600 rounded">{doc.doc_type}</span>
                        <span>{doc.issuer}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <i className="ri-arrow-right-line"></i>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap">
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
