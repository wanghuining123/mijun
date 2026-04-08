interface PublishFiltersProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
  selectedIndustry: string;
  onIndustryChange: (industry: string) => void;
  industries: { code: string; name: string }[];
  selectedGrade: string;
  onGradeChange: (grade: string) => void;
}

export default function PublishFilters({
  selectedYear,
  onYearChange,
  selectedIndustry,
  onIndustryChange,
  industries,
  selectedGrade,
  onGradeChange,
}: PublishFiltersProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2024 + i);

  const grades = [
    { value: "all", label: "全部等级" },
    { value: "A", label: "A类" },
    { value: "B", label: "B类" },
    { value: "C", label: "C类" },
    { value: "D", label: "D类" },
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center gap-4 flex-wrap">
        {/* 年度选择 */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            年度
          </label>
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}年
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
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
          >
            <option value="all">全部行业</option>
            {industries.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {/* 分类等级筛选 */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            分类等级
          </label>
          <select
            value={selectedGrade}
            onChange={(e) => onGradeChange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
          >
            {grades.map((grade) => (
              <option key={grade.value} value={grade.value}>
                {grade.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
