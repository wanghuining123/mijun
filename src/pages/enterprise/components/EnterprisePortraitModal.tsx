import { useState, useEffect } from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { supabase } from '../../../lib/supabase';

interface EnterprisePortraitModalProps {
  enterpriseId: string;
  enterpriseName: string;
  year: number;
  onClose: () => void;
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

// 硬编码基础字段映射（中文名 → 数据库列名），与 auto-calc 保持一致
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

// 米均指标的核心指标名称关键词（用于从指标体系中识别对应指标）
const PORTRAIT_INDICATOR_NAMES = [
  '米均销售收入',
  '米均工业产值',
  '米均增加值',
  '米均利润',
  '米均研发投入',
  '米均从业人数',
];

/**
 * 与 auto-calc 完全一致的公式计算函数
 */
function calcFormulaValue(
  formula: string,
  record: Record<string, unknown>,
  fieldNameMap: Record<string, string>
): number | null {
  try {
    let expr = formula;

    // 先处理 {字段名} 格式
    expr = expr.replace(/\{([^}]+)\}/g, (_, fieldName: string) => {
      const col = fieldNameMap[fieldName.trim()];
      if (!col) return '0';
      const val = record[col];
      return val !== null && val !== undefined ? String(Number(val)) : '0';
    });

    // 再处理不带花括号的中文字段名（按长度降序，避免短名覆盖长名）
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

// 自定义雷达图 Tooltip
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

// 自定义雷达图角度轴标签
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
      <text
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={belowAvg ? 700 : 400}
        fill={belowAvg ? '#ef4444' : '#374151'}
      >
        {payload.value}
      </text>
      {belowAvg && (
        <text
          x={lx}
          y={ly + 16}
          textAnchor="middle"
          fontSize={10}
          fill="#ef4444"
        >
          ▼低于均值
        </text>
      )}
    </g>
  );
};

