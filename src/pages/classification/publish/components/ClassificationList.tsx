import { useState } from "react";
import EnterpriseDataModal from "./EnterpriseDataModal";

interface ClassificationRecord {
  id: string;
  enterprise_id: string;
  enterprise_name: string;
  industry: string;
  industry_code: string;
  comprehensive_score: number;
  classification_grade: string;
  year: number;
  is_above_scale: boolean;
}

interface Policy {
  id: string;
  policy_name: string;
  policy_type: string;
  policy_content: string;
  applicable_grades: string[];
  status: string;
  effective_date: string;
}

interface ClassificationListProps {
  records: ClassificationRecord[];
  policies?: Policy[];
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const POLICY_TYPE_COLOR: Record<string, string> = {
  '用地': 'bg-violet-100 text-violet-700',
  '信贷': 'bg-sky-100 text-sky-700',
  '用能': 'bg-orange-100 text-orange-700',
  '其他': 'bg-gray-100 text-gray-600',
};

export default function ClassificationList({ records, policies = [] }: ClassificationListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [selectedEnterprise, setSelectedEnterprise] = useState<ClassificationRecord | null>(null);

  const totalPages = Math.ceil(records.length / pageSize);
  const pagedRecords = records.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const getGradeBadge = (grade: string) => {
    const config = {
      A: { bg: "bg-emerald-100", text: "text-emerald-700", label: "A类" },
      B: { bg: "bg-cyan-100", text: "text-cyan-700", label: "B类" },
      C: { bg: "bg-yellow-100", text: "text-yellow-700", label: "C类" },
      D: { bg: "bg-red-100", text: "text-red-700", label: "D类" },
    };
    const style = config[grade as keyof typeof config] || {
      bg: "bg-gray-100",
      text: "text-gray-700",
      label: grade,
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text} whitespace-nowrap`}>
        {style.label}
      </span>
    );
  };

  const getGradeStats = () => {
    const stats = { A: 0, B: 0, C: 0, D: 0 };
    records.forEach((record) => {
      if (record.classification_grade in stats) {
        stats[record.classification_grade as keyof typeof stats]++;
      }
    });
    return stats;
  };

  const getPoliciesForGrade = (grade: string) =>
    policies.filter(p => p.applicable_grades.includes(grade) && p.status === 'active');

  const stats = getGradeStats();

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "...")[] = [];
    if (currentPage <= 4) {
      pages.push(1, 2, 3, 4, 5, "...", totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-4">
      {/* 企业年度数据弹窗 */}
      {selectedEnterprise && (
        <EnterpriseDataModal
          enterpriseId={selectedEnterprise.enterprise_id}
          enterpriseName={selectedEnterprise.enterprise_name}
          year={selectedEnterprise.year}
          grade={selectedEnterprise.classification_grade}
          score={selectedEnterprise.comprehensive_score}
          onClose={() => setSelectedEnterprise(null)}
        />
      )}

      {/* 统计概览 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="ri-bar-chart-box-line text-lg text-gray-600"></i>
            <span className="text-sm font-medium text-gray-700">分类统计</span>
          </div>
          <div className="flex items-center gap-6">
            {(['A', 'B', 'C', 'D'] as const).map((g, idx) => {
              const colors = ['text-emerald-600', 'text-cyan-600', 'text-yellow-600', 'text-red-600'];
              return (
                <div key={g} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{g}类</span>
                  <span className={`text-sm font-semibold ${colors[idx]}`}>{stats[g]}</span>
                </div>
              );
            })}
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">总计</span>
              <span className="text-sm font-semibold text-gray-800">{records.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 分类名单表格 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">序号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">企业名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">综合得分</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">分类等级</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">适用差别化政策</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagedRecords.map((record, index) => {
                const gradePolicies = getPoliciesForGrade(record.classification_grade);
                const isExpanded = expandedRow === record.id;
                return (
                  <>
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(currentPage - 1) * pageSize + index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setSelectedEnterprise(record)}
                          className="text-teal-700 hover:text-teal-900 hover:underline cursor-pointer whitespace-nowrap transition-colors"
                        >
                          {record.enterprise_name}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                        {record.comprehensive_score.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getGradeBadge(record.classification_grade)}
                      </td>
                      <td className="px-6 py-4">
                        {gradePolicies.length === 0 ? (
                          <span className="text-xs text-gray-400">暂无配置</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {gradePolicies.slice(0, 3).map(p => (
                              <span
                                key={p.id}
                                className={`px-2 py-0.5 text-xs rounded font-medium whitespace-nowrap ${POLICY_TYPE_COLOR[p.policy_type] || 'bg-gray-100 text-gray-600'}`}
                                title={p.policy_content}
                              >
                                {p.policy_type}·{p.policy_name.length > 8 ? p.policy_name.slice(0, 8) + '…' : p.policy_name}
                              </span>
                            ))}
                            {gradePolicies.length > 3 && (
                              <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-500 whitespace-nowrap">
                                +{gradePolicies.length - 3}项
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {gradePolicies.length > 0 && (
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : record.id)}
                            className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-0.5 cursor-pointer whitespace-nowrap ml-auto"
                          >
                            {isExpanded ? '收起' : '详情'}
                            <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line`}></i>
                          </button>
                        )}
                      </td>
                    </tr>
                    {/* 展开的政策详情行 */}
                    {isExpanded && gradePolicies.length > 0 && (
                      <tr key={`${record.id}-detail`} className="bg-teal-50/40">
                        <td colSpan={6} className="px-6 py-3">
                          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                            {gradePolicies.map(p => (
                              <div key={p.id} className="flex items-start gap-2 bg-white rounded-lg border border-teal-100 px-3 py-2.5">
                                <span className={`flex-shrink-0 mt-0.5 px-1.5 py-0.5 text-xs rounded font-medium ${POLICY_TYPE_COLOR[p.policy_type] || 'bg-gray-100 text-gray-600'}`}>
                                  {p.policy_type}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-gray-800">{p.policy_name}</p>
                                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{p.policy_content}</p>
                                  <p className="text-xs text-gray-400 mt-1">生效日期：{p.effective_date}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 分页栏 */}
        {totalPages > 1 && (
          <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>
                共 <span className="font-medium text-gray-700">{records.length}</span> 条，
                第 <span className="font-medium text-gray-700">{currentPage}</span> / {totalPages} 页
              </span>
              <div className="flex items-center gap-1.5">
                <span>每页</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="border border-gray-300 rounded-md px-2 py-0.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                >
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s} 条</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-md text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <i className="ri-arrow-left-s-line"></i>
              </button>

              {getPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-sm text-gray-400">···</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page as number)}
                    className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors cursor-pointer whitespace-nowrap ${
                      currentPage === page
                        ? "bg-teal-600 text-white font-medium"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-md text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <i className="ri-arrow-right-s-line"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
