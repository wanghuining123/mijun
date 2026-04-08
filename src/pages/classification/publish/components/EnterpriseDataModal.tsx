import { useState, useEffect } from "react";
import { supabase } from "../../../../lib/supabase";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface EnterpriseDataModalProps {
  enterpriseId: string;
  enterpriseName: string;
  year: number;
  grade: string;
  score: number;
  onClose: () => void;
}

interface YearRecord {
  own_land_area: number | null;
  rent_land_area: number | null;
  lease_land_area: number | null;
  own_building_area: number | null;
  rent_building_area: number | null;
  lease_building_area: number | null;
  floor_area_ratio: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  sales_revenue: number | null;
  industrial_output: number | null;
  industrial_added_value: number | null;
  total_profit: number | null;
  industrial_electricity: number | null;
  total_energy_consumption: number | null;
  pollutant_emission: number | null;
  rd_expenditure: number | null;
  avg_employee_count: number | null;
  industry_code: string | null;
  scale_type: string | null;
  comprehensive_score: number | null;
  classification_grade: string | null;
  updated_at: string | null;
  [key: string]: string | number | null;
}

interface MetricItem {
  key: string;
  label: string;
  unit: string;
  formula: string;
  value: number | null;
  avgValue: number;
  score: number;
  belowAvg: boolean;
}

const GRADE_CONFIG = {
  A: { label: "A类", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  B: { label: "B类", color: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-200", dot: "bg-cyan-500" },
  C: { label: "C类", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
  D: { label: "D类", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500" },
};

const BASE_FIELD_NAME_MAP: Record<string, string> = {
  '自有土地面积': 'own_land_area',
  '承租土地面积': 'rent_land_area',
  '租赁土地面积': 'lease_land_area',
  '自有房屋面积': 'own_building_area',
  '承租房屋面积': 'rent_building_area',
  '租赁房屋面积': 'lease_building_area',
  '容积率': 'floor_area_ratio',
  '销售收入': 'sales_revenue',
  '工业总产值': 'industrial_output',
  '工业增加值': 'industrial_added_value',
  '利润总额': 'total_profit',
  '利润': 'total_profit',
  '工业用电量': 'industrial_electricity',
  '综合能耗': 'total_energy_consumption',
  '污染物排放量': 'pollutant_emission',
  '研发经费支出': 'rd_expenditure',
  '年平均职工人数': 'avg_employee_count',
  '税收总额': 'total_profit',
};

const PORTRAIT_INDICATOR_NAMES = [
  '米均销售收入',
  '米均工业产值',
  '米均增加值',
  '米均利润',
  '米均研发投入',
  '米均从业人数',
];

function calcFormulaValue(
  formula: string,
  record: Record<string, unknown>,
  fieldNameMap: Record<string, string>
): number | null {
  try {
    let expr = formula;
    expr = expr.replace(/\{([^}]+)\}/g, (_, fieldName: string) => {
      const col = fieldNameMap[fieldName.trim()];
      if (!col) return '0';
      const val = record[col];
      return val !== null && val !== undefined ? String(Number(val)) : '0';
    });
    const sortedKeys = Object.keys(fieldNameMap).sort((a, b) => b.length - a.length);
    for (const cnName of sortedKeys) {
      if (expr.includes(cnName)) {
        const col = fieldNameMap[cnName];
        const val = record[col];
        const numVal = val !== null && val !== undefined ? Number(val) : 0;
        expr = expr.split(cnName).join(String(numVal));
      }
    }
    expr = expr.trim();
    if (!expr || expr === '') return null;
    if (!/^[\d\s+\-*/().]+$/.test(expr)) return null;
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)() as number;
    if (!isFinite(result) || isNaN(result)) return null;
    return result;
  } catch {
    return null;
  }
}

function fmt(val: number | null | undefined, unit = "", decimals = 2): string {
  if (val === null || val === undefined) return "—";
  return `${Number(val).toFixed(decimals)}${unit ? " " + unit : ""}`;
}

// ── 雷达图自定义 Tooltip ──────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{d.label}</p>
      <p className="text-gray-600">
        本企业：
        <span className={d.belowAvg ? 'text-red-500 font-bold' : 'text-teal-600 font-bold'}>
          {d.rawValue != null ? d.rawValue.toFixed(3) : '-'} {d.unit}
        </span>
      </p>
      <p className="text-gray-500">行业均值：{d.avgValue.toFixed(3)} {d.unit}</p>
      <p className="text-gray-400 text-xs mt-1">得分：{d.score.toFixed(1)} / 100</p>
    </div>
  );
};

