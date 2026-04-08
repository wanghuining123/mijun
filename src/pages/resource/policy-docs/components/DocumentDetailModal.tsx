import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';

interface DocDetail {
  id: string;
  title: string;
  doc_number: string;
  doc_type: string;
  issuer: string;
  issue_date: string | null;
  department: string;
  content: string;
  keywords: string[];
  status: string;
  publish_date: string | null;
  archive_year: number | null;
  created_at: string;
}

interface DocumentDetailModalProps {
  docId: string;
  onClose: () => void;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'bg-gray-100 text-gray-600' },
  reviewing: { label: '审核中', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: '审核通过', cls: 'bg-emerald-100 text-emerald-700' },
  published: { label: '已发布', cls: 'bg-teal-100 text-teal-700' },
  archived: { label: '已归档', cls: 'bg-gray-100 text-gray-500' },
  rejected: { label: '已退回', cls: 'bg-red-100 text-red-600' },
};

export default function DocumentDetailModal({ docId, onClose }: DocumentDetailModalProps) {
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('policy_documents').select('*').eq('id', docId).maybeSingle()
      .then(({ data }) => { setDoc(data); setLoading(false); });
  }, [docId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="ri-file-text-line text-teal-600 text-lg"></i>
            <h2 className="text-base font-semibold text-gray-900">文件详情</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <i className="ri-loader-4-line text-3xl text-gray-300 animate-spin"></i>
            </div>
          ) : !doc ? (
            <div className="text-center text-gray-400 py-10">文件不存在</div>
          ) : (
            <div className="space-y-6">
              {/* 基础信息 */}
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h3 className="text-lg font-bold text-gray-900 leading-snug">{doc.title}</h3>
                  {STATUS_MAP[doc.status] && (
                    <span className={`flex-shrink-0 px-2.5 py-1 text-xs rounded-full ${STATUS_MAP[doc.status].cls}`}>
                      {STATUS_MAP[doc.status].label}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm bg-gray-50 rounded-lg p-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">文号</div>
                    <div className="text-gray-800 font-medium">{doc.doc_number || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">文件类型</div>
                    <div className="text-gray-800">{doc.doc_type}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">签发人</div>
                    <div className="text-gray-800">{doc.issuer || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">起草部门</div>
                    <div className="text-gray-800">{doc.department || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">成文日期</div>
                    <div className="text-gray-800">
                      {doc.issue_date ? new Date(doc.issue_date).toLocaleDateString('zh-CN') : '—'}
                    </div>
                  </div>
                  {doc.publish_date && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1">发布日期</div>
                      <div className="text-gray-800">{new Date(doc.publish_date).toLocaleDateString('zh-CN')}</div>
                    </div>
                  )}
                  {doc.archive_year && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1">归档年度</div>
                      <div className="text-gray-800">{doc.archive_year}年</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-gray-400 mb-1">创建时间</div>
                    <div className="text-gray-800">{new Date(doc.created_at).toLocaleDateString('zh-CN')}</div>
                  </div>
                </div>
              </div>

              {/* 关键词 */}
              {doc.keywords && doc.keywords.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">关键词</div>
                  <div className="flex flex-wrap gap-2">
                    {doc.keywords.map(kw => (
                      <span key={kw} className="px-2.5 py-1 text-xs bg-teal-50 text-teal-700 rounded-full">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* 正文 */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-3">文件正文</div>
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <pre className="text-sm text-gray-800 font-sans whitespace-pre-wrap leading-relaxed">
                    {doc.content || '（暂无正文内容）'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
