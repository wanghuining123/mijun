import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface IndustryComparisonData {
  industry: string;
  industryCode: string;
  avgScore: number;
  enterpriseCount: number;
  perMuSalesRevenue: number;
  perMuIndustrialOutput: number;
  perMuAddedValue: number;
  perMuProfit: number;
  perMuRdExpenditure: number;
  perMuEmployeeCount: number;
}

interface UseIndustryComparisonParams {
  year: number;
  refreshKey: number;
}

export const useIndustryComparison = ({ year, refreshKey }: UseIndustryComparisonParams) => {
  const [data, setData] = useState<IndustryComparisonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIndustryComparison();
  }, [year, refreshKey]);

  const fetchIndustryComparison = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. 获取从业人数字段的实际列名
      const { data: employeeField } = await supabase
        .from('dictionary_fields')
        .select('code')
        .eq('name', '从业人数')
        .eq('status', 'enabled')
        .maybeSingle();

      const employeeColumnName = employeeField?.code || 'field_从业人数_mmn9nilg46ep';

      // 2. 获取行业字典映射（code -> name）
      const { data: industryItems } = await supabase
        .from('dictionary_items')
        .select('code, name')
        .eq('field_code', 'industry_code');

      const industryNameMap = new Map<string, string>();
      industryItems?.forEach(item => {
        industryNameMap.set(item.code, item.name);
      });

      // 3. 获取当前年度的企业数据（只统计已有分类等级的记录）
      const { data: yearRecords, error: recordsError } = await supabase
        .from('enterprise_year_records')
        .select(`
          id,
          enterprise_id,
          industry_code,
          sales_revenue,
          industrial_output,
          industrial_added_value,
          total_profit,
          rd_expenditure,
          own_land_area,
          ${employeeColumnName},
          comprehensive_score,
          classification_grade
        `)
        .eq('year', year)
        .not('classification_grade', 'is', null);

      if (recordsError) throw recordsError;

      // 4. 按行业代码分组聚合计算
      const industryMap = new Map<string, {
        records: any[];
        totalScore: number;
        count: number;
      }>();

      yearRecords?.forEach(record => {
        const industryCode = record.industry_code;
        if (!industryCode) return;

        if (!industryMap.has(industryCode)) {
          industryMap.set(industryCode, {
            records: [],
            totalScore: 0,
            count: 0
          });
        }

        const industryData = industryMap.get(industryCode)!;
        industryData.records.push(record);
        industryData.totalScore += record.comprehensive_score || 0;
        industryData.count += 1;
      });

      // 5. 计算每个行业的米均指标均值
      const comparisonData: IndustryComparisonData[] = [];

      industryMap.forEach((industryData, industryCode) => {
        const { records, totalScore, count } = industryData;

        const avgScore = count > 0 ? totalScore / count : 0;

        const perMuSalesRevenue = calculateAverage(records, 'sales_revenue');
        const perMuIndustrialOutput = calculateAverage(records, 'industrial_output');
        const perMuAddedValue = calculateAverage(records, 'industrial_added_value');
        const perMuProfit = calculateAverage(records, 'total_profit');
        const perMuRdExpenditure = calculateAverage(records, 'rd_expenditure');
        const perMuEmployeeCount = calculateAverage(records, employeeColumnName);

        const industryName = industryNameMap.get(industryCode) || industryCode;

        comparisonData.push({
          industry: industryName,
          industryCode,
          avgScore,
          enterpriseCount: count,
          perMuSalesRevenue,
          perMuIndustrialOutput,
          perMuAddedValue,
          perMuProfit,
          perMuRdExpenditure,
          perMuEmployeeCount
        });
      });

      // 6. 按综合得分降序排序
      comparisonData.sort((a, b) => b.avgScore - a.avgScore);

      setData(comparisonData);
    } catch (err) {
      console.error('获取行业对比数据失败:', err);
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const calculateAverage = (records: any[], fieldName: string): number => {
    const validValues: number[] = [];

    records.forEach(record => {
      const landArea = record.own_land_area || 0;
      if (landArea === 0) return;

      const fieldValue = record[fieldName] || 0;
      const perMuValue = fieldValue / landArea;

      if (!isNaN(perMuValue) && isFinite(perMuValue)) {
        validValues.push(perMuValue);
      }
    });

    if (validValues.length === 0) return 0;
    const sum = validValues.reduce((acc, val) => acc + val, 0);
    return sum / validValues.length;
  };

  return {
    data,
    loading,
    error,
    refetch: fetchIndustryComparison
  };
};
