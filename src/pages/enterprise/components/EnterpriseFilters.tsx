import { useDictionaryItems } from '../../../hooks/useDictionaryItems';
import type { FilterParams } from "../types";

interface Props {
  selectedYear: number;
  onYearChange: (year: number) => void;
  searchName: string;
  onSearchNameChange: (v: string) => void;
  searchIndustry: string;
  onSearchIndustryChange: (v: string) => void;
  scale: string;
  onScaleChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  onAddNew: () => void;
  onBatchImport: () => void;
  onBatchExport: () => void;
  canEdit?: boolean;
}

export default function EnterpriseFilters({
  selectedYear,
  onYearChange,
  searchName,
  onSearchNameChange,
  searchIndustry,
  onSearchIndustryChange,
  scale,
  onScaleChange,
  status,
  onStatusChange,
  onAddNew,
  onBatchImport,
  onBatchExport,
  canEdit = false,
}: Props) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2024 + i);

  // 从数据库动态读取国标行业字典项，与数据字典保持一致
  const { items: industryItems, loading: industryLoading } = useDictionaryItems('industry_code');

  const handleSearch = () => {
    // 筛选条件已通过受控状态实时同步，无需额外操作
  };

  const handleReset = () => {
    onSearchNameChange("");
    onSearchIndustryChange("");
    onYearChange(currentYear);
    onScaleChange("");
    onStatusChange("");
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      {/* 当前查看年度提示 */}
      <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
        <i className="ri-calendar-line text-blue-600"></i>
        <span className="text-sm text-blue-800">
          当前查看年度：<span className="font-semibold">{selectedYear}年</span>
        </span>
        <span className="text-xs text-blue-600 ml-2">
          （可通过下方年度筛选切换年度）
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            企业名称
          </label>
          <input
            type="text"
            value={searchName}
            onChange={(e) => onSearchNameChange(e.target.value)}
            placeholder="请输入企业名称"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            国标行业
          </label>
          <select
            value={searchIndustry}
            onChange={(e) => onSearchIndustryChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">全部行业</option>
            {industryLoading ? (
              <option disabled>加载中...</option>
            ) : (
              industryItems.map((item) => (
                <option key={item.id} value={item.code}>
                  {item.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            填报年度
          </label>
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            规上/规下标识
          </label>
          <select
            value={scale}
            onChange={(e) => onScaleChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">全部</option>
            <option value="规上">规上</option>
            <option value="规下">规下</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSearch}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-search-line mr-1"></i>
            查询
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-refresh-line mr-1"></i>
            重置
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBatchExport}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-download-line mr-1"></i>
            批量导出
          </button>
          {canEdit && (
            <>
              <button
                onClick={onAddNew}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-add-line mr-1"></i>
                新增企业数据
              </button>
              <button
                onClick={onBatchImport}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-upload-line mr-1"></i>
                批量导入
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