export default function EnterprisePortraitModal({
  enterpriseId,
  enterpriseName,
  year,
  onClose,
}: EnterprisePortraitModalProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [hasData, setHasData] = useState(true);
  const [noLandData, setNoLandData] = useState(false);
  // 记录本次使用的指标公式来源（用于底部说明）
  const [indicatorSource, setIndicatorSource] = useState<string>('');
  // 公式展开状态：key → boolean
  const [expandedFormulas, setExpandedFormulas] = useState<Record<string, boolean>>({});
  // 是否全部展开公式
  const [showAllFormulas, setShowAllFormulas] = useState(false);

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

  useEffect(() => {
    loadData();
  }, [enterpriseId, year]);

  const loadData = async () => {
    setLoading(true);
    try {
      // ── Step 1: 动态加载字典字段映射 ──────────────────────────────────
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

      // ── Step 2: 优先读取该企业年度记录里存储的 template_id（推送时写入）──
      const { data: yearRecordMeta } = await supabase
        .from('enterprise_year_records')
        .select('template_id')
        .eq('enterprise_id', enterpriseId)
        .eq('year', year)
        .maybeSingle();

      const recordTemplateId = yearRecordMeta?.template_id ?? null;

      // ── Step 3: 确定最终使用的模板：优先用年度记录里的 template_id，其次用激活模板 ──
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

      // ── Step 4: 从确定的模板中读取米均相关指标的公式 ────────────────────
      let indicatorQuery = supabase
        .from('evaluation_indicators')
        .select('indicator_name, formula, unit, applicable_type')
        .eq('is_enabled', true)
        .in('indicator_name', PORTRAIT_INDICATOR_NAMES);

      if (resolvedTemplateId) {
        indicatorQuery = indicatorQuery.eq('template_id', resolvedTemplateId);
      }

      const { data: indicatorRows } = await indicatorQuery;

      // 构建指标定义：name → { formula, unit }
      // 同一指标名可能有 above/below 两条，优先取 above，其次 below
      const indicatorDefMap: Record<string, { formula: string; unit: string }> = {};
      if (indicatorRows) {
        for (const row of indicatorRows) {
          if (row.applicable_type === 'below') {
            indicatorDefMap[row.indicator_name] = { formula: row.formula, unit: row.unit || '' };
          }
        }
        for (const row of indicatorRows) {
          if (row.applicable_type === 'above') {
            indicatorDefMap[row.indicator_name] = { formula: row.formula, unit: row.unit || '' };
          }
        }
      }

      // 只使用数据库中读取到的指标，没有配置的指标跳过（不使用硬编码兜底）
      const finalDefs: Array<{ key: string; label: string; formula: string; unit: string }> =
        PORTRAIT_INDICATOR_NAMES
          .filter((name) => indicatorDefMap[name])
          .map((name) => {
            const def = indicatorDefMap[name];
            return { key: name, label: name, formula: def.formula, unit: def.unit };
          });

      if (finalDefs.length === 0) {
        setHasData(false);
        setLoading(false);
        return;
      }

      // ── Step 5: 获取本企业年度数据 ────────────────────────────────────
      const { data: record, error: recordError } = await supabase
        .from('enterprise_year_records')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .eq('year', year)
        .maybeSingle();

      if (recordError) throw recordError;

      if (!record) {
        setHasData(false);
        setLoading(false);
        return;
      }

      // ── Step 6: 获取同年度所有已完成分类评价的企业数据，计算行业均值 ──
      const { data: allRecords, error: allError } = await supabase
        .from('enterprise_year_records')
        .select('*')
        .eq('year', year)
        .not('classification_grade', 'is', null);

      if (allError) throw allError;

      // ── Step 7: 用指标公式计算每家企业的米均值 ────────────────────────
      const calcRecord = (r: Record<string, unknown>) =>
        finalDefs.reduce<Record<string, number | null>>((acc, def) => {
          acc[def.key] = def.formula
            ? calcFormulaValue(def.formula, r, fieldNameMap)
            : null;
          return acc;
        }, {});

      // 计算本企业指标值
      const myMetrics = calcRecord(record as Record<string, unknown>);

      // 判断是否所有指标都无法计算（公式分母为0或数据缺失）
      const allNull = Object.values(myMetrics).every((v) => v === null);
      if (allNull) {
        setNoLandData(true);
        setLoading(false);
        return;
      }

      const allMetricsList = (allRecords || [])
        .map((r) => calcRecord(r as Record<string, unknown>))
        .filter((m) => Object.values(m).some((v) => v != null));

      // 计算行业均值
      const avgMap: Record<string, number> = {};
      finalDefs.forEach(({ key }) => {
        const vals = allMetricsList
          .map((m) => m[key])
          .filter((v): v is number => v != null && isFinite(v));
        avgMap[key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      });

      // ── Step 8: 构建雷达图数据（含 formula）─────────────────────────────
      const result: MetricItem[] = finalDefs.map(({ key, label, unit, formula }) => {
        const myVal = myMetrics[key] ?? null;
        const avg = avgMap[key] ?? 0;
        const maxVal = Math.max(myVal ?? 0, avg, 0.0001);
        const score = myVal != null ? Math.min((myVal / maxVal) * 100, 100) : 0;
        const belowAvg = myVal != null && avg > 0 && myVal < avg;

        return { key, label, unit, formula, value: myVal, avgValue: avg, score, belowAvg };
      });

      setMetrics(result);
      setHasData(true);
      setNoLandData(false);
    } catch (err) {
      console.error('加载企业画像数据失败:', err);
      setHasData(false);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[860px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-teal-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center bg-teal-100 rounded-lg">
              <i className="ri-radar-line text-teal-600 text-lg"></i>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">企业画像</h3>
              <p className="text-xs text-gray-500 mt-0.5">{enterpriseName} · {year} 年度米均效益分析</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {indicatorSource && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-teal-50 border border-teal-200 rounded-full text-xs text-teal-700">
                <i className="ri-bar-chart-grouped-line"></i>
                指标来源：{indicatorSource}
              </div>
            )}
            {metrics.length > 0 && (
              <button
                onClick={toggleAllFormulas}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer whitespace-nowrap ${
                  showAllFormulas
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600'
                }`}
              >
                <i className="ri-function-line text-sm"></i>
                {showAllFormulas ? '收起公式' : '查看公式'}
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer rounded-lg hover:bg-gray-100 transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-gray-400">正在生成企业画像...</span>
            </div>
          ) : !hasData ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-16 h-16 flex items-center justify-center bg-orange-50 rounded-full">
                <i className="ri-file-warning-line text-3xl text-orange-400"></i>
              </div>
              <p className="text-gray-600 font-medium">该企业 {year} 年度暂无填报数据</p>
              <p className="text-gray-400 text-sm">请先完成数据填报后再查看企业画像</p>
            </div>
          ) : noLandData ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-16 h-16 flex items-center justify-center bg-amber-50 rounded-full">
                <i className="ri-map-pin-line text-3xl text-amber-400"></i>
              </div>
              <p className="text-gray-600 font-medium">指标数据无法计算</p>
              <p className="text-gray-400 text-sm">公式所需的填报数据缺失或为 0，请检查企业填报数据后重试</p>
            </div>
          ) : (
            <div className="p-6">
              {/* 雷达图 + 指标明细 */}
              <div className="grid grid-cols-5 gap-6">
                {/* 雷达图 */}
                <div className="col-span-3 bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col items-center">
                  <div className="flex items-center justify-between w-full mb-3">
                    <h4 className="text-sm font-semibold text-gray-700">米均效益雷达图</h4>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-0.5 bg-teal-500 rounded"></span>
                        本企业
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-0.5 bg-amber-400 rounded border-dashed border-t border-amber-400"></span>
                        行业均值基准
                      </span>
                    </div>
                  </div>
                  <div className="w-full flex justify-center">
                    <ResponsiveContainer width="100%" height={320}>
                      <RadarChart data={radarData} margin={{ top: 24, right: 48, bottom: 24, left: 48 }}>
                        <PolarGrid stroke="#e5e7eb" />
                        <PolarAngleAxis
                          dataKey="label"
                          tick={(props) => (
                            <CustomAngleLabel {...props} metrics={metrics} />
                          )}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, 100]}
                          tick={{ fontSize: 10, fill: '#9ca3af' }}
                          tickCount={4}
                        />
                        <Radar
                          name="行业均值基准"
                          dataKey="avgScore"
                          stroke="#f59e0b"
                          fill="#fef3c7"
                          fillOpacity={0.3}
                          strokeDasharray="4 3"
                          strokeWidth={1.5}
                        />
                        <Radar
                          name="本企业"
                          dataKey="score"
                          stroke="#0d9488"
                          fill="#0d9488"
                          fillOpacity={0.25}
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#0d9488', strokeWidth: 0 }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  {belowAvgCount > 0 && (
                    <div className="mt-2 w-full flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2">
                      <i className="ri-alarm-warning-line text-red-500 text-sm"></i>
                      <span className="text-xs text-red-600">
                        红色标注的指标低于行业平均水平，建议重点关注提升
                      </span>
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
                    const pct =
                      m.avgValue > 0 && m.value != null
                        ? ((m.value - m.avgValue) / m.avgValue) * 100
                        : null;
                    const isExpanded = !!expandedFormulas[m.key];
                    return (
                      <div
                        key={m.key}
                        className={`rounded-lg border transition-all ${
                          m.belowAvg
                            ? 'bg-red-50 border-red-200'
                            : 'bg-white border-gray-100 hover:border-teal-200'
                        }`}
                      >
                        <div className="px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-medium ${m.belowAvg ? 'text-red-700' : 'text-gray-700'}`}>
                              {m.belowAvg && (
                                <i className="ri-error-warning-fill text-red-500 mr-1 text-xs"></i>
                              )}
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
                                  isExpanded
                                    ? 'bg-amber-100 text-amber-600'
                                    : 'text-gray-300 hover:text-amber-500 hover:bg-amber-50'
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
                            <span className="text-xs text-gray-400">
                              均值 {m.avgValue.toFixed(3)}
                            </span>
                          </div>
                          <div className="mt-1.5 bg-gray-100 rounded-full overflow-hidden">
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
              <div className="mt-5 bg-teal-50 rounded-lg px-4 py-3 flex items-start gap-2">
                <i className="ri-information-line text-teal-500 text-sm mt-0.5 flex-shrink-0"></i>
                <p className="text-xs text-teal-700 leading-relaxed">
                  各米均指标的计算公式来源于「{indicatorSource || '指标体系管理'}」中的配置。
                  修改指标体系中的计算公式后，企业画像将自动使用最新公式重新计算。
                  行业均值基准来自 {year} 年度所有已完成分类评价的企业同口径计算结果。
                  <span className="text-red-500 font-medium ml-1">红色预警</span>表示该指标低于行业平均水平。
                  点击指标卡片右上角的 <i className="ri-function-line"></i> 图标可查看该指标的具体计算公式。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm whitespace-nowrap cursor-pointer transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
