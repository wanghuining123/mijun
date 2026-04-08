import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import AdjustmentFilters from "./components/AdjustmentFilters";
import AdjustmentTable from "./components/AdjustmentTable";
import AdjustmentModal from "./components/AdjustmentModal";
import AdjustmentHistoryModal from "./components/AdjustmentHistoryModal";
import { useAuth } from "../../../contexts/AuthContext";

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
  industry_code: string;
  is_continuous_d: boolean;
  yearData: Record<number, YearData>;
  latestGrade: string | null;
}

interface AdjustmentHistory {
  id: string;
  year: number;
  original_grade: string;
  adjusted_grade: string;
  reason: string;
  adjusted_by: string;
  adjusted_at: string;
}

interface IndustryOption {
  code: string;
  name: string;
}

// 用于调整弹窗的记录结构（兼容 AdjustmentModal）
interface EnterpriseRecord {
  id: string;
  enterprise_id: string;
  enterprise_name: string;
  industry: string;
  comprehensive_score: number;
  classification_grade: string;
  year: number;
  is_continuous_d: boolean;
}

export default function AdjustmentPage() {
  const currentYear = new Date().getFullYear();

  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("all");

  const [allEnterprises, setAllEnterprises] = useState<EnterpriseRow[]>([]);
  const [filteredEnterprises, setFilteredEnterprises] = useState<EnterpriseRow[]>([]);
  const [industryOptions, setIndustryOptions] = useState<IndustryOption[]>([]);
  const [industryMap, setIndustryMap] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [adjustRecord, setAdjustRecord] = useState<EnterpriseRecord | null>(null);
  const [adjustEnterpriseYearData, setAdjustEnterpriseYearData] = useState<Record<number, YearData>>({});
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null);
  const [adjustmentHistory, setAdjustmentHistory] = useState<AdjustmentHistory[]>([]);

  const { canEdit } = useAuth();
  const hasEditPermission = canEdit('classification_adjustment');

  // 从数据字典加载行业选项
  const loadIndustryOptions = useCallback(async () => {
    try {
      const { data: fields } = await supabase
        .from("dictionary_fields")
        .select("code, name")
        .ilike("name", "%行业%")
        .eq("status", "enabled");

      if (!fields || fields.length === 0) return;
      const fieldCode = fields[0].code;

      const { data: items } = await supabase
        .from("dictionary_items")
        .select("code, name")
        .eq("field_code", fieldCode)
        .order("sort_order", { ascending: true });

      const options: IndustryOption[] = (items || []).map((item: any) => ({
        code: item.code,
        name: item.name,
      }));
      setIndustryOptions(options);

      const map: Record<string, string> = {};
      options.forEach((opt) => {
        map[opt.code] = opt.name;
        map[opt.name] = opt.name;
      });
      setIndustryMap(map);
    } catch (error) {
      console.error("加载行业字典失败:", error);
    }
  }, []);

  // 加载所有企业的历年分类记录
  const loadAllRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("enterprise_year_records")
        .select(`
          id,
          enterprise_id,
          year,
          comprehensive_score,
          classification_grade,
          industry_code,
          enterprises (name)
        `)
        .not("classification_grade", "is", null)
        .order("year", { ascending: true });

      if (error) throw error;

      // 按企业聚合
      const enterpriseMap: Record<string, EnterpriseRow> = {};
      const yearsSet = new Set<number>();

      (data || []).forEach((record: any) => {
        const eid = record.enterprise_id;
        yearsSet.add(record.year);

        if (!enterpriseMap[eid]) {
          enterpriseMap[eid] = {
            enterprise_id: eid,
            enterprise_name: record.enterprises?.name || "未知企业",
            industry: record.industry_code || "",
            industry_code: record.industry_code || "",
            is_continuous_d: false,
            yearData: {},
            latestGrade: null,
          };
        }

        enterpriseMap[eid].yearData[record.year] = {
          year: record.year,
          comprehensive_score: record.comprehensive_score,
          classification_grade: record.classification_grade,
          record_id: record.id,
        };
      });

      // 计算最新等级 & 连续三年D类
      const rows = Object.values(enterpriseMap).map((row) => {
        const years = Object.keys(row.yearData).map(Number).sort((a, b) => b - a);
        const latestGrade = years.length > 0 ? row.yearData[years[0]]?.classification_grade ?? null : null;

        // 连续三年D类检测（取最近三年）
        const recentThree = years.slice(0, 3);
        const isContinuousD =
          recentThree.length === 3 &&
          recentThree.every((y) => row.yearData[y]?.classification_grade === "D");

        return { ...row, latestGrade, is_continuous_d: isContinuousD };
      });

      // 可用年份列表（从2024到当前年）
      const allYears: number[] = [];
      for (let y = 2024; y <= currentYear; y++) allYears.push(y);
      // 取实际有数据的年份与范围的交集，若无则用全部
      const dataYears = allYears.filter((y) => yearsSet.has(y));
      const finalYears = dataYears.length > 0 ? dataYears : allYears;

      setAvailableYears(finalYears);
      // 默认展示最近3年（或全部）
      const defaultSelected = finalYears.slice(-3);
      setSelectedYears((prev) => (prev.length > 0 ? prev : defaultSelected));

      setAllEnterprises(rows);
    } catch (error) {
      console.error("加载分类记录失败:", error);
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  useEffect(() => { loadIndustryOptions(); }, [loadIndustryOptions]);
  useEffect(() => { loadAllRecords(); }, [loadAllRecords]);

  // 筛选
  useEffect(() => {
    const latestYear = [...selectedYears].sort((a, b) => b - a)[0];

    let filtered = allEnterprises.filter((row) => {
      // 等级筛选：按最新选中年度的等级
      if (selectedGrade !== "all") {
        const grade = latestYear ? row.yearData[latestYear]?.classification_grade : row.latestGrade;
        if (grade !== selectedGrade) return false;
      }
      // 行业筛选
      if (selectedIndustry !== "all") {
        const selectedName = industryOptions.find((o) => o.code === selectedIndustry)?.name || selectedIndustry;
        const rowName = industryMap[row.industry_code] || row.industry_code;
        if (rowName !== selectedName) return false;
      }
      return true;
    });

    // 按最新年度得分降序
    filtered.sort((a, b) => {
      const sa = latestYear ? (a.yearData[latestYear]?.comprehensive_score ?? -1) : -1;
      const sb = latestYear ? (b.yearData[latestYear]?.comprehensive_score ?? -1) : -1;
      return sb - sa;
    });

    // 将 industry_code 转为名称后传给表格
    const displayRows = filtered.map((row) => ({
      ...row,
      industry: industryMap[row.industry_code] || row.industry_code || "—",
    }));

    setFilteredEnterprises(displayRows);
  }, [allEnterprises, selectedGrade, selectedIndustry, selectedYears, industryMap, industryOptions]);

  // 打开调整弹窗
  const handleAdjust = async (enterpriseId: string, year: number) => {
    const row = allEnterprises.find((e) => e.enterprise_id === enterpriseId);
    if (!row) return;
    const yd = row.yearData[year];
    if (!yd || !yd.record_id) return;

    setAdjustRecord({
      id: yd.record_id,
      enterprise_id: enterpriseId,
      enterprise_name: row.enterprise_name,
      industry: industryMap[row.industry_code] || row.industry_code || "—",
      comprehensive_score: yd.comprehensive_score ?? 0,
      classification_grade: yd.classification_grade ?? "",
      year,
      is_continuous_d: row.is_continuous_d,
    });
    // 保存该企业所有年份数据，供弹窗年份选择使用
    setAdjustEnterpriseYearData(row.yearData);
    setShowAdjustModal(true);
  };

  // 查看调整历史
  const handleViewHistory = async (enterpriseId: string, enterpriseName: string) => {
    setHistoryTarget({ id: enterpriseId, name: enterpriseName });
    try {
      const { data, error } = await supabase
        .from("classification_adjustments")
        .select("*")
        .eq("enterprise_id", enterpriseId)
        .order("adjusted_at", { ascending: false });

      if (error) throw error;
      setAdjustmentHistory(data || []);
      setShowHistoryModal(true);
    } catch (error) {
      console.error("加载调整历史失败:", error);
    }
  };

  // 保存调整
  const handleSaveAdjustment = async (
    adjustedGrade: string,
    reason: string,
    adjustedBy: string,
    year: number,
    recordId: string
  ) => {
    if (!adjustRecord) return;
    try {
      await supabase.from("classification_adjustments").insert({
        enterprise_id: adjustRecord.enterprise_id,
        year,
        original_grade: adjustRecord.classification_grade,
        adjusted_grade: adjustedGrade,
        reason,
        adjusted_by: adjustedBy,
      });

      await supabase
        .from("enterprise_year_records")
        .update({ classification_grade: adjustedGrade })
        .eq("id", recordId);

      await loadAllRecords();
      setShowAdjustModal(false);
    } catch (error) {
      console.error("保存调整失败:", error);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* 页面标题 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-800">动态调整机制</h1>
        <p className="text-sm text-gray-500 mt-1">
          纵览企业历年综合得分与分类等级变化，支持手动调整并查看调整记录
        </p>
      </div>

      {/* 筛选栏 */}
      <AdjustmentFilters
        availableYears={availableYears}
        selectedYears={selectedYears}
        onYearsChange={setSelectedYears}
        selectedGrade={selectedGrade}
        onGradeChange={setSelectedGrade}
        selectedIndustry={selectedIndustry}
        onIndustryChange={setSelectedIndustry}
        industryOptions={industryOptions}
      />

      {/* 企业列表 */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <i className="ri-loader-4-line text-3xl text-gray-400 animate-spin"></i>
              <p className="text-sm text-gray-500 mt-2">加载中...</p>
            </div>
          </div>
        ) : filteredEnterprises.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <i className="ri-file-list-3-line text-5xl text-gray-300"></i>
            <p className="text-gray-500 mt-4">暂无符合条件的分类记录</p>
          </div>
        ) : (
          <AdjustmentTable
            enterprises={filteredEnterprises}
            selectedYears={selectedYears}
            onAdjust={handleAdjust}
            onViewHistory={handleViewHistory}
            canEdit={hasEditPermission}
          />
        )}
      </div>

      {/* 调整弹窗 */}
      {showAdjustModal && adjustRecord && (
        <AdjustmentModal
          record={adjustRecord}
          availableYearData={adjustEnterpriseYearData}
          onClose={() => setShowAdjustModal(false)}
          onSave={handleSaveAdjustment}
        />
      )}

      {/* 历史记录弹窗 */}
      {showHistoryModal && historyTarget && (
        <AdjustmentHistoryModal
          enterpriseName={historyTarget.name}
          history={adjustmentHistory}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}
