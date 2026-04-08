import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';

// 硬编码基础字段映射
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

function calcIndicatorValue(
  formula: string,
  yearRecord: Record<string, unknown>,
  fieldNameMap: Record<string, string>
): number | null {
  try {
    let expr = formula;

    expr = expr.replace(/\{([^}]+)\}/g, (_, fieldName: string) => {
      const col = fieldNameMap[fieldName.trim()];
      if (!col) return '0';
      const val = yearRecord[col];
      return val !== null && val !== undefined ? String(Number(val)) : '0';
    });

    const sortedKeys = Object.keys(fieldNameMap).sort((a, b) => b.length - a.length);
    for (const cnName of sortedKeys) {
      if (expr.includes(cnName)) {
        const col = fieldNameMap[cnName];
        const val = yearRecord[col];
        const numVal = val !== null && val !== undefined ? Number(val) : 0;
        expr = expr.split(cnName).join(String(numVal));
      }
    }

    expr = expr.trim();
    if (!expr) return null;
    if (!/^[\d\s+\-*/().]+$/.test(expr)) return null;

    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)() as number;
    if (!isFinite(result) || isNaN(result)) return null;
    return result;
  } catch {
    return null;
  }
}

interface IndicatorScore {
  indicator_code: string;
  indicator_name: string;
  formula: string;
  weight: number;
  unit: string;
  scoring_direction: 'positive' | 'negative';
  rawValue: number | null;
  normalizedScore: number;
  weightedScore: number;
  overrideWeight?: number;
  fieldValues: Record<string, number | null>;
  dataYear: number | null;
}

interface ScoreDetailModalProps {
  open: boolean;
  onClose: () => void;
  enterpriseId: string;
  enterpriseName: string;
  year: number;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  templateId: string;
  ruleId: string;
}