// ── 雷达图自定义角度轴标签 ────────────────────────────────────────────────────
const CustomAngleLabel = (props: any) => {
  const { x, y, cx, cy, payload, metrics } = props;
  const metric = metrics?.find((m: MetricItem) => m.label === payload.value);
  const belowAvg = metric?.belowAvg ?? false;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = dist > 0 ? dx / dist : 0;
  const ny = dist > 0 ? dy / dist : 0;
  const offset = 18;
  const lx = x + nx * offset;
  const ly = y + ny * offset;
  return (
    <g>
      <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={belowAvg ? 700 : 400} fill={belowAvg ? '#ef4444' : '#374151'}>
        {payload.value}
      </text>
      {belowAvg && (
        <text x={lx} y={ly + 14} textAnchor="middle" fontSize={9} fill="#ef4444">▼低于均值</text>
      )}
    </g>
  );
};

export default function EnterpriseDataModal({
  enterpriseId,
  enterpriseName,
  year,
  grade,
  score,
  onClose,
}: EnterpriseDataModalProps) {
  const [activeTab, setActiveTab] = useState<"data" | "indicators">("data");

  // ── 填报数据 Tab 状态 ─────────────────────────────────────────────────────
  const [record, setRecord] = useState<YearRecord | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [industryName, setIndustryName] = useState<string>("");
  const [scaleLabel, setScaleLabel] = useState<string>("");
  const [extraFields, setExtraFields] = useState<{ code: string; name: string; unit: string }[]>([]);

  // ── 指标 Tab 状态 ─────────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [loadingIndicators, setLoadingIndicators] = useState(false);
  const [indicatorSource, setIndicatorSource] = useState<string>('');
  const [expandedFormulas, setExpandedFormulas] = useState<Record<string, boolean>>({});
  const [showAllFormulas, setShowAllFormulas] = useState(false);
  const [noLandData, setNoLandData] = useState(false);
  const [indicatorsLoaded, setIndicatorsLoaded] = useState(false);

  const gradeCfg = GRADE_CONFIG[grade as keyof typeof GRADE_CONFIG];

  // ── 加载填报数据 ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const { data, error } = await supabase
          .from("enterprise_year_records")
          .select("*")
          .eq("enterprise_id", enterpriseId)
          .eq("year", year)
          .maybeSingle();

        if (!error && data) {
          setRecord(data as YearRecord);
          if (data.industry_code) {
            const { data: dictItem } = await supabase
              .from("dictionary_items")
              .select("name")
              .eq("code", data.industry_code)
              .maybeSingle();
            if (dictItem) setIndustryName(dictItem.name);
          }
          if (data.scale_type) {
            const { data: scaleItem } = await supabase
              .from("dictionary_items")
              .select("name")
              .eq("code", data.scale_type)
              .maybeSingle();
            if (scaleItem) setScaleLabel(scaleItem.name);
          }
        }
        const { data: fields } = await supabase
          .from("dictionary_fields")
          .select("code, name, unit")
          .eq("group_name", "其他信息")
          .eq("status", "enabled")
          .order("sort_order", { ascending: true });
        if (fields) setExtraFields(fields);
      } catch (e) {
        console.error("加载企业年度数据失败:", e);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [enterpriseId, year]);

  // ── 加载指标数据（切换到指标Tab时懒加载）────────────────────────
  const loadIndicators = async () => {
    if (indicatorsLoaded) return;
    setLoadingIndicators(true);
    try {
      // 1. 动态字段映射
      const { data: dictFields } = await supabase
        .from('dictionary_fields')
        .select('name, code')
        .not('code', 'is', null)
        .not('name', 'is', null);
      const fieldNameMap: Record<string, string> = { ...BASE_FIELD_NAME_MAP };
      if (dictFields) {
        for (const f of dictFields) {
          if (f.name && f.code) fieldNameMap[f.name] = f.code;
        }
      }

      // 2. 优先读取该企业该年度记录里存储的 template_id（推送时写入）
      const { data: yearRecordMeta } = await supabase
        .from('enterprise_year_records')
        .select('template_id')
        .eq('enterprise_id', enterpriseId)
        .eq('year', year)
        .maybeSingle();

      const recordTemplateId = yearRecordMeta?.template_id ?? null;

      // 3. 确定最终使用的模板：优先用年度记录里的 template_id，其次用激活模板
      let resolvedTemplateId: string | null = recordTemplateId;
      let resolvedTemplateName = '';

      if (resolvedTemplateId) {
        const { data: tmpl } = await supabase
          .from('indicator_templates')
          .select('id, template_name')
          .eq('id', resolvedTemplateId)
          .maybeSingle();
        if (tmpl) {
          resolvedTemplateName = tmpl.template_name;
        } else {
          resolvedTemplateId = null; // 模板已被删除，降级到激活模板
        }
      }

      if (!resolvedTemplateId) {
        const { data: activeTemplate } = await supabase
          .from('indicator_templates')
          .select('id, template_name')
          .eq('is_active', true)
          .maybeSingle();
        if (activeTemplate) {
          resolvedTemplateId = activeTemplate.id;
          resolvedTemplateName = activeTemplate.template_name;
        }
      }

      setIndicatorSource(resolvedTemplateName || '默认配置');

      // 4. 读取指标公式（严格从数据库读取，不使用硬编码兜底）
      let indicatorQuery = supabase
        .from('evaluation_indicators')
        .select('indicator_name, formula, unit, applicable_type')
        .eq('is_enabled', true)
        .in('indicator_name', PORTRAIT_INDICATOR_NAMES);

      if (resolvedTemplateId) {
        indicatorQuery = indicatorQuery.eq('template_id', resolvedTemplateId);
      }

      const { data: indicatorRows } = await indicatorQuery;

      const indicatorDefMap: Record<string, { formula: string; unit: string }> = {};
      if (indicatorRows) {
        for (const row of indicatorRows) {
          if (row.applicable_type === 'below') indicatorDefMap[row.indicator_name] = { formula: row.formula, unit: row.unit || '' };
        }
        for (const row of indicatorRows) {
          if (row.applicable_type === 'above') indicatorDefMap[row.indicator_name] = { formula: row.formula, unit: row.unit || '' };
        }
      }

      // 只使用数据库中读取到的指标，没有配置的指标跳过（不使用硬编码兜底）
      const finalDefs = PORTRAIT_INDICATOR_NAMES
        .filter((name) => indicatorDefMap[name])
        .map((name) => {
          const def = indicatorDefMap[name];
          return { key: name, label: name, formula: def.formula, unit: def.unit };
        });

      if (finalDefs.length === 0) {
        setMetrics([]);
        setNoLandData(false);
        setIndicatorsLoaded(true);
        return;
      }

      // 5. 本企业年度数据
      const { data: rec } = await supabase
        .from('enterprise_year_records')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .eq('year', year)
        .maybeSingle();

      if (!rec) {
        setNoLandData(false);
        setMetrics([]);
        setIndicatorsLoaded(true);
        return;
      }

      // 6. 全部企业数据，计算行业均值（只统计有分类等级的企业）
      const { data: allRecords } = await supabase
        .from('enterprise_year_records')
        .select('*')
        .eq('year', year)
        .not('classification_grade', 'is', null);

      const calcRecord = (r: Record<string, unknown>) =>
        finalDefs.reduce<Record<string, number | null>>((acc, def) => {
          acc[def.key] = def.formula ? calcFormulaValue(def.formula, r, fieldNameMap) : null;
          return acc;
        }, {});

      // 计算本企业指标值
      const myMetrics = calcRecord(rec as Record<string, unknown>);

      // 判断是否所有指标都无法计算（公式分母为0或数据缺失）
      const allNull = Object.values(myMetrics).every((v) => v === null);
      if (allNull) {
        setNoLandData(true);
        setIndicatorsLoaded(true);
        return;
      }

      // 计算行业均值（过滤掉指标值全为null的记录）
      const allMetricsList = (allRecords || [])
        .map((r) => calcRecord(r as Record<string, unknown>))
        .filter((m) => Object.values(m).some((v) => v != null));

      const avgMap: Record<string, number> = {};
      finalDefs.forEach(({ key }) => {
        const vals = allMetricsList.map((m) => m[key]).filter((v): v is number => v != null && isFinite(v));
        avgMap[key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      });

      const result: MetricItem[] = finalDefs.map(({ key, label, unit, formula }) => {
        const myVal = myMetrics[key] ?? null;
        const avg = avgMap[key] ?? 0;
        const maxVal = Math.max(myVal ?? 0, avg, 0.0001);
        const score = myVal != null ? Math.min((myVal / maxVal) * 100, 100) : 0;
        const belowAvg = myVal != null && avg > 0 && myVal < avg;
        return { key, label, unit, formula, value: myVal, avgValue: avg, score, belowAvg };
      });

      setMetrics(result);
      setNoLandData(false);
      setIndicatorsLoaded(true);
    } catch (err) {
      console.error('加载指标数据失败:', err);
    } finally {
      setLoadingIndicators(false);
    }
  };

  const handleTabChange = (tab: "data" | "indicators") => {
    setActiveTab(tab);
    if (tab === "indicators") loadIndicators();
  };

  const toggleFormula = (key: string) => {
    setExpandedFormulas((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllFormulas = () => {
    const next = !showAllFormulas;
    setShowAllFormulas(next);
    const newState: Record<string, boolean> = {};
    metrics.forEach((m) => { newState[m.key] = next; });
    setExpandedFormulas(newState);
  };

  const totalLandArea = (record?.own_land_area || 0) + (record?.rent_land_area || 0) + (record?.lease_land_area || 0);
  const totalBuildingArea = (record?.own_building_area || 0) + (record?.rent_building_area || 0) + (record?.lease_building_area || 0);

  const radarData = metrics.map((m) => ({
    label: m.label,
    score: m.score,
    avgScore: 70,
    rawValue: m.value,
    avgValue: m.avgValue,
    unit: m.unit,
    belowAvg: m.belowAvg,
  }));

  const belowAvgCount = metrics.filter((m) => m.belowAvg).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col"
        style={{ width: 860, maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-50">
              <i className="ri-building-2-line text-teal-600 text-base"></i>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">{enterpriseName}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{year} 年度 · 企业详情</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {gradeCfg && (
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${gradeCfg.bg} ${gradeCfg.color} ${gradeCfg.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${gradeCfg.dot}`}></span>
                {gradeCfg.label} · {score.toFixed(2)} 分
              </div>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-gray-200 px-5 flex-shrink-0 bg-gray-50">
          <button
            onClick={() => handleTabChange("data")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap -mb-px ${
              activeTab === "data"
                ? "border-teal-600 text-teal-700 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <i className="ri-file-list-3-line text-base"></i>
            填报数据
          </button>
          <button
            onClick={() => handleTabChange("indicators")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap -mb-px ${
              activeTab === "indicators"
                ? "border-teal-600 text-teal-700 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <i className="ri-radar-line text-base"></i>
            指标分析
            {metrics.length > 0 && belowAvgCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-semibold">
                {belowAvgCount}项预警
              </span>
            )}
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto">
          {/* ── Tab1: 填报数据 ── */}
          {activeTab === "data" && (
            <div className="p-5">
              {loadingData ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-center">
                    <i className="ri-loader-4-line text-2xl text-teal-600 animate-spin"></i>
                    <p className="text-sm text-gray-400 mt-2">加载中...</p>
                  </div>
                </div>
              ) : !record ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <i className="ri-file-unknow-line text-4xl mb-2"></i>
                  <p className="text-sm">暂无该年度数据</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 基础信息 */}
                  <Section title="基础信息" icon="ri-information-line" color="text-teal-600">
                    <DataRow label="行业" value={industryName || record.industry_code || "—"} />
                    <DataRow label="规上/规下标识" value={scaleLabel || (record.scale_type as string) || "—"} />
                    <DataRow label="评价年度" value={`${year} 年`} />
                    <DataRow label="综合得分" value={record.comprehensive_score !== null ? `${Number(record.comprehensive_score).toFixed(2)} 分` : "—"} highlight />
                    <DataRow label="分类等级" value={gradeCfg ? gradeCfg.label : grade} highlight />
                    {record.updated_at && (
                      <DataRow label="数据更新时间" value={new Date(record.updated_at).toLocaleString("zh-CN")} />
                    )}
                  </Section>

                  {/* 用地信息 */}
                  <Section title="用地信息" icon="ri-map-pin-2-line" color="text-amber-600">
                    <DataRow label="自有土地面积" value={fmt(record.own_land_area, "平方米")} />
                    <DataRow label="承租土地面积" value={fmt(record.rent_land_area, "平方米")} />
                    <DataRow label="出租土地面积" value={fmt(record.lease_land_area, "平方米")} />
                    <DataRow label="合计土地面积" value={totalLandArea > 0 ? `${totalLandArea.toFixed(2)} 平方米` : "—"} highlight />
                    <DataRow label="自有房屋面积" value={fmt(record.own_building_area, "平方米")} />
                    <DataRow label="承租房屋面积" value={fmt(record.rent_building_area, "平方米")} />
                    <DataRow label="出租房屋面积" value={fmt(record.lease_building_area, "平方米")} />
                    <DataRow label="合计房屋面积" value={totalBuildingArea > 0 ? `${totalBuildingArea.toFixed(2)} 平方米` : "—"} highlight />
                    <DataRow label="容积率" value={fmt(record.floor_area_ratio, "")} />
                    <DataRow label="租赁开始日期" value={(record.lease_start_date as string) || "—"} />
                    <DataRow label="租赁结束日期" value={(record.lease_end_date as string) || "—"} />
                  </Section>

                  {/* 经济能耗信息 */}
                  <Section title="经济能耗信息" icon="ri-line-chart-line" color="text-emerald-600">
                    <DataRow label="销售收入" value={fmt(record.sales_revenue, "万元")} />
                    <DataRow label="工业总产值" value={fmt(record.industrial_output, "万元")} />
                    <DataRow label="工业增加值" value={fmt(record.industrial_added_value, "万元")} />
                    <DataRow label="利润总额" value={fmt(record.total_profit, "万元")} />
                    <DataRow label="工业用电量" value={fmt(record.industrial_electricity, "千瓦时")} />
                    <DataRow label="综合能耗" value={fmt(record.total_energy_consumption, "吨标准煤")} />
                    <DataRow label="污染物排放量" value={fmt(record.pollutant_emission, "吨")} />
                    <DataRow label="研发经费支出" value={fmt(record.rd_expenditure, "元")} />
                  </Section>

                  {/* 其他信息（动态字段） */}
                  {extraFields.length > 0 && (
                    <Section title="其他信息" icon="ri-file-list-3-line" color="text-gray-500">
                      {extraFields.map((f) => {
                        const val = record[f.code];
                        const display =
                          val === null || val === undefined || val === ""
                            ? "—"
                            : f.unit
                            ? `${val} ${f.unit}`
                            : String(val);
                        return <DataRow key={f.code} label={f.name} value={display} />;
                      })}
                    </Section>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Tab2: 指标分析 ── */}
          {activeTab === "indicators" && (
            <div className="p-5">
              {loadingIndicators ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-400">正在计算指标数据...</span>
                </div>
              ) : noLandData ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <div className="w-16 h-16 flex items-center justify-center bg-amber-50 rounded-full">
                    <i className="ri-map-pin-line text-3xl text-amber-400"></i>
                  </div>
                  <p className="text-gray-600 font-medium">指标数据无法计算</p>
                  <p className="text-gray-400 text-sm">公式所需的填报数据缺失或为 0，请检查企业填报数据后重试</p>
                </div>
              ) : metrics.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
                  <i className="ri-inbox-line text-5xl"></i>
                  <p className="text-sm">暂无指标数据</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* 顶部操作栏 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {indicatorSource && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-teal-50 border border-teal-200 rounded-full text-xs text-teal-700">
                          <i className="ri-bar-chart-grouped-line"></i>
                          指标来源：{indicatorSource}
                        </div>
                      )}
                      {belowAvgCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 rounded-full text-xs text-red-600">
                          <i className="ri-alarm-warning-line"></i>
                          {belowAvgCount} 项低于行业均值
                        </div>
                      )}
                    </div>
                    <button
                      onClick={toggleAllFormulas}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer whitespace-nowrap ${
                        showAllFormulas
                          ? 'bg-amber-50 border-amber-300 text-amber-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600'
                      }`}
                    >
                      <i className="ri-function-line text-sm"></i>
                      {showAllFormulas ? '收起全部公式' : '展开全部公式'}
                    </button>
                  </div>

                  {/* 雷达图 + 指标明细 */}
                  <div className="grid grid-cols-5 gap-5">
                    {/* 雷达图 */}
                    <div className="col-span-3 bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col items-center">
                      <div className="flex items-center justify-between w-full mb-2">
                        <h4 className="text-sm font-semibold text-gray-700">米均效益雷达图</h4>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-3 h-0.5 bg-teal-500 rounded"></span>
                            本企业
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-3 h-0.5 bg-amber-400 rounded"></span>
                            行业均值基准
                          </span>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={radarData} margin={{ top: 24, right: 48, bottom: 24, left: 48 }}>
                          <PolarGrid stroke="#e5e7eb" />
                          <PolarAngleAxis
                            dataKey="label"
                            tick={(props) => <CustomAngleLabel {...props} metrics={metrics} />}
                          />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} tickCount={4} />
                          <Radar name="行业均值基准" dataKey="avgScore" stroke="#f59e0b" fill="#fef3c7" fillOpacity={0.3} strokeDasharray="4 3" strokeWidth={1.5} />
                          <Radar name="本企业" dataKey="score" stroke="#0d9488" fill="#0d9488" fillOpacity={0.25} strokeWidth={2} dot={{ r: 4, fill: '#0d9488', strokeWidth: 0 }} />
                          <Tooltip content={<CustomTooltip />} />
                        </RadarChart>
                      </ResponsiveContainer>
                      {belowAvgCount > 0 && (
                        <div className="mt-1 w-full flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2">
                          <i className="ri-alarm-warning-line text-red-500 text-sm"></i>
                          <span className="text-xs text-red-600">红色标注的指标低于行业平均水平，建议重点关注提升</span>
                        </div>
                      )}
                    </div>

                    {/* 指标明细列表 */}
                    <div className="col-span-2 flex flex-col gap-2">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-semibold text-gray-700">指标明细</h4>
                        <span className="text-xs text-gray-400">点击 <i className="ri-function-line"></i> 查看公式</span>
                      </div>
                      {metrics.map((m) => {
                        const pct = m.avgValue > 0 && m.value != null ? ((m.value - m.avgValue) / m.avgValue) * 100 : null;
                        const isExpanded = !!expandedFormulas[m.key];
                        return (
                          <div
                            key={m.key}
                            className={`rounded-lg border transition-all ${
                              m.belowAvg ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100 hover:border-teal-200'
                            }`}
                          >
                            <div className="px-3 py-2.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-medium ${m.belowAvg ? 'text-red-700' : 'text-gray-700'}`}>
                                  {m.belowAvg && <i className="ri-error-warning-fill text-red-500 mr-1 text-xs"></i>}
                                  {m.label}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {pct != null && (
                                    <span className={`text-xs font-semibold ${pct >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
                                      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                                    </span>
                                  )}
                                  <button
                                    onClick={() => toggleFormula(m.key)}
                                    title={isExpanded ? '收起公式' : '查看计算公式'}
                                    className={`w-5 h-5 flex items-center justify-center rounded transition-all cursor-pointer ${
                                      isExpanded ? 'bg-amber-100 text-amber-600' : 'text-gray-300 hover:text-amber-500 hover:bg-amber-50'
                                    }`}
                                  >
                                    <i className="ri-function-line text-xs"></i>
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-end justify-between">
                                <span className={`text-sm font-bold ${m.belowAvg ? 'text-red-600' : 'text-gray-800'}`}>
                                  {m.value != null ? m.value.toFixed(3) : '-'}
                                  <span className="text-xs font-normal text-gray-400 ml-1">{m.unit}</span>
                                </span>
                                <span className="text-xs text-gray-400">均值 {m.avgValue.toFixed(3)}</span>
                              </div>
                              <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${m.belowAvg ? 'bg-red-400' : 'bg-teal-500'}`}
                                  style={{ width: `${Math.min(m.score, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="mx-3 mb-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <i className="ri-function-line text-amber-500 text-xs"></i>
                                  <span className="text-xs font-semibold text-amber-700">计算公式</span>
                                  <span className="ml-auto text-xs text-amber-500 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                    来自：{indicatorSource || '默认配置'}
                                  </span>
                                </div>
                                {m.formula ? (
                                  <div className="font-mono text-xs text-amber-800 bg-white/70 rounded px-2 py-1.5 border border-amber-100 leading-relaxed break-all">
                                    {m.label} = {m.formula}
                                  </div>
                                ) : (
                                  <p className="text-xs text-amber-600 italic">暂无公式配置</p>
                                )}
                                <p className="text-xs text-amber-500 mt-1.5 leading-relaxed">
                                  单位：{m.unit || '—'}　·　修改指标体系中的公式后，此处将自动更新
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 底部说明 */}
                  <div className="bg-teal-50 rounded-lg px-4 py-3 flex items-start gap-2">
                    <i className="ri-information-line text-teal-500 text-sm mt-0.5 flex-shrink-0"></i>
                    <p className="text-xs text-teal-700 leading-relaxed">
                      各米均指标的计算公式来源于「{indicatorSource || '指标体系管理'}」中的配置，修改后将自动更新。
                      行业均值基准来自 {year} 年度所有已完成分类评价的企业同口径计算结果。
                      <span className="text-red-500 font-medium ml-1">红色预警</span>表示该指标低于行业平均水平。
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title, icon, color, children,
}: {
  title: string; icon: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200">
        <i className={`${icon} ${color} text-sm`}></i>
        <span className="text-xs font-semibold text-gray-700">{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-gray-200">
        {children}
      </div>
    </div>
  );
}

function DataRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-white">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium ${highlight ? "text-teal-700" : "text-gray-800"}`}>{value}</span>
    </div>
  );
}
