import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import ReviewModal from './ReviewModal';
import DocumentDetailModal from './DocumentDetailModal';

interface PolicyDoc {
  id: string;
  title: string;
  doc_number: string;
  doc_type: string;
  department: string;
  issuer: string;
  current_review_level: number;
  status: string;
  updated_at: string;
}

const REVIEW_LEVELS = [
  { level: 1, label: '初审', color: 'bg-amber-100 text-amber-700', permKey: 'level1' },
  { level: 2, label: '复审', color: 'bg-teal-100 text-teal-700', permKey: 'level2' },
  { level: 3, label: '终审', color: 'bg-emerald-100 text-emerald-700', permKey: 'level3' },
];

interface ReviewTabProps { hasEditPermission: boolean; }

export default function ReviewTab({ hasEditPermission }: ReviewTabProps) {
  const [docs, setDocs] = useState<PolicyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState(1);
  const [reviewTarget, setReviewTarget] = useState<PolicyDoc | null>(null);
  const [viewTarget, setViewTarget] = useState<PolicyDoc | null>(null);
  const { profile, isAdmin } = useAuth();

  // 判断当前用户是否有指定级别的审批权限
  const canReviewLevel = (level: number): boolean => {
    if (isAdmin()) return true;
    const permMap: Record<number, string> = { 1: 'level1', 2: 'level2', 3: 'level3' };
    return profile?.review_permission === permMap[level];
  };

  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('policy_documents')
        .select('id,title,doc_number,doc_type,department,issuer,current_review_level,status,updated_at')
        .eq('status', 'reviewing')
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

  const filtered = docs.filter(d => d.current_review_level === activeLevel);
  const countOf = (level: number) => docs.filter(d => d.current_review_level === level).length;

  return (
    <div className="h-full overflow-auto p-6">
      <p className="text-sm text-gray-500 mb-4">对提交审核的文件按流程进行初审→复审→终审，通过后方可发布</p>

      {/* 审批权限提示 */}
      {!isAdmin() && profile?.review_permission === 'none' && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <i className="ri-information-line text-base flex-shrink-0"></i>
          <span>您当前没有审批权限，仅可查看审核流程。如需参与审批，请联系管理员配置审批权限。</span>
        </div>
      )}
      {!isAdmin() && profile?.review_permission && profile.review_permission !== 'none' && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-700">
          <i className="ri-shield-check-line text-base flex-shrink-0"></i>
          <span>您的审批权限：
            <strong className="font-semibold ml-1">
              {profile.review_permission === 'level1' ? '初审' : profile.review_permission === 'level2' ? '复审' : '终审'}
            </strong>
            ，仅可对对应阶段的文件执行审批操作。
          </span>
        </div>
      )}

      {/* 审核阶段切换 */}
      <div className="flex gap-3 mb-5">
        {REVIEW_LEVELS.map(({ level, label, color }) => (
          <button
            key={level}
            onClick={() => setActiveLevel(level)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap border ${
              activeLevel === level
                ? 'border-teal-600 bg-teal-600 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <span>{level === 1 ? '①' : level === 2 ? '②' : '③'}</span>
            {label}
            <span className={`px-1.5 py-0.5 text-xs rounded-full ${
              activeLevel === level ? 'bg-white/20 text-white' : color
            }`}>
              {countOf(level)}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <i className="ri-loader-4-line text-3xl text-gray-300 animate-spin"></i>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <i className="ri-checkbox-circle-line text-5xl mb-3"></i>
            <p className="text-sm">
              {REVIEW_LEVELS.find(r => r.level === activeLevel)?.label}阶段暂无待审文件
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">文件标题</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">文号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">起草部门</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">签发人</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">提交时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">审核阶段</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap sticky right-0 bg-gray-50 shadow-[-8px_0_8px_-4px_rgba(0,0,0,0.04)]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(doc => {
                const lvInfo = REVIEW_LEVELS.find(r => r.level === doc.current_review_level);
                const canReview = hasEditPermission && canReviewLevel(doc.current_review_level);
                return (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 max-w-[200px] truncate" title={doc.title}>{doc.title}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap max-w-[140px] truncate">{doc.doc_number || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded bg-teal-50 text-teal-700">{doc.doc_type}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{doc.department || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{doc.issuer || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(doc.updated_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {lvInfo && (
                        <span className={`px-2 py-1 text-xs rounded-full ${lvInfo.color}`}>
                          {lvInfo.label}待审
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap sticky right-0 bg-white shadow-[-8px_0_8px_-4px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center gap-3 text-sm">
                        <button onClick={() => setViewTarget(doc)}
                          className="text-gray-500 hover:text-gray-700 cursor-pointer whitespace-nowrap">
                          <i className="ri-eye-line mr-1"></i>查看
                        </button>
                        {canReviewLevel(doc.current_review_level) ? (
                          <button onClick={() => setReviewTarget(doc)}
                            className="text-teal-600 hover:text-teal-800 cursor-pointer whitespace-nowrap font-medium">
                            <i className="ri-check-double-line mr-1"></i>审核
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs whitespace-nowrap cursor-not-allowed" title="无此审批级别权限">
                            <i className="ri-lock-line mr-1"></i>无权审核
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {reviewTarget && (
        <ReviewModal
          doc={reviewTarget as any}
          onClose={() => setReviewTarget(null)}
          onDone={() => { setReviewTarget(null); fetchDocs(); }}
        />
      )}
      {viewTarget && (
        <DocumentDetailModal
          docId={viewTarget.id}
          onClose={() => setViewTarget(null)}
        />
      )}
    </div>
  );
}
