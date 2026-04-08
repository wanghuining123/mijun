import { useState, useEffect } from 'react';
import { Fragment } from 'react';
import { supabase } from '../../../lib/supabase';
import MarkDishonestModal from './components/MarkDishonestModal';
import PunishmentRecordsModal from './components/PunishmentRecordsModal';
import { useAuth } from '../../../contexts/AuthContext';

// 每个年度的缺失记录（含推送状态，来自 data_push_records，可能为空）
interface YearMissingRecord {
  missing_year: number;
  push_status: 'pending' | 'pushed' | 'completed';
  pushed_at: string | null;
  completed_at: string | null;
  missing_fields_count: number;
}

interface EnterpriseYearlyMissing {
  enterprise_id: string;
  enterprise_name: string;
  credit_code: string;
  yearRecords: YearMissingRecord[];
  totalMissingYears: number;
  completedYears: number;
}

interface DishonestEnterprise {
  id: string;
  enterprise_id: string;
  enterprise_name: string;
  credit_code: string;
  reason: string;
  punishment_measures: string;
  marked_by: string;
  marked_at: string;
  status: string;
}

export default function PunishmentPage() {
  const currentYear = new Date().getFullYear();
  // 与企业数据列表保持一致：从2024到当前年份
  const availableYears = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2024 + i).reverse();

  const [activeTab, setActiveTab] = useState<'missing' | 'dishonest'>('missing');
  const [enterpriseList, setEnterpriseList] = useState<EnterpriseYearlyMissing[]>([]);
  const [dishonestEnterprises, setDishonestEnterprises] = useState<DishonestEnterprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [markModalOpen, setMarkModalOpen] = useState(false);
  const [recordsModalOpen, setRecordsModalOpen] = useState(false);
  const [selectedEnterprise, setSelectedEnterprise] = useState<any>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const PAGE_SIZE = 10;

  const { canEdit } = useAuth();
  const hasEditPermission = canEdit('resource_punishment');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchMissingEnterprises(), fetchDishonestEnterprises()]);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 自动同步逻辑：
   * 直接从 enterprises + enterprise_year_records 计算缺失情况，
   * 不依赖 data_push_records 是否已写入，实现真正的实时自动同步。
   * 同时从 data_push_records 读取已有的推送状态作为补充信息。
   */
  const fetchMissingEnterprises = async () => {
    // 1. 获取所有企业
    const { data: enterprises, error: entError } = await supabase
      .from('enterprises')
      .select('id, name, credit_code')
      .order('name');
    if (entError) throw entError;
    if (!enterprises || enterprises.length === 0) {
      setEnterpriseList([]);
      return;
    }

    // 2. 获取所有年度记录（只取已填报的，用于判断哪些年度有数据）
    const { data: yearRecords, error: yrError } = await supabase
      .from('enterprise_year_records')
      .select('enterprise_id, year, status');
    if (yrError) throw yrError;

    // 3. 获取 data_push_records 中已有的推送状态（补充信息）
    const { data: pushRecords } = await supabase
      .from('data_push_records')
      .select('enterprise_id, missing_year, push_status, pushed_at, completed_at, missing_fields_count, id');

    // 对 pushRecords 去重：同一企业+年度只保留最新一条
    const pushMap = new Map<string, any>();
    (pushRecords || []).forEach((item: any) => {
      const key = `${item.enterprise_id}_${item.missing_year}`;
      if (!pushMap.has(key)) {
        pushMap.set(key, item);
      } else {
        const existing = pushMap.get(key);
        if (item.id > existing.id) {
          pushMap.set(key, item);
        }
      }
    });

    // 4. 构建"已填报"集合：enterprise_id + year
    const filledSet = new Set<string>();
    (yearRecords || []).forEach((r: any) => {
      if (r.status === '已填报') {
        filledSet.add(`${r.enterprise_id}_${r.year}`);
      }
    });

    // 5. 对每家企业、每个年度，判断是否缺失
    const result: EnterpriseYearlyMissing[] = [];

    for (const ent of enterprises) {
      const missingYears: YearMissingRecord[] = [];

      for (const year of availableYears) {
        const isFilled = filledSet.has(`${ent.id}_${year}`);
        if (!isFilled) {
          // 从 pushRecords 中查找该企业该年度的推送状态
          const pushKey = `${ent.id}_${year}`;
          const pushRecord = pushMap.get(pushKey);

          missingYears.push({
            missing_year: year,
            push_status: pushRecord?.push_status ?? 'pending',
            pushed_at: pushRecord?.pushed_at ?? null,
            completed_at: pushRecord?.completed_at ?? null,
            missing_fields_count: pushRecord?.missing_fields_count ?? 0,
          });
        }
      }

      if (missingYears.length === 0) continue;

      const completedYears = missingYears.filter(r => r.push_status === 'completed').length;

      // 只显示尚未全部补充完成的企业
      if (completedYears >= missingYears.length) continue;

      result.push({
        enterprise_id: ent.id,
        enterprise_name: ent.name,
        credit_code: ent.credit_code,
        yearRecords: missingYears.sort((a, b) => b.missing_year - a.missing_year),
        totalMissingYears: missingYears.length,
        completedYears,
      });
    }

    setEnterpriseList(result);
  };

  const fetchDishonestEnterprises = async () => {
    const { data: dishonestData, error: dishonestError } = await supabase
      .from('dishonest_enterprises')
      .select('*')
      .order('marked_at', { ascending: false });

    if (dishonestError) throw dishonestError;

    if (!dishonestData || dishonestData.length === 0) {
      setDishonestEnterprises([]);
      return;
    }

    const enterpriseIds = [...new Set(dishonestData.map((d: any) => d.enterprise_id))];
    const { data: enterprisesData, error: entError } = await supabase
      .from('enterprises')
      .select('id, name, credit_code')
      .in('id', enterpriseIds);

    if (entError) throw entError;

    const enterpriseMap = new Map((enterprisesData || []).map((e: any) => [e.id, e]));

    const list = dishonestData.map((item: any) => {
      const ent = enterpriseMap.get(item.enterprise_id) as any;
      return {
        id: item.id,
        enterprise_id: item.enterprise_id,
        enterprise_name: ent?.name || '未知企业',
        credit_code: ent?.credit_code || '-',
        reason: item.reason,
        punishment_measures: item.punishment_measures,
        marked_by: item.marked_by,
        marked_at: item.marked_at,
        status: item.status,
      };
    });

    setDishonestEnterprises(list);
  };

  // 按年度筛选后的企业列表
  const filteredEnterpriseList = selectedYear === 'all'
    ? enterpriseList
    : enterpriseList.filter(entry =>
        entry.yearRecords.some(r => r.missing_year === selectedYear && r.push_status !== 'completed')
      );

  // 分页数据
  const totalPages = Math.max(1, Math.ceil(filteredEnterpriseList.length / PAGE_SIZE));
  const pagedEnterpriseList = filteredEnterpriseList.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // 年度筛选变化时重置页码
  const handleYearChange = (year: number | 'all') => {
    setSelectedYear(year);
    setCurrentPage(1);
  };

  const toggleExpand = (enterpriseId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(enterpriseId)) next.delete(enterpriseId);
      else next.add(enterpriseId);
      return next;
    });
  };

  const handleMarkDishonest = (entry: EnterpriseYearlyMissing) => {
    setSelectedEnterprise({ id: entry.enterprise_id, name: entry.enterprise_name, credit_code: entry.credit_code });
    setMarkModalOpen(true);
  };

  const handleSaveMarkDishonest = async (data: { reason: string; measures: string }) => {
    if (!selectedEnterprise) return;

    try {
      const { error } = await supabase
        .from('dishonest_enterprises')
        .insert([{
          enterprise_id: selectedEnterprise.id,
          reason: data.reason,
          punishment_measures: data.measures,
          marked_by: '系统管理员',
          marked_at: new Date().toISOString(),
          status: 'active',
        }]);

      if (error) throw error;

      await supabase.from('punishment_records').insert([{
        enterprise_id: selectedEnterprise.id,
        record_type: '标记失信',
        record_content: `标记为失信企业，原因：${data.reason}`,
        record_date: new Date().toISOString(),
      }]);

      setMarkModalOpen(false);
      await fetchData();
    } catch (error) {
      console.error('标记失败:', error);
    }
  };

  const handleViewRecords = (enterprise: DishonestEnterprise) => {
    setSelectedEnterprise({
      id: enterprise.enterprise_id,
      name: enterprise.enterprise_name,
      credit_code: enterprise.credit_code,
    });
    setRecordsModalOpen(true);
  };

  const getOverallStatus = (entry: EnterpriseYearlyMissing) => {
    if (entry.completedYears === entry.totalMissingYears) {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">全部已补充</span>;
    }
    return <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700">补充中</span>;
  };

  const getPunishmentStatusBadge = (status: string) => {
    if (status === 'active') {
      return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">惩戒中</span>;
    }
    return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-500">已解除</span>;
  };

  const handleRevokeConfirm = async () => {
    if (!revokeConfirmId) return;
    setRevokeLoading(true);
    try {
      const { error } = await supabase
        .from('dishonest_enterprises')
        .update({ status: 'inactive' })
        .eq('id', revokeConfirmId);
      if (error) throw error;

      const enterprise = dishonestEnterprises.find(e => e.id === revokeConfirmId);
      if (enterprise) {
        await supabase.from('punishment_records').insert([{
          enterprise_id: enterprise.enterprise_id,
          record_type: '解除惩戒',
          record_content: '已解除失信惩戒状态',
          record_date: new Date().toISOString(),
        }]);
      }

      setRevokeConfirmId(null);
      await fetchDishonestEnterprises();
    } catch (error) {
      console.error('解除惩戒失败:', error);
    } finally {
      setRevokeLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">联合惩戒管理</h1>
        <p className="text-sm text-gray-500 mt-1">自动同步年度数据缺失企业，标记失信企业</p>
      </div>

      {/* Tab 切换 */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {(['missing', 'dishonest'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
                activeTab === tab ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'missing' ? `数据缺失企业（${enterpriseList.length}）` : `失信企业列表（${dishonestEnterprises.length}）`}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600"></div>}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-3xl text-gray-400 animate-spin"></i>
            </div>
          ) : activeTab === 'missing' ? (
            <>
              {/* 工具栏：年度筛选 */}
              <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <i className="ri-calendar-line text-gray-400 text-sm"></i>
                    <span className="text-sm text-gray-500">按年度筛选：</span>
                  </div>
                  <select
                    value={selectedYear}
                    onChange={e => handleYearChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="text-sm border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 cursor-pointer"
                  >
                    <option value="all">全部年度</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year} 年</option>
                    ))}
                  </select>
                  {selectedYear !== 'all' && (
                    <span className="text-xs text-teal-600 bg-teal-50 border border-teal-200 px-2 py-1 rounded-full">
                      {selectedYear} 年度缺失企业
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    共 {filteredEnterpriseList.length} 家企业
                    {selectedYear !== 'all' && enterpriseList.length !== filteredEnterpriseList.length && (
                      <span className="text-gray-300 ml-1">（全部 {enterpriseList.length} 家）</span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-teal-600 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-full">
                    <i className="ri-refresh-line text-xs"></i>
                    <span>实时同步</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">企业名称</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">统一社会信用代码</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">缺失年度</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">缺失年数</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pagedEnterpriseList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                          <i className="ri-file-list-3-line text-4xl mb-2 block"></i>
                          <p className="text-sm">
                            {selectedYear !== 'all' ? `${selectedYear} 年度暂无数据缺失企业` : '暂无数据缺失企业'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      pagedEnterpriseList.map(entry => {
                        const isExpanded = expandedRows.has(entry.enterprise_id);
                        // 主行缺失年度标签：按年度筛选时只显示该年度
                        const displayRecords = selectedYear === 'all'
                          ? entry.yearRecords.filter(r => r.push_status !== 'completed')
                          : entry.yearRecords.filter(r => r.missing_year === selectedYear && r.push_status !== 'completed');
                        const years = displayRecords.map(r => r.missing_year).sort((a, b) => b - a);

                        return (
                          <Fragment key={entry.enterprise_id}>
                            <tr
                              className="hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => toggleExpand(entry.enterprise_id)}
                            >
                              <td className="px-4 py-4 text-center">
                                <div className="w-5 h-5 flex items-center justify-center">
                                  <i className={`text-gray-400 text-sm transition-transform duration-200 ${isExpanded ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'}`}></i>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <i className="ri-building-2-line text-teal-600 text-sm"></i>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900">{entry.enterprise_name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                                {entry.credit_code}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-1">
                                  {years.map(y => (
                                    <span key={y} className="px-2 py-0.5 text-xs rounded bg-orange-50 text-orange-600 border border-orange-200 whitespace-nowrap">
                                      {y}年
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="text-sm font-semibold text-gray-800">{entry.totalMissingYears}</span>
                                <span className="text-xs text-gray-400 ml-1">年</span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm" onClick={e => e.stopPropagation()}>
                                {hasEditPermission && (
                                  <button
                                    onClick={() => handleMarkDishonest(entry)}
                                    className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors whitespace-nowrap"
                                  >
                                    <i className="ri-alert-line mr-1"></i>
                                    标记失信
                                  </button>
                                )}
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr key={`${entry.enterprise_id}-detail`}>
                                <td colSpan={6} className="px-0 py-0 bg-gray-50 border-b border-gray-200">
                                  <div className="px-16 py-3">
                                    <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">历年缺失数据明细</p>
                                    <div className="grid grid-cols-1 gap-2">
                                      {(selectedYear === 'all'
                                        ? entry.yearRecords
                                        : entry.yearRecords.filter(r => r.missing_year === selectedYear)
                                      )
                                        .sort((a, b) => b.missing_year - a.missing_year)
                                        .map(record => (
                                          <div
                                            key={record.missing_year}
                                            className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
                                          >
                                            <div className="flex items-center gap-4">
                                              <div className="w-16 text-center">
                                                <span className="text-sm font-bold text-gray-800">{record.missing_year}</span>
                                                <span className="text-xs text-gray-400 ml-0.5">年</span>
                                              </div>
                                              <div className="h-4 w-px bg-gray-200"></div>
                                              <div className="flex items-center gap-1.5">
                                                <i className="ri-error-warning-line text-orange-400 text-sm"></i>
                                                <span className="text-xs text-gray-600">数据未填报</span>
                                              </div>
                                              {record.completed_at && (
                                                <>
                                                  <div className="h-4 w-px bg-gray-200"></div>
                                                  <span className="text-xs text-green-600">
                                                    <i className="ri-check-line mr-0.5"></i>
                                                    补充于 {new Date(record.completed_at).toLocaleDateString('zh-CN')}
                                                  </span>
                                                </>
                                              )}
                                            </div>
                                            <div>
                                              {record.push_status === 'completed' && (
                                                <span className="text-xs text-green-600 flex items-center gap-1">
                                                  <i className="ri-checkbox-circle-line"></i>已完成
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* 翻页器 */}
              {filteredEnterpriseList.length > 0 && (
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    第 {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredEnterpriseList.length)} 条，共 {filteredEnterpriseList.length} 条
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-md text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="ri-skip-left-line"></i>
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-md text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="ri-arrow-left-s-line"></i>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                      .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === '...' ? (
                          <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">…</span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => setCurrentPage(item as number)}
                            className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors ${
                              currentPage === item
                                ? 'bg-teal-600 text-white font-medium'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {item}
                          </button>
                        )
                      )}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-md text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="ri-arrow-right-s-line"></i>
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-md text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="ri-skip-right-line"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">企业名称</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">统一社会信用代码</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">失信原因</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">标记人</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">标记时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">惩戒状态</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dishonestEnterprises.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        <i className="ri-shield-check-line text-4xl mb-2 block"></i>
                        <p className="text-sm">暂无失信企业</p>
                      </td>
                    </tr>
                  ) : (
                    dishonestEnterprises.map(enterprise => (
                      <tr key={enterprise.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <i className="ri-building-2-line text-red-500 text-sm"></i>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{enterprise.enterprise_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                          {enterprise.credit_code}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 max-w-md line-clamp-2">{enterprise.reason}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{enterprise.marked_by}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(enterprise.marked_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{getPunishmentStatusBadge(enterprise.status)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleViewRecords(enterprise)}
                              className="text-teal-600 hover:text-teal-800 whitespace-nowrap cursor-pointer"
                            >
                              <i className="ri-file-list-line mr-1"></i>查看记录
                            </button>
                            {enterprise.status === 'active' && hasEditPermission && (
                              <button
                                onClick={() => setRevokeConfirmId(enterprise.id)}
                                className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <i className="ri-shield-check-line mr-1"></i>解除惩戒
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 解除惩戒确认弹窗 */}
      {revokeConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">确认解除惩戒</h2>
              <button onClick={() => setRevokeConfirmId(null)} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-shield-check-line text-amber-600 text-xl"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-700 font-medium mb-1">确定要解除该企业的失信惩戒吗？</p>
                  <p className="text-xs text-gray-500">解除后，该企业惩戒状态将变更为"已解除"，操作记录将被保存。</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setRevokeConfirmId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleRevokeConfirm}
                disabled={revokeLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                {revokeLoading ? (
                  <><i className="ri-loader-4-line animate-spin mr-1"></i>处理中...</>
                ) : (
                  <><i className="ri-shield-check-line mr-1"></i>确认解除</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {markModalOpen && selectedEnterprise && (
        <MarkDishonestModal enterprise={selectedEnterprise} onClose={() => setMarkModalOpen(false)} onSave={handleSaveMarkDishonest} />
      )}
      {recordsModalOpen && selectedEnterprise && (
        <PunishmentRecordsModal enterprise={selectedEnterprise} onClose={() => setRecordsModalOpen(false)} />
      )}
    </div>
  );
}
