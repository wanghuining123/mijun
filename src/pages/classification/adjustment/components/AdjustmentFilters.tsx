interface IndustryOption {
  code: string;
  name: string;
}

interface AdjustmentFiltersProps {
  availableYears: number[];
  selectedYears: number[];
  onYearsChange: (years: number[]) => void;
  selectedGrade: string;
  onGradeChange: (grade: string) => void;
  selectedIndustry: string;
  onIndustryChange: (industry: string) => void;
  industryOptions: IndustryOption[];
}

export default function AdjustmentFilters({
  availableYears,
  selectedYears,
  onYearsChange,
  selectedGrade,
  onGradeChange,
  selectedIndustry,
  onIndustryChange,
  industryOptions,
}: AdjustmentFiltersProps) {
  const grades = [
    { value: "all", label: "全部等级" },
    { value: "A", label: "A类" },
    { value: "B", label: "B类" },
    { value: "C", label: "C类" },
    { value: "D", label: "D类" },
  ];

  const toggleYear = (year: number) => {
    if (selectedYears.includes(year)) {
      if (selectedYears.length === 1) return; // 至少保留一年
      onYearsChange(selectedYears.filter((y) => y !== year));
    } else {
      onYearsChange([...selectedYears, year].sort((a, b) => a - b));
    }
  };

  const selectAllYears = () => onYearsChange([...availableYears]);

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-start gap-6 flex-wrap">
        {/* 年份列选择 */}
        <div className="flex items-start gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap pt-2">
            展示年份
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => toggleYear(year)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                  selectedYears.includes(year)
                    ? "bg-gray-800 text-white border-gray-800"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
                }`}
              >
                {year}年
              </button>
            ))}
            {availableYears.length > 0 && selectedYears.length < availableYears.length && (
              <button
                onClick={selectAllYears}
                className="px-3 py-1.5 text-xs font-medium rounded-full border border-dashed border-gray-400 text-gray-500 hover:border-gray-600 hover:text-gray-700 transition-all cursor-pointer whitespace-nowrap"
              >
                全选
              </button>
            )}
          </div>
        </div>

        <div className="h-8 w-px bg-gray-200 self-center hidden sm:block"></div>

        {/* 分类等级筛选 */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            最新等级
          </label>
          <select
            value={selectedGrade}
            onChange={(e) => onGradeChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          >
            {grades.map((grade) => (
              <option key={grade.value} value={grade.value}>
                {grade.label}
              </option>
            ))}
          </select>
        </div>

        {/* 行业筛选 */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            行业
          </label>
          <select
            value={selectedIndustry}
            onChange={(e) => onIndustryChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent min-w-[160px]"
          >
            <option value="all">全部行业</option>
            {industryOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
