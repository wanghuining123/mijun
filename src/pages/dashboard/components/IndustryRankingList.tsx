import { useState, useMemo } from 'react';
import { IndustryComparisonData } from '../../../hooks/useIndustryComparison';
import { IndustryRadarChart } from './IndustryRadarChart';

interface IndustryRankingListProps {
  data: IndustryComparisonData[];
  loading: boolean;
  onIndustryClick: (industry: string) => void;
}

type SortField = 'avgScore' | 'perMuSalesRevenue' | 'perMuIndustrialOutput' | 'perMuAddedValue' | 'perMuProfit' | 'perMuRdExpenditure' | 'perMuEmployeeCount';
type SortOrder = 'asc' | 'desc';

export const IndustryRankingList = ({ data, loading, onIndustryClick }: IndustryRankingListProps) => {
  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState<SortField>('avgScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [showRadar, setShowRadar] = useState(false);

  // 筛选和排序
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];
    if (searchText.trim()) {
      result = result.filter(item =>
        item.industry.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    result.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });
    return result;
  }, [data, searchText, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleSelect = (code: string) => {
    setSelectedCodes(prev => {
      if (prev.includes(code)) {
        return prev.filter(c => c !== code);
      }
      if (prev.length >= 2) {
        // 替换最早选的那个
        return [prev[1], code];
      }
      return [...prev, code];
    });
  };

  const selectedItems = useMemo(
    () => selectedCodes.map(code => data.find(d => d.industryCode === code)).filter(Boolean) as IndustryComparisonData[],
    [selectedCodes, data]
  );

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <i className="ri-arrow-up-down-line text-gray-400 ml-1"></i>;
    return sortOrder === 'desc'
      ? <i className="ri-arrow-down-line text-teal-600 ml-1"></i>
      : <i className="ri-arrow-up-line text-teal-600 ml-1"></i>;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* 标题和操作栏 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">行业排名</h3>
            {selectedCodes.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  已选 {selectedCodes.length}/2 个行业
                </span>
                {selectedItems.map(item => (
                  <span
                    key={item.industryCode}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 text-xs rounded-full"
                  >
                    {item.industry}
                    <button
                      onClick={() => handleSelect(item.industryCode)}
                      className="hover:text-teal-900 cursor-pointer ml-0.5"
                    >
                      <i className="ri-close-line text-xs"></i>
                    </button>
                  </span>
                ))}
                {selectedCodes.length === 2 && (
                  <button
                    onClick={() => setShowRadar(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-radar-line"></i>
                    查看对比
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {selectedCodes.length === 0 && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <i className="ri-checkbox-circle-line"></i>
                勾选两行可对比
              </span>
            )}
            <div className="relative">
              <input
                type="text"
                placeholder="搜索行业..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-56 pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            </div>
          </div>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 w-10">
                  <span className="sr-only">选择</span>
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-16">排名</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">行业名称</th>
                <th
                  className="text-right py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:text-teal-600 whitespace-nowrap"
                  onClick={() => handleSort('avgScore')}
                >
                  综合得分 <SortIcon field="avgScore" />
                </th>
                <th
                  className="text-right py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:text-teal-600 whitespace-nowrap"
                  onClick={() => handleSort('perMuSalesRevenue')}
                >
                  米均销售收入 <SortIcon field="perMuSalesRevenue" />
                </th>
                <th
                  className="text-right py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:text-teal-600 whitespace-nowrap"
                  onClick={() => handleSort('perMuIndustrialOutput')}
                >
                  米均产值 <SortIcon field="perMuIndustrialOutput" />
                </th>
                <th
                  className="text-right py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:text-teal-600 whitespace-nowrap"
                  onClick={() => handleSort('perMuProfit')}
                >
                  米均利润 <SortIcon field="perMuProfit" />
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 whitespace-nowrap">企业数</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    <i className="ri-inbox-line text-4xl mb-2"></i>
                    <p>暂无数据</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedData.map((item, index) => {
                  const isSelected = selectedCodes.includes(item.industryCode);
                  const isDisabled = !isSelected && selectedCodes.length >= 2;
                  const selIndex = selectedCodes.indexOf(item.industryCode);

                  return (
                    <tr
                      key={item.industryCode}
                      className={`border-b border-gray-100 transition-colors ${
                        isSelected
                          ? 'bg-teal-50 hover:bg-teal-100'
                          : isDisabled
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-gray-50 cursor-pointer'
                      }`}
                      onClick={() => !isDisabled && onIndustryClick(item.industry)}
                    >
                      {/* 单选框列 */}
                      <td
                        className="py-4 px-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isDisabled) handleSelect(item.industryCode);
                        }}
                      >
                        <div className="w-5 h-5 flex items-center justify-center cursor-pointer">
                          {isSelected ? (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background: selIndex === 0 ? '#0d9488' : '#f59e0b' }}
                            >
                              {selIndex + 1}
                            </div>
                          ) : (
                            <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                              isDisabled ? 'border-gray-200' : 'border-gray-300 hover:border-teal-400'
                            }`}></div>
                          )}
                        </div>
                      </td>

                      {/* 排名 */}
                      <td className="py-4 px-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                      </td>

                      {/* 行业名称 */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{item.industry}</span>
                          {isSelected && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full font-medium text-white"
                              style={{ background: selIndex === 0 ? '#0d9488' : '#f59e0b' }}
                            >
                              对比{selIndex + 1}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-teal-600">{item.avgScore.toFixed(2)}</span>
                        <span className="text-xs text-gray-500 ml-1">分</span>
                      </td>
                      <td className="py-4 px-4 text-right text-gray-700">
                        {item.perMuSalesRevenue.toFixed(2)}
                        <span className="text-xs text-gray-500 ml-1">万元/㎡</span>
                      </td>
                      <td className="py-4 px-4 text-right text-gray-700">
                        {item.perMuIndustrialOutput.toFixed(2)}
                        <span className="text-xs text-gray-500 ml-1">万元/㎡</span>
                      </td>
                      <td className="py-4 px-4 text-right text-gray-700">
                        {item.perMuProfit.toFixed(2)}
                        <span className="text-xs text-gray-500 ml-1">万元/㎡</span>
                      </td>
                      <td className="py-4 px-4 text-right text-gray-600">
                        {item.enterpriseCount}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 底部提示 */}
        {selectedCodes.length === 1 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
            <i className="ri-information-line"></i>
            再勾选一个行业，即可生成雷达对比图
          </div>
        )}
      </div>

      {/* 蛛网图弹窗 */}
      {showRadar && selectedItems.length === 2 && (
        <IndustryRadarChart
          industries={[selectedItems[0], selectedItems[1]]}
          onClose={() => setShowRadar(false)}
        />
      )}
    </>
  );
};
