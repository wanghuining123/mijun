import { useState } from "react";

export interface IndicatorData {
  name: string;
  value: number;
  unit: string;
  change: number;
  isAbnormal: boolean;
  industryRank?: number | null;
  totalIndustries?: number | null;
}

interface IndicatorCardProps {
  data: IndicatorData;
  loading: boolean;
  onClick: () => void;
}

export default function IndicatorCard({ data, loading, onClick }: IndicatorCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
        <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-16"></div>
      </div>
    );
  }

  const isPositive = data.change >= 0;
  const changeColor = isPositive ? "text-green-600" : "text-red-600";
  const changeIcon = isPositive ? "ri-arrow-up-line" : "ri-arrow-down-line";

  const hasRank = data.industryRank != null && data.totalIndustries != null && data.totalIndustries > 1;
  const rankColor =
    data.industryRank === 1
      ? "bg-yellow-50 text-yellow-700 border-yellow-200"
      : data.industryRank != null && data.industryRank <= 3
      ? "bg-orange-50 text-orange-700 border-orange-200"
      : data.industryRank != null && data.totalIndustries != null && data.industryRank > data.totalIndustries - 2
      ? "bg-red-50 text-red-600 border-red-200"
      : "bg-teal-50 text-teal-700 border-teal-200";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        bg-white rounded-lg p-5 border-2 transition-all cursor-pointer relative
        ${data.isAbnormal ? "border-red-500 bg-red-50/30" : "border-gray-200"}
        ${isHovered ? "shadow-lg scale-[1.02]" : "shadow-sm"}
      `}
    >
      {/* 行业排名标签 */}
      {hasRank && (
        <div className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${rankColor}`}>
          <i className="ri-bar-chart-horizontal-line text-xs"></i>
          第 {data.industryRank} / {data.totalIndustries}
        </div>
      )}

      {/* 异常警示标签 */}
      {data.isAbnormal && (
        <div className="flex items-center gap-1 text-xs text-red-600 font-medium mb-2">
          <i className="ri-error-warning-line"></i>
          <span>异常预警</span>
        </div>
      )}

      {/* 指标名称 */}
      <div className={`text-sm text-gray-600 mb-2 flex items-center justify-between ${hasRank ? 'pr-20' : ''}`}>
        <span>{data.name}</span>
        {!hasRank && <i className="ri-arrow-right-s-line text-gray-400"></i>}
      </div>

      {/* 指标数值 */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-semibold text-gray-800">
          {data.value.toFixed(2)}
        </span>
        <span className="text-sm text-gray-500">{data.unit}</span>
      </div>

      {/* 同比变化 */}
      <div className={`flex items-center gap-1 text-sm font-medium ${changeColor}`}>
        <i className={changeIcon}></i>
        <span>同比 {Math.abs(data.change).toFixed(1)}%</span>
      </div>
    </div>
  );
}
