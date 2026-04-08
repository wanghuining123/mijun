import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import DocumentDetailModal from './DocumentDetailModal';

interface PolicyDoc {
  id: string;
  title: string;
  doc_number: string;
  doc_type: string;
  department: string;
  issuer: string;
  keywords: string[];
  publish_date: string | null;
  archive_year: number | null;
  archive_category: string;
  status: string;
}

export default function ArchiveTab() {
  const [docs, setDocs] = useState<PolicyDoc[]>([]);
  const [filtered, setFiltered] = useState<PolicyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewTarget, setViewTarget] = useState<PolicyDoc | null>(null);

  // 搜索条件
  const [searchTitle, setSearchTitle] = useState('');
  const [searchDocNum, setSearchDocNum] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchYear, setSearchYear] = useState('');
  const [searchDept, setSearchDept] = useState('');
  const [searchType, setSearchType] = useState('');

  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('policy_documents')
        .select('id,title,doc_number,doc_type,department,issuer,keywords,publish_date,archive_year,archive_category,status')
        .in('status', ['archived', 'published'])
        .order('archive_year', { ascending: false });
      if (error) throw error;
      setDocs(data || []);
      setFiltered(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleSearch = () => {
    let result = [...docs];
    if (searchTitle.trim()) result = result.filter(d => d.title.includes(searchTitle.trim()));
    if (searchDocNum.trim()) result = result.filter(d => d.doc_number.includes(searchDocNum.trim()));
    if (searchKeyword.trim()) result = result.filter(d =>
      d.keywords?.some(k => k.includes(searchKeyword.trim())) ||
      d.title.includes(searchKeyword.trim())
    );
    if (searchYear) result = result.filter(d => d.archive_year === parseInt(searchYear));
    if (searchDept.trim()) result = result.filter(d => d.department?.includes(searchDept.trim()));
    if (searchType) result = result.filter(d => d.doc_type === searchType);
    setFiltered(result);
  };

  const handleReset = () => {
    setSearchTitle(''); setSearchDocNum(''); setSearchKeyword('');
    setSearchYear(''); setSearchDept(''); setSearchType('');
    setFiltered(docs);
  };

  const years = Array.from(new Set(docs.map(d => d.archive_year).filter(Boolean))).sort((a, b) => (b || 0) - (a || 0));
  const docTypes = Array.from(new Set(docs.map(d => d.doc_type)));

  return (
    <div className="h-full overflow-auto p-6">
      {/* 检索表单 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <i className="ri-search-line text-teal-600"></i>
          <span className="text-sm font-medium text-gray-700">多条件组合检索</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">文件标题</label>
            <input value={searchTitle} onChange={e => setSearchTitle(e.target.value)}
              placeholder="输入标题关键词"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">文号</label>
            <input value={searchDocNum} onChange={e => setSearchDocNum(e.target.value)}
              placeholder="如：历下信用〔2024〕"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">关键词</label>
            <input value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)}
              placeholder="输入关键词搜索"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">归档年度</label>
            <select value={searchYear} onChange={e => setSearchYear(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">全部年度</option>
              {years.map(y => <option key={y} value={y!}>{y}年</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">起草部门</label>
            <input value={searchDept} onChange={e => setSearchDept(e.target.value)}
              placeholder="输入部门名称"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">文件类型</label>
            <select value={searchType} onChange={e => setSearchType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">全部类型</option>
              {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={handleReset}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap">
            重置
          </button>
          <button onClick={handleSearch}
            className="px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 cursor-pointer whitespace-nowrap">
            <i className="ri-search-line mr-2"></i>检索
          </button>
        </div>
      </div>

      {/* 检索结果 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">共检索到 <span className="font-medium text-gray-800">{filtered.length}</span> 份文件</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <i className="ri-loader-4-line text-3xl text-gray-300 animate-spin"></i>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <i className="ri-archive-line text-5xl mb-3"></i>
            <p className="text-sm">未找到匹配的档案文件</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['文件标题', '文号', '类型', '起草部门', '关键词', '归档年度', '发布日期', '操作'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900 max-w-xs truncate">{doc.title}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{doc.doc_number || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs rounded bg-teal-50 text-teal-700">{doc.doc_type}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{doc.department || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(doc.keywords || []).slice(0, 3).map(k => (
                        <span key={k} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">{k}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {doc.archive_year ? `${doc.archive_year}年` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {doc.publish_date ? new Date(doc.publish_date).toLocaleDateString('zh-CN') : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button onClick={() => setViewTarget(doc)}
                      className="text-teal-600 hover:text-teal-800 text-sm cursor-pointer whitespace-nowrap">
                      <i className="ri-eye-line mr-1"></i>查看
                    </button>
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
