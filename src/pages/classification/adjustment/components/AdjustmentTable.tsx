interface YearData {
  year: number;
  comprehensive_score: number | null;
  classification_grade: string | null;
  record_id: string | null;
}

interface EnterpriseRow {
  enterprise_id: string;
  enterprise_name: string;
  industry: string;
  is_continuous_d: boolean;
  yearData: Record<number, YearData>;
  latestGrade: string | null;
}

interface AdjustmentTableProps {
  enterprises: EnterpriseRow[];
  selectedYears: number[];
  onAdjust: (enterpriseId: string, year: number) => void;
  onViewHistory: (enterpriseId: string, enterpriseName: string) => void;
  canEdit?: boolean;
}

export default function AdjustmentTable({
  enterprises,
  selectedYears,
  onAdjust,
  onViewHistory,
  canEdit = false,
}: AdjustmentTableProps) {
  const sortedYears = [...selectedYears].sort((a, b) => a - b);

  const getGradeBadgeClass = (grade: string | null) => {
    switch (grade) {
      case "A": return "bg-green-100 text-green-700 border-green-200";
      case "B": return "bg-cyan-100 text-cyan-700 border-cyan-200";
      case "C": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "D": return "bg-red-100 text-red-700 border-red-200";
      default:  return "bg-gray-100 text-gray-400 border-gray-200";
    }
  };

  // 统计最新年度各等级数量
  const latestYear = sortedYears[sortedYears.length - 1];
  const gradeStats = { A: 0, B: 0, C: 0, D: 0 };
  enterprises.forEach((e) => {
    const g = e.yearData[latestYear]?.classification_grade;
    if (g && g in gradeStats) gradeStats[g as keyof typeof gradeStats]++;
  });
  const continuousDCount = enterprises.filter((e) => e.is_continuous_d).length;

  return (
    <div className="space-y-4">
      {/* 统计概览 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">企业总数</span>
            <span className="text-lg font-semibold text-gray-800">{enterprises.length}</span>
            <span className="text-sm text-gray-500">家</span>
          </div>
          <div className="h-4 w-px bg-gray-300"></div>
          <span className="text-xs text-gray-500">{latestYear}年最新等级：</span>
          {(["A","B","C","D"] as const).map((g) => (
            <div key={g} className="flex items-center gap-1.5">
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getGradeBadgeClass(g)}`}>{g}类</span>
              <span className="text-sm font-medium text-gray-700">{gradeStats[g]}</span>
            </div>
          ))}
          {continuousDCount > 0 && (
            <>
              <div className="h-4 w-px bg-gray-300"></div>
              <div className="flex items-center gap-1.5">
                <i className="ri-alert-line text-red-600 text-sm"></i>
                <span className="text-sm text-red-600 font-medium">连续三年D类：{continuousDCount} 家</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 历年数据表格 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                  企业名称
                </th>
                {sortedYears.map((year) => (
                  <th
                    key={year}
                    className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[160px]"
                    colSpan={2}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{year}年</span>
                      <div className="flex gap-3 text-gray-400 font-normal normal-case">
                        <span>综合得分</span>
                        <span>分类等级</span>
                      </div>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[180px]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enterprises.map((enterprise) => {
                // 找最新有数据的年份用于"调整分类"按钮
                const latestDataYear = [...sortedYears].reverse().find(
                  (y) => enterprise.yearData[y]?.record_id
                );
                return (
                  <tr key={enterprise.enterprise_id} className="hover:bg-gray-50 transition-colors">
                    {/* 企业名称 */}
                    <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 leading-snug">
                          {enterprise.enterprise_name}
                        </span>
                        {enterprise.is_continuous_d && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-50 text-red-600 text-xs rounded border border-red-200 whitespace-nowrap">
                            <i className="ri-alert-line text-xs"></i>重点监管
                          </span>
                        )}
                      </div>
                    </td>
                    {/* 各年度数据 */}
                    {sortedYears.map((year) => {
                      const yd = enterprise.yearData[year];
                      const hasData = yd && yd.classification_grade !== null;
                      return (
                        <>
                          <td key={`${year}-score`} className="px-3 py-3 text-center text-sm text-gray-700">
                            {hasData ? (
                              <span className="font-medium">{yd.comprehensive_score?.toFixed(2) ?? "—"}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td key={`${year}-grade`} className="px-3 py-3 text-center">
                            {hasData ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${getGradeBadgeClass(yd.classification_grade)}`}>
                                  {yd.classification_grade}类
                                </span>
                                {yd.record_id && canEdit && (
                                  <button
                                    onClick={() => onAdjust(enterprise.enterprise_id, year)}
                                    className="text-xs text-gray-400 hover:text-gray-700 transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    调整
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs">无数据</span>
                            )}
                          </td>
                        </>
                      );
                    })}
                    {/* 操作 */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {latestDataYear && canEdit && (
                          <button
                            onClick={() => onAdjust(enterprise.enterprise_id, latestDataYear)}
                            className="px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded hover:bg-gray-700 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <i className="ri-edit-line mr-1"></i>调整分类
                          </button>
                        )}
                        <button
                          onClick={() => onViewHistory(enterprise.enterprise_id, enterprise.enterprise_name)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <i className="ri-history-line mr-1"></i>调整记录
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
