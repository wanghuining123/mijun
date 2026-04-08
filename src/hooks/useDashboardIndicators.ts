import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { IndicatorData } from '../pages/dashboard/components/IndicatorCard';

interface UseIndicatorsParams {
  year: number;
  industry: string;
  refreshKey: number;
}

interface IndicatorFormula {
  name: string;
  code: string;
  formula: string;
  unit: string;
}

// 硬编码基础字段映射（中文名 → 数据库列名）
const BASE_FIELD_NAME_MAP: Record<string, string> = {
  '自有土地面积': 'own_land_area',
  '承租土地面积': 'rent_land_area',
  '租赁土地面积': 'lease_land_area',
  '出租土地面积': 'lease_land_area',
  '自有房屋面积': 'own_building_area',
  '承租房屋面积': 'rent_building_area',
  '租赁房屋面积': 'lease_building_area',
  '出租房屋面积': 'lease_building_area',
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

// 需要单位换算的字段（元 → 万元，除以10000）
const YUAN_TO_WAN_FIELDS = new Set(['rd_expenditure']);

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
      let num = val !== null && val !== undefined ? Number(val) : 0;
      // 元转万元换算
      if (YUAN_TO_WAN_FIELDS.has(col)) num = num / 10000;
      return String(num);
    });

    // 再处理无花括号的字段名（按长度降序避免短名覆盖长名）
    const sortedKeys = Object.keys(fieldNameMap).sort((a, b) => b.length - a.length);
    for (const cnName of sortedKeys) {
      if (expr.includes(cnName)) {
        const col = fieldNameMap[cnName];
        const val = record[col];
        let numVal = val !== null && val !== undefined ? Number(val) : 0;
        if (YUAN_TO_WAN_FIELDS.has(col)) numVal = numVal / 10000;
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

// 六个核心指标名称（固定顺序）
const CORE_INDICATOR_NAMES = [
  '米均销售收入',
  '米均工业产值',
  '米均增加值',
  '米均利润',
  '米均研发投入',
  '米均从业人数',
];

// 兜底公式（当数据库查不到时使用）
const FALLBACK_FORMULAS: IndicatorFormula[] = [
  { name: '米均销售收入', code: 'fallback_01', formula: '销售收入 / 自有土地面积', unit: '万元/亩' },
  { name: '米均工业产值', code: 'fallback_02', formula: '工业总产值 / 自有土地面积', unit: '万元/亩' },
  { name: '米均增加值',   code: 'fallback_03', formula: '工业增加值 / 自有土地面积', unit: '万元/亩' },
  { name: '米均利润',     code: 'fallback_04', formula: '利润总额 / 自有土地面积', unit: '万元/亩' },
  { name: '米均研发投入', code: 'fallback_05', formula: '研发经费支出 / 自有土地面积', unit: '万元/亩' },
  { name: '米均从业人数', code: 'fallback_06', formula: '从业人数 / 自有土地面积', unit: '人/亩' },
];

export const useDashboardIndicators = ({ year, industry, refreshKey }: UseIndicatorsParams) => {
  const [indicators, setIndicators] = useState<IndicatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIndicators();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, industry, refreshKey]);

  const fetchIndicators = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. 动态加载字典字段映射（中文名 → 动态列名）
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
            // 研发经费支出的动态字段也需要换算
            if (f.name === '研发经费支出') {
              YUAN_TO_WAN_FIELDS.add(f.code);
            }
          }
        }
      }

      // 2. 优先从激活模板查公式；没有激活模板则按指标名称从全库查
      let indicatorFormulas: IndicatorFormula[] = [];

      const { data: activeTemplate } = await supabase
        .from('indicator_templates')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      if (activeTemplate) {
        // 有激活模板：从该模板查六个核心指标，每个指标取第一条启用记录
        const { data: dbFormulas } = await supabase
          .from('evaluation_indicators')
          .select('indicator_name, indicator_code, formula, unit')
          .eq('template_id', activeTemplate.id)
          .eq('is_enabled', true)
          .in('indicator_name', CORE_INDICATOR_NAMES);

        if (dbFormulas && dbFormulas.length > 0) {
          // 每个指标名只取一条
          const seen = new Set<string>();
          for (const f of dbFormulas) {
            if (!seen.has(f.indicator_name)) {
              seen.add(f.indicator_name);
              indicatorFormulas.push({
                name: f.indicator_name,
                code: f.indicator_code,
                formula: f.formula || '',
                unit: f.unit || '',
              });
            }
          }
        }
      }

      // 没有激活模板，或激活模板里没有这些指标 → 从全库按名称查（取最新启用的）
      if (indicatorFormulas.length < CORE_INDICATOR_NAMES.length) {
        const foundNames = new Set(indicatorFormulas.map(f => f.name));
        const missingNames = CORE_INDICATOR_NAMES.filter(n => !foundNames.has(n));

        const { data: globalFormulas } = await supabase
          .from('evaluation_indicators')
          .select('indicator_name, indicator_code, formula, unit')
          .eq('is_enabled', true)
          .in('indicator_name', missingNames)
          .not('template_id', 'is', null)
          .order('indicator_name');

        if (globalFormulas && globalFormulas.length > 0) {
          const seen = new Set(indicatorFormulas.map(f => f.name));
          for (const f of globalFormulas) {
            if (!seen.has(f.indicator_name) && f.formula) {
              seen.add(f.indicator_name);
              indicatorFormulas.push({
                name: f.indicator_name,
                code: f.indicator_code,
                formula: f.formula,
                unit: f.unit || '',
              });
            }
          }
        }
      }

      // 仍然缺少的指标用兜底公式补全
      {
        const foundNames = new Set(indicatorFormulas.map(f => f.name));
        for (const fb of FALLBACK_FORMULAS) {
          if (!foundNames.has(fb.name)) {
            indicatorFormulas.push(fb);
          }
        }
      }

      // 按固定顺序排列
      indicatorFormulas = CORE_INDICATOR_NAMES.map(
        name => indicatorFormulas.find(f => f.name === name)!
      ).filter(Boolean);

      // 3. 获取当前筛选行业的企业数据
      const isFiltered = industry !== '全部' && industry !== 'all';

      let currentYearQuery = supabase
        .from('enterprise_year_records')
        .select('*')
        .eq('year', year)
        .not('classification_grade', 'is', null);

      if (isFiltered) {
        currentYearQuery = currentYearQuery.eq('industry_code', industry);
      }

      const { data: currentYearData, error: currentError } = await currentYearQuery;
      if (currentError) throw currentError;

      // 4. 获取上一年度数据（同比）
      let lastYearQuery = supabase
        .from('enterprise_year_records')
        .select('*')
        .eq('year', year - 1)
        .not('classification_grade', 'is', null);

      if (isFiltered) {
        lastYearQuery = lastYearQuery.eq('industry_code', industry);
      }

      const { data: lastYearData } = await lastYearQuery;

      // 5. 若选了具体行业，额外查全部行业数据用于计算行业排名
      let allIndustryData: Record<string, unknown>[] = [];
      if (isFiltered) {
        const { data: allData } = await supabase
          .from('enterprise_year_records')
          .select('*')
          .eq('year', year)
          .not('classification_grade', 'is', null);
        allIndustryData = (allData || []) as Record<string, unknown>[];
      }

      // 6. 计算每个指标的均值及行业排名
      const calculatedIndicators: IndicatorData[] = indicatorFormulas.map(formula => {
        const currentAvg = calculateIndicatorAverage(currentYearData || [], formula, fieldNameMap);
        const lastAvg = calculateIndicatorAverage(lastYearData || [], formula, fieldNameMap);

        const change = lastAvg > 0 ? ((currentAvg - lastAvg) / lastAvg) * 100 : 0;
        const isAbnormal = change < -20;

        let industryRank: number | null = null;
        let totalIndustries: number | null = null;

        if (isFiltered && allIndustryData.length > 0) {
          const industryAvgMap = new Map<string, number>();
          const industryGroupMap = new Map<string, Record<string, unknown>[]>();

          allIndustryData.forEach(record => {
            const code = (record['industry_code'] as string) || '';
            if (!industryGroupMap.has(code)) industryGroupMap.set(code, []);
            industryGroupMap.get(code)!.push(record);
          });

          industryGroupMap.forEach((records, code) => {
            const avg = calculateIndicatorAverage(records, formula, fieldNameMap);
            if (avg > 0) industryAvgMap.set(code, avg);
          });

          const sortedIndustries = Array.from(industryAvgMap.entries())
            .sort((a, b) => b[1] - a[1]);

          totalIndustries = sortedIndustries.length;
          const rankIndex = sortedIndustries.findIndex(([code]) => code === industry);
          if (rankIndex !== -1) {
            industryRank = rankIndex + 1;
          }
        }

        return {
          name: formula.name,
          value: currentAvg,
          unit: formula.unit,
          change,
          isAbnormal,
          industryRank,
          totalIndustries,
        };
      });

      setIndicators(calculatedIndicators);
    } catch (err) {
      console.error('获取指标数据失败:', err);
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const calculateIndicatorAverage = (
    records: Record<string, unknown>[],
    formula: IndicatorFormula,
    fieldNameMap: Record<string, string>
  ): number => {
    if (!records || records.length === 0 || !formula.formula) return 0;

    const validValues: number[] = [];

    records.forEach(record => {
      const value = calcFormulaValue(formula.formula, record, fieldNameMap);
      if (value !== null && isFinite(value) && value > 0) {
        validValues.push(value);
      }
    });

    if (validValues.length === 0) return 0;
    return validValues.reduce((acc, val) => acc + val, 0) / validValues.length;
  };

  return {
    indicators,
    loading,
    error,
    refetch: fetchIndicators,
  };
};