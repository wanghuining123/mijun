import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';

interface ReviewRecord {
  id: string;
  review_level: number;
  reviewer_name: string;
  status: string;
  comment: string;
  reviewed_at: string | null;
}

interface DocSummary {
  id: string;
  title: string;
  doc_number: string;
  doc_type: string;
  current_review_level: number;
  issuer: string;
  department: string;
}

interface ReviewModalProps {
  doc: DocSummary;
  onClose: () => void;
  onDone: () => void;
}

const LEVEL_LABELS = ['', '初审', '复审', '终审'];

export default function ReviewModal({ doc, onClose, onDone }: ReviewModalProps) {
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    supabase.from('policy_doc_reviews')
      .select('*')
      .eq('document_id', doc.id)
      .order('review_level', { ascending: true })
      .then(({ data }) => setRecords(data || []));
  }, [doc.id]);

  const handleReview = async (approved: boolean) => {
    try {
      setSaving(true);
      const reviewerName = profile?.real_name || profile?.phone || '审核人';
      const now = new Date().toISOString();

      // 更新当前审核记录
      await supabase.from('policy_doc_reviews')
        .update({
          status: approved ? 'approved' : 'rejected',
          reviewer_id: profile?.id,
          reviewer_name: reviewerName,
          comment,
          reviewed_at: now,
        })
        .eq('document_id', doc.id)
        .eq('review_level', doc.current_review_level)
        .eq('status', 'pending');

      if (!approved) {
        // 退回草稿
        await supabase.from('policy_documents').update({
          status: 'rejected',
          current_review_level: 0,
          reject_reason: comment || '审核未通过，请修改后重新提交',
          updated_at: now,
        }).eq('id', doc.id);
      } else if (doc.current_review_level < 3) {
        // 进入下一审核级别
        const nextLevel = doc.current_review_level + 1;
        await supabase.from('policy_documents').update({
          current_review_level: nextLevel,
          updated_at: now,
        }).eq('id', doc.id);
        await supabase.from('policy_doc_reviews').insert({
          document_id: doc.id,
          review_level: nextLevel,
          status: 'pending',
        });
      } else {
        // 终审通过 → approved
        await supabase.from('policy_documents').update({
          status: 'approved',
          updated_at: now,
        }).eq('id', doc.id);
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const levelInfo = LEVEL_LABELS[doc.current_review_level] || '审核';
  const isLastLevel = doc.current_review_level === 3;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center bg-teal-50 rounded-lg">
              <i className="ri-check-double-line text-teal-600"></i>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{levelInfo}审核</h2>
              <p className="text-xs text-gray-500 mt-0.5">第 {doc.current_review_level}/3 级</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 文件摘要 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="text-sm font-semibold text-gray-800">{doc.title}</div>
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
              <span>文号：{doc.doc_number || '—'}</span>
              <span>类型：{doc.doc_type}</span>
              <span>签发：{doc.issuer || '—'}</span>
            </div>
          </div>

          {/* 审核进度 */}
          <div>
            <div className="text-sm font-medium text-gray-700 mb-3">审核进度</div>
            <div className="flex items-center gap-0">
              {[1, 2, 3].map((level, idx) => {
                const rec = records.find(r => r.review_level === level);
                const isDone = rec && rec.status !== 'pending';
                const isCurrent = doc.current_review_level === level;
                const isApproved = rec?.status === 'approved';
                const isRejected = rec?.status === 'rejected';
                return (
                  <div key={level} className="flex items-center">
                    <div className={`flex flex-col items-center gap-1.5 ${isCurrent ? 'opacity-100' : isDone ? 'opacity-100' : 'opacity-40'}`}>
                      <div className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium ${
                        isApproved ? 'bg-emerald-100 text-emerald-700' :
                        isRejected ? 'bg-red-100 text-red-600' :
                        isCurrent ? 'bg-teal-100 text-teal-700 ring-2 ring-teal-400' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        {isApproved ? <i className="ri-check-line"></i> :
                         isRejected ? <i className="ri-close-line"></i> :
                         isCurrent ? <i className="ri-time-line"></i> : level}
                      </div>
                      <div className="text-xs text-gray-600">{LEVEL_LABELS[level]}</div>
                      {rec && isDone && (
                        <div className="text-xs text-gray-400 text-center">{rec.reviewer_name}</div>
                      )}
                    </div>
                    {idx < 2 && <div className="w-12 h-px bg-gray-200 flex-shrink-0 mb-4 mx-1"></div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 历史批注 */}
          {records.filter(r => r.status !== 'pending' && r.comment).length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">历史批注</div>
              <div className="space-y-2">
                {records.filter(r => r.status !== 'pending' && r.comment).map(r => (
                  <div key={r.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{LEVEL_LABELS[r.review_level]} · {r.reviewer_name}</span>
                      <span className={`px-1.5 py-0.5 rounded-full ${r.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {r.status === 'approved' ? '通过' : '退回'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{r.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 本次批注 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              审核意见 <span className="text-gray-400 font-normal">（选填）</span>
            </label>
            <textarea value={comment} onChange={e => setComment(e.target.value.slice(0, 500))}
              rows={3} maxLength={500}
              placeholder={`请填写${levelInfo}意见或批注...`}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
            <div className="text-xs text-gray-400 text-right mt-0.5">{comment.length}/500</div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap">
            取消
          </button>
          <div className="flex gap-3">
            <button onClick={() => handleReview(false)} disabled={saving}
              className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer whitespace-nowrap disabled:opacity-50">
              <i className="ri-arrow-go-back-line mr-2"></i>退回修改
            </button>
            <button onClick={() => handleReview(true)} disabled={saving}
              className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer whitespace-nowrap disabled:opacity-50">
              {saving ? <i className="ri-loader-4-line animate-spin mr-2"></i> : <i className="ri-check-line mr-2"></i>}
              {isLastLevel ? '终审通过' : '通过，进入下一级'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