export default function ScoreDetailModal({
  open,
  onClose,
  enterpriseId,
  enterpriseName,
  year,
  score,
  grade,
  templateId,
  ruleId,
}: ScoreDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [indicatorScores, setIndicatorScores] = useState<IndicatorScore[]>([]);
  const [scaleType, setScaleType] = useState<'above' | 'below'>('above');
  const [adjustments, setAdjustments] = useState<{ type: string; value: number; remark: string }[]>([]);

  useEffect(() => {
    if (open && enterpriseId && templateId && ruleId) {
      loadDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, enterpriseId, templateId, ruleId, year]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      // ── 动态加载字典字段映射 ──────────────────────────────────────────
      const { data: dictFields } = await supabase
        .from('dictionary_fields')
        .select('name, code')
        .not('code', 'is', null)
        .not('name', 'is', null);

      const fieldNameMap: Record<string, string> = { ...BASE_FIELD_NAME_MAP };
      if (dictFields) {
        for (const f of dictFields) {
          if (f.name && f.code) {
            fieldNameMap[f.name] = f.code;
          }
        }
      }

      // 获取企业规模
      const { data: enterprise } = await supabase
        .from('enterprises')
        .select('scale')
        .eq('id', enterpriseId)
        .maybeSingle();

      const scale = enterprise?.scale === '规上' ? 'above' : 'below';
      setScaleType(scale);

      // 获取指标列表
      const { data: indicators } = await supabase
        .from('evaluation_indicators')
        .select('indicator_code, indicator_name, weight, unit, applicable_type, formula, scoring_direction')
        .eq('template_id', templateId)
        .eq('is_enabled', true)
        .order('sort_order', { ascending: true });

      // 获取分类规则
      const { data: rule } = await supabase
        .from('classification_rules')
        .select('indicator_overrides')
        .eq('id', ruleId)
        .maybeSingle();

      const overrides: Record<string, number> = rule?.indicator_overrides || {};

      // 获取企业年度数据
      const { data: yearRecord } = await supabase
        .from('enterprise_year_records')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .eq('year', year)
        .maybeSingle();

      // 获取所有企业该年度数据，用于归一化
      const { data: allYearRecords } = await supabase
        .from('enterprise_year_records')
        .select('*')
        .eq('year', year);

      // 加减分项
      const { data: adjItems } = await supabase
        .from('adjustment_items')
        .select('item_type, score_value, remark')
        .eq('enterprise_id', enterpriseId);

      setAdjustments(
        (adjItems || []).map(item => ({
          type: item.item_type || '',
          value: Number(item.score_value) || 0,
          remark: item.remark || '',
        }))
      );

      if (!indicators || !yearRecord) {
        setIndicatorScores([]);
        setLoading(false);
        return;
      }

      const applicableIndicators = indicators.filter(
        ind => ind.applicable_type === scale || ind.applicable_type === 'all'
      );

      // 第一步：计算原始值
      const rawValues: Record<string, number | null> = {};
      for (const ind of applicableIndicators) {
        rawValues[ind.indicator_code] = calcIndicatorValue(
          ind.formula,
          yearRecord as Record<string, unknown>,
          fieldNameMap
        );
      }

      // 第二步：求最大值和最小值
      const indicatorMaxMap: Record<string, number> = {};
      const indicatorMinMap: Record<string, number> = {};
      for (const rec of (allYearRecords || [])) {
        for (const ind of applicableIndicators) {
          const val = calcIndicatorValue(ind.formula, rec as Record<string, unknown>, fieldNameMap);
          if (val !== null) {
            if (val > (indicatorMaxMap[ind.indicator_code] ?? -Infinity)) {
              indicatorMaxMap[ind.indicator_code] = val;
            }
            if (val < (indicatorMinMap[ind.indicator_code] ?? Infinity)) {
              indicatorMinMap[ind.indicator_code] = val;
            }
          }
        }
      }

      // 第三步：归一化并计算加权得分
      const scores: IndicatorScore[] = applicableIndicators.map(ind => {
        const overrideWeight = overrides[ind.indicator_code] !== undefined
          ? overrides[ind.indicator_code]
          : Number(ind.weight);
        const rawVal = rawValues[ind.indicator_code];
        const maxVal = indicatorMaxMap[ind.indicator_code] ?? 0;
        const minVal = indicatorMinMap[ind.indicator_code] ?? 0;
        const isNegative = ind.scoring_direction === 'negative';

        let normalizedScore = 0;
        if (rawVal !== null) {
          if (isNegative) {
            const range = maxVal - minVal;
            normalizedScore = range > 0
              ? Math.min(100, Math.max(0, (1 - (rawVal - minVal) / range) * 100))
              : 100;
          } else {
            normalizedScore = maxVal > 0
              ? Math.min(100, Math.max(0, (rawVal / maxVal) * 100))
              : 0;
          }
        }

        const weightedScore = rawVal !== null ? normalizedScore * overrideWeight : 0;

        // 提取公式中涉及的字段及其实际取值（使用动态映射）
        const fieldValues: Record<string, number | null> = {};
        const sortedKeys = Object.keys(fieldNameMap).sort((a, b) => b.length - a.length);
        for (const cnName of sortedKeys) {
          if (ind.formula && ind.formula.includes(cnName)) {
            const col = fieldNameMap[cnName];
            const val = (yearRecord as Record<string, unknown>)[col];
            fieldValues[cnName] = val !== null && val !== undefined ? Number(val) : null;
          }
        }

        return {
          indicator_code: ind.indicator_code,
          indicator_name: ind.indicator_name,
          formula: ind.formula || '',
          weight: Number(ind.weight),
          unit: ind.unit || '',
          scoring_direction: (ind.scoring_direction as 'positive' | 'negative') || 'positive',
          rawValue: rawVal,
          normalizedScore: Math.round(normalizedScore * 10) / 10,
          weightedScore: Math.round(weightedScore * 10) / 10,
          overrideWeight: overrides[ind.indicator_code] !== undefined ? overrideWeight : undefined,
          fieldValues,
          dataYear: rawVal !== null ? (yearRecord as Record<string, unknown>)['year'] as number : null,
        };
      });

      setIndicatorScores(scores);
    } catch (err) {
      console.error('加载详情失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (g: string) => {
    switch (g) {
      case 'A': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case 'B': return 'bg-teal-100 text-teal-700 border-teal-300';
      case 'C': return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'D': return 'bg-rose-100 text-rose-700 border-rose-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getGradeLabel = (g: string) => {
    switch (g) {
      case 'A': return '优质';
      case 'B': return '良好';
      case 'C': return '一般';
      case 'D': return '待提升';
      default: return '';
    }
  };

  const totalWeightedScore = indicatorScores.reduce((sum, s) => sum + s.weightedScore, 0);
  const totalWeight = indicatorScores.reduce((sum, s) => sum + (s.overrideWeight ?? s.weight), 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-[780px] max-h-[88vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <i className="ri-bar-chart-2-line text-teal-600"></i>
              指标得分明细
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{enterpriseName} · {year}年度</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 flex items-center justify-center rounded-full bg-teal-600 text-white">
                <span className="text-xl font-bold">{score}</span>
              </div>
              <div>
                <p className="text-xs text-gray-500">综合得分</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border mt-1 ${getGradeColor(grade)}`}>
                  {grade}类 · {getGradeLabel(grade)}
                </span>
              </div>
            </div>
            <div className="h-10 w-px bg-gray-200"></div>
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <i className="ri-building-line text-gray-400"></i>
                <span>{scaleType === 'above' ? '规模以上' : '规模以下'}企业</span>
              </div>
              <div className="flex items-center gap-1.5">
                <i className="ri-list-check-2 text-gray-400"></i>
                <span>参与计算指标 <strong className="text-gray-900">{indicatorScores.length}</strong> 项</span>
              </div>
              <div className="flex items-center gap-1.5">
                <i className="ri-scales-line text-gray-400"></i>
                <span>有效权重合计 <strong className="text-gray-900">{Math.round(totalWeight)}</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <i className="ri-loader-4-line text-3xl animate-spin text-teal-500 mb-3"></i>
              <p className="text-sm">正在加载指标明细...</p>
            </div>
          ) : indicatorScores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <i className="ri-file-unknow-line text-4xl mb-3"></i>
              <p className="text-sm">暂无指标数据，该企业可能未填报 {year} 年度数据</p>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <i className="ri-table-line text-teal-500"></i>
                各指标得分明细
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden mb-5">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-8">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">指标名称</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">计分方式</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">数据来源年度</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">指标值</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">标准化得分</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">权重</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">加权得分</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {indicatorScores.map((item, idx) => (
                      <tr key={item.indicator_code} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="font-medium text-gray-900 text-sm leading-snug">{item.indicator_name}</div>
                          {item.formula && (
                            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                <i className="ri-function-line text-[10px]"></i>公式
                              </span>
                              <code className="text-[11px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-mono leading-snug">
                                {item.formula}
                              </code>
                            </div>
                          )}
                          {Object.keys(item.fieldValues).length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {Object.entries(item.fieldValues).map(([field, val]) => (
                                <span
                                  key={field}
                                  className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${
                                    val !== null
                                      ? 'bg-white border-gray-200 text-gray-600'
                                      : 'bg-rose-50 border-rose-200 text-rose-500'
                                  }`}
                                >
                                  <span className="text-gray-400">{field}</span>
                                  <span className="mx-0.5 text-gray-300">·</span>
                                  <span className={`font-medium ${val !== null ? 'text-gray-800' : 'text-rose-400'}`}>
                                    {val !== null ? val.toLocaleString() : '未填报'}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.scoring_direction === 'negative' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                              <i className="ri-arrow-down-line text-[11px]"></i>反向
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                              <i className="ri-arrow-up-line text-[11px]"></i>正向
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.dataYear !== null ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                              <i className="ri-calendar-check-line text-[11px]"></i>
                              {item.dataYear} 年
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.rawValue !== null ? (
                            <span className="text-gray-900 font-medium">
                              {item.rawValue % 1 === 0
                                ? item.rawValue.toLocaleString()
                                : item.rawValue.toFixed(4)}
                              {item.unit && <span className="text-xs text-gray-400 ml-1">{item.unit}</span>}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">未填报</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${item.normalizedScore >= 80 ? 'text-emerald-600' : item.normalizedScore >= 60 ? 'text-teal-600' : item.normalizedScore >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {item.rawValue !== null ? item.normalizedScore : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.overrideWeight !== undefined ? (
                            <span className="flex flex-col items-end gap-0.5">
                              <span className="font-medium text-teal-600">{item.overrideWeight}</span>
                              <span className="text-xs text-gray-400 line-through">{item.weight}</span>
                            </span>
                          ) : (
                            <span className="font-medium text-gray-700">{item.weight}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {item.rawValue !== null ? item.weightedScore : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-gray-700">合计</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{Math.round(totalWeight)}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-teal-700">
                        {Math.round(totalWeightedScore * 10) / 10}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {adjustments.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                    <i className="ri-add-circle-line text-teal-500"></i>加减分项
                  </h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">项目类型</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">分值</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">备注</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {adjustments.map((adj, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-900">{adj.type}</td>
                            <td className="px-4 py-2.5 text-right font-semibold">
                              <span className={adj.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                {adj.value >= 0 ? '+' : ''}{adj.value}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-500 text-xs">{adj.remark || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 px-3 py-2.5 bg-teal-50 rounded-lg text-xs text-teal-700 border border-teal-100">
                <i className="ri-information-line mt-0.5 flex-shrink-0 text-sm"></i>
                <div className="space-y-1 leading-relaxed">
                  <div><strong>正向计分</strong>（值越大越好）：标准化得分 = 指标值 ÷ 同年度所有企业最大值 × 100</div>
                  <div><strong>反向计分</strong>（值越小越好）：标准化得分 = (1 − (指标值 − 最小值) ÷ (最大值 − 最小值)) × 100</div>
                  <div><strong>加权得分</strong> = 标准化得分 × 该指标权重</div>
                  <div><strong>综合得分</strong> = 各指标加权得分之和 ÷ 有效权重合计 × 100</div>
                  {indicatorScores.some(s => s.overrideWeight !== undefined) && (
                    <div>带 <span className="text-teal-600 font-medium">蓝色权重</span> 的指标已被当前分类规则覆盖，原始权重以删除线显示。</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
