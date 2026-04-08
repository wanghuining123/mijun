import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import IndicatorCard from "./components/IndicatorCard";
import { IndustryRankingList } from "./components/IndustryRankingList";
import { IndicatorDetailModal } from "./components/IndicatorDetailModal";
import { GradeStatsCards } from "./components/GradeStatsCards";
import { useDashboardIndicators } from "../../hooks/useDashboardIndicators";
import { useIndustryComparison } from "../../hooks/useIndustryComparison";

export default function DashboardPage() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedIndustry, setSelectedIndustry] = useState<string>("all");
  const [industries, setIndustries] = useState<{ code: string; name: string }[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  const [selectedIndicator, setSelectedIndicator] = useState<{
    name: string;
  } | null>(null);

  const { indicators, loading: indicatorsLoading, error: indicatorsError } = useDashboardIndicators({
    year: selectedYear,
    industry: selectedIndustry === "all" ? "全部" : selectedIndustry,
    refreshKey,
  });

  const { data: industryData, loading: industryLoading } = useIndustryComparison({
    year: selectedYear,
    refreshKey
  });

  const hasAbnormalIndicators = indicators.some(ind => ind.isAbnormal);

  // 获取名单公示发布中实际存在的年份列表
  useEffect(() => {
    const fetchAvailableYears = async () => {
      const { data } = await supabase
        .from("enterprise_year_records")
        .select("year")
        .not("classification_grade", "is", null);

      if (data && data.length > 0) {
        const uniqueYears = Array.from(new Set(data.map(item => item.year))).sort((a, b) => b - a);
        setAvailableYears(uniqueYears);
        setSelectedYear(uniqueYears[0]);
      }
    };
    fetchAvailableYears();
  }, []);

  // 从数据字典加载行业列表，使用 industry_code 字段
  useEffect(() => {
    const fetchIndustries = async () => {
      try {
        const { data: items } = await supabase
          .from("dictionary_items")
          .select("code, name")
          .eq("field_code", "industry_code")
          .order("sort_order", { ascending: true });

        if (items && items.length > 0) {
          setIndustries(items.map((i: any) => ({ code: i.code, name: i.name })));
        }
      } catch (err) {
        console.error("加载行业字典失败:", err);
      }
    };
    fetchIndustries();
  }, []);

  const handleManualRefresh = () => {
    setRefreshKey(prev => prev + 1);
    setLastRefreshTime(new Date());
  };

  const formatRefreshTime = (date: Date) => {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const handleCardClick = (indicatorName: string) => {
    setSelectedIndicator({ name: indicatorName });
  };

  const handleIndustryClick = (industry: string) => {
    // 从 industryData 中找到对应的行业代码
    const found = industryData.find(d => d.industry === industry);
    const industryCode = found ? found.industryCode : industry;
    navigate(`/enterprise?year=${selectedYear}&industry=${encodeURIComponent(industryCode)}`);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 顶部区域 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">数据驾驶舱</h1>
            <p className="text-sm text-gray-500 mt-1">
              实时展示名单公示发布的企业分类评级数据，支撑决策研判
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              最后更新：{formatRefreshTime(lastRefreshTime)}
            </span>
            <button
              onClick={handleManualRefresh}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <i className="ri-refresh-line"></i>
              数据刷新
            </button>
          </div>
        </div>

        {/* 筛选控件 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">年度：</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}年</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">行业：</label>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[200px]"
            >
              <option value="all">全部行业</option>
              {industries.map(item => (
                <option key={item.code} value={item.code}>{item.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-3 py-1.5">
            <i className="ri-links-line"></i>
            <span>数据来源：名单公示发布（已完成分类评级）</span>
          </div>
        </div>
      </div>

      {/* 主体内容区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-6">
          {/* 异常预警提示条 */}
          {hasAbnormalIndicators && !indicatorsLoading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <i className="ri-error-warning-line text-2xl text-red-600"></i>
              <div>
                <div className="text-sm font-medium text-red-800">检测到异常指标</div>
                <div className="text-xs text-red-600 mt-0.5">
                  部分指标同比下降超过阈值，请关注相关行业或企业情况
                </div>
              </div>
            </div>
          )}

          {/* 分类等级统计卡片 */}
          <GradeStatsCards
            year={selectedYear}
            industry={selectedIndustry === "all" ? "全部" : selectedIndustry}
            refreshKey={refreshKey}
          />

          {/* 核心指标卡片区 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <i className="ri-dashboard-line text-teal-600"></i>
              核心指标看板
            </h2>

            {indicatorsError && (
              <div className="text-center py-8 text-red-600 text-sm">
                <i className="ri-error-warning-line text-2xl mb-2"></i>
                <p>{indicatorsError}</p>
              </div>
            )}

            {!indicatorsError && (
              <div className="grid grid-cols-3 gap-4">
                {indicatorsLoading ? (
                  [1, 2, 3, 4, 5, 6].map(i => (
                    <IndicatorCard
                      key={i}
                      data={{ name: '', value: 0, unit: '', change: 0, isAbnormal: false }}
                      loading={true}
                      onClick={() => {}}
                    />
                  ))
                ) : indicators.length > 0 ? (
                  indicators.map((indicator, index) => (
                    <IndicatorCard
                      key={index}
                      data={indicator}
                      loading={false}
                      onClick={() => handleCardClick(indicator.name)}
                    />
                  ))
                ) : (
                  <div className="col-span-3 text-center py-12 text-gray-400">
                    <i className="ri-inbox-line text-4xl mb-2"></i>
                    <p className="text-sm">暂无指标数据</p>
                    <p className="text-xs mt-2 text-gray-400">当前年度名单公示发布中暂无已完成分类评级的企业</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 行业对比区 */}
          <IndustryRankingList
            data={industryData}
            loading={industryLoading}
            onIndustryClick={handleIndustryClick}
          />
        </div>
      </div>

      {/* 数据钻取弹窗 */}
      {selectedIndicator && (
        <IndicatorDetailModal
          isOpen={true}
          onClose={() => setSelectedIndicator(null)}
          indicatorName={selectedIndicator.name}
          year={selectedYear}
          industry={selectedIndustry}
        />
      )}
    </div>
  );
}
