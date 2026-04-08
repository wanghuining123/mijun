import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import EnterprisePortraitModal from '../../enterprise/components/EnterprisePortraitModal';

interface IndicatorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  indicatorName: string;
  year: number;
  industry: string;
}

interface IndustryData {
  industry: string;
  avgValue: number;
  enterpriseCount: number;
  deviation: number;
}

interface TopEnterprise {
  id: string;
  name: string;
  industry: string;
  value: number;
  rank: number;
}

// 硬编码基础字段映射（中文名 → 数据库列名），与 auto-calc 保持一致
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
      let num = val !== null && val !== undefined ? Number(val) : 0;
      if (YUAN_TO_WAN_FIELDS.has(col)) num = num / 10000;
      return String(num);
    });
    // 再处理不带花括号的中文字段名（按长度降序）
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

export const IndicatorDetailModal = ({
  isOpen,
  onClose,
  indicatorName,
  year,
  industry
}: IndicatorDetailModalProps) => {
  const [loading, setLoading] = useState(true);
  const [industryData, setIndustryData] = useState<IndustryData[]>([]);
  const [topEnterprises, setTopEnterprises] = useState<TopEnterprise[]>([]);
  const [globalAvg, setGlobalAvg] = useState(0);
  const [unit, setUnit] = useState('');
  const [formula, setFormula] = useState('');
  const [indicatorSource, setIndicatorSource] = useState('');
  const [industryNameMap, setIndustryNameMap] = useState<Record<string, string>>({});
  const [portraitEnterprise, setPortraitEnterprise] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchDetailData();
    }
  }, [isOpen, year, industry]);

  const fetchDetailData = async () => {
    try {
      setLoading(true);

      // 1. 获取行业字典映射（code -> name）
      const { data: dictItems } = await supabase
        .from('dictionary_items')
        .select('code, name')
        .eq('field_code', 'industry_code');

      const nameMap: Record<string, string> = {};
      (dictItems || []).forEach((item: any) => {
        nameMap[item.code] = item.name;
      });
      setIndustryNameMap(nameMap);

      // 2. 动态加载字典字段映射，合并到基础映射
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

      // 3. 优先读取该年度企业记录里存储的 template_id（推送时写入）
      let resolvedTemplateId: string | null = null;
      let resolvedTemplateName = '';

      const { data: sampleRecord } = await supabase
        .from('enterprise_year_records')
        .select('template_id')
        .eq('year', year)
        .not('template_id', 'is', null)
        .not('classification_grade', 'is', null)
        .limit(1)
        .maybeSingle();

      if (sampleRecord?.template_id) {
        const { data: tmpl } = await supabase
          .from('indicator_templates')
          .select('id, template_name')
          .eq('id', sampleRecord.template_id)
          .maybeSingle();
        if (tmpl) {
          resolvedTemplateId = tmpl.id;
          resolvedTemplateName = tmpl.template_name;
        }
      }

      // 降级：若年度记录里没有 template_id，则使用当前激活模板
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

      let indicatorFormula = '';
      let indicatorUnit = '';

      if (resolvedTemplateId) {
        // 用 indicator_name 匹配，同一指标可能有 ABOVE/BELOW 两条，取第一条启用的即可
        const { data: indicators } = await supabase
          .from('evaluation_indicators')
          .select('formula, unit')
          .eq('template_id', resolvedTemplateId)
          .eq('indicator_name', indicatorName)
          .eq('is_enabled', true)
          .limit(1);

        if (indicators && indicators.length > 0) {
          indicatorFormula = indicators[0].formula || '';
          indicatorUnit = indicators[0].unit || '';
        }
      }

      setUnit(indicatorUnit);
      setFormula(indicatorFormula);

      // 4. 【全局均值】始终查询全部行业数据，不受 industry 筛选器影响
      const { data: allRecords, error: allError } = await supabase
        .from('enterprise_year_records')
        .select(`*, enterprises!inner(id, name)`)
        .eq('year', year)
        .not('classification_grade', 'is', null);

      if (allError) throw allError;

      // 5. 【当前筛选行业数据】用于展示 Top5 企业
      let filteredRecords = allRecords || [];
      if (industry !== '全部' && industry !== 'all') {
        filteredRecords = (allRecords || []).filter((r: any) => r.industry_code === industry);
      }

      if (!allRecords || allRecords.length === 0 || !indicatorFormula) {
        setIndustryData([]);
        setTopEnterprises([]);
        setGlobalAvg(0);
        return;
      }

      // 6. 计算所有企业的指标值（全部行业，用于全局均值和行业分组）
      const allEnterpriseValues = allRecords.map((record: any) => {
        const value = calcFormulaValue(indicatorFormula, record as Record<string, unknown>, fieldNameMap);
        if (value === null) return null;
        return {
          enterpriseId: record.enterprises.id,
          enterpriseName: record.enterprises.name,
          industryCode: record.industry_code || '',
          value,
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null);

      // 7. 全局均值 = 全部行业所有企业的均值（不受筛选器影响）
      const allValues = allEnterpriseValues.map(e => e.value);
      const globalAverage = allValues.length > 0
        ? allValues.reduce((sum, val) => sum + val, 0) / allValues.length
        : 0;
      setGlobalAvg(globalAverage);

      // 8. 按行业分组计算均值（基于全部行业数据，偏差对比全局均值）
      const industryMap = new Map<string, { values: number[]; count: number }>();
      allEnterpriseValues.forEach(item => {
        const key = item.industryCode;
        if (!industryMap.has(key)) {
          industryMap.set(key, { values: [], count: 0 });
        }
        const info = industryMap.get(key)!;
        info.values.push(item.value);
        info.count++;
      });

      const industryStats: IndustryData[] = Array.from(industryMap.entries()).map(([code, info]) => {
        const avg = info.values.reduce((sum, val) => sum + val, 0) / info.values.length;
        const deviation = globalAverage > 0 ? ((avg - globalAverage) / globalAverage) * 100 : 0;
        return {
          industry: nameMap[code] || code,
          avgValue: avg,
          enterpriseCount: info.count,
          deviation,
        };
      });

      industryStats.sort((a, b) => b.avgValue - a.avgValue);
      setIndustryData(industryStats);

      // 9. Top5 企业：基于当前筛选行业（若选了具体行业则只看该行业，否则全部）
      const filteredValues = filteredRecords.map((record: any) => {
        const value = calcFormulaValue(indicatorFormula, record as Record<string, unknown>, fieldNameMap);
        if (value === null) return null;
        return {
          enterpriseId: record.enterprises.id,
          enterpriseName: record.enterprises.name,
          industryCode: record.industry_code || '',
          value,
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null);

      const sortedEnterprises = [...filteredValues].sort((a, b) => b.value - a.value);
      const top5 = sortedEnterprises.slice(0, 5).map((item, index) => ({
        id: item.enterpriseId,
        name: item.enterpriseName,
        industry: nameMap[item.industryCode] || item.industryCode,
        value: item.value,
        rank: index + 1,
      }));

      setTopEnterprises(top5);
    } catch (err) {
      console.error('获取指标详情失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnterpriseClick = (enterpriseId: string, enterpriseName: string) => {
    setPortraitEnterprise({ id: enterpriseId, name: enterpriseName });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{indicatorName} 行业详情</h2>
            <p className="text-sm text-gray-500 mt-1">
              {year}年度 {industry !== '全部' && industry !== 'all'
                ? `· ${industryNameMap[industry] || industry}`
                : '· 全部行业'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-12 bg-gray-100 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          ) : industryData.length === 0 && topEnterprises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <i className="ri-inbox-line text-5xl mb-3"></i>
              <p className="text-lg">暂无数据</p>
              <p className="text-sm mt-1">当前筛选条件下没有找到相关数据</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* 行业对比表格 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">各行业指标均值对比</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-amber-700 text-xs font-medium">
                      <i className="ri-global-line"></i>
                      全局均值（全行业）
                    </span>
                    <span className="font-semibold text-gray-900">{globalAvg.toFixed(2)}</span>
                    <span>{unit}</span>
                  </div>
                </div>
                {/* 均值释义说明 */}
                <div className="mb-3 bg-teal-50 border border-teal-100 rounded-lg px-4 py-2.5 flex items-start gap-2">
                  <i className="ri-information-line text-teal-500 text-sm mt-0.5 flex-shrink-0"></i>
                  <div className="text-xs text-teal-700 leading-relaxed">
                    <span className="font-semibold">均值释义：</span>
                    各行业均值 = 该行业内所有参与评价企业的{indicatorName}算术平均值；
                    <span className="font-semibold text-amber-700">全局均值 = 全部行业所有企业的总均值（不受行业筛选器影响）</span>，作为横向对比基准。
                    <span className="ml-2 font-semibold">计算公式：</span>
                    {formula ? (
                      <code className="ml-1 font-mono bg-teal-100 px-1.5 py-0.5 rounded text-teal-800">{indicatorName} = {formula}</code>
                    ) : '—'}
                    {indicatorSource && (
                      <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 rounded-full text-teal-700 font-medium">
                        <i className="ri-bar-chart-grouped-line"></i>
                        来源：{indicatorSource}
                      </span>
                    )}
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">排名</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">行业名称</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">均值 ({unit})</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">企业数</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">与全局均值偏差</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {industryData.map((item, index) => {
                        const isCurrentIndustry = industry !== '全部' && industry !== 'all' && (industryNameMap[industry] === item.industry || item.industry === industry);
                        return (
                          <tr key={index} className={`transition-colors ${isCurrentIndustry ? 'bg-teal-50 hover:bg-teal-100' : 'hover:bg-gray-50'}`}>
                            <td className="px-4 py-3 text-sm">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                index === 1 ? 'bg-gray-100 text-gray-600' :
                                index === 2 ? 'bg-orange-100 text-orange-600' :
                                'bg-gray-50 text-gray-500'
                              }`}>
                                {index + 1}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 flex items-center gap-2">
                              {item.industry}
                              {isCurrentIndustry && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full font-medium">
                                  <i className="ri-map-pin-line text-xs"></i>
                                  当前
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                              {item.avgValue.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">{item.enterpriseCount}</td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className={`inline-flex items-center gap-1 ${
                                item.deviation > 0 ? 'text-green-600' : item.deviation < 0 ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                {item.deviation > 0 && <i className="ri-arrow-up-line"></i>}
                                {item.deviation < 0 && <i className="ri-arrow-down-line"></i>}
                                {Math.abs(item.deviation).toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top5企业列表 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Top 5 企业排名
                    {industry !== '全部' && industry !== 'all' && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        （{industryNameMap[industry] || industry}）
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <i className="ri-cursor-line"></i>
                    点击企业名称可查看企业画像
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">排名</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">企业名称</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">所属行业</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          {indicatorName}（{unit}）
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {topEnterprises.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                              item.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                              item.rank === 2 ? 'bg-gray-100 text-gray-700' :
                              item.rank === 3 ? 'bg-orange-100 text-orange-700' :
                              'bg-teal-50 text-teal-700'
                            }`}>
                              {item.rank}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => handleEnterpriseClick(item.id, item.name)}
                              className="text-teal-600 hover:text-teal-700 font-medium hover:underline cursor-pointer flex items-center gap-1 group"
                            >
                              {item.name}
                              <i className="ri-radar-line text-xs opacity-0 group-hover:opacity-100 transition-opacity"></i>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.industry}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                            {item.value.toFixed(2)}
                            <span className="text-xs font-normal text-gray-400 ml-1">{unit}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 企业画像弹窗 */}
      {portraitEnterprise && (
        <EnterprisePortraitModal
          enterpriseId={portraitEnterprise.id}
          enterpriseName={portraitEnterprise.name}
          year={year}
          onClose={() => setPortraitEnterprise(null)}
        />
      )}
    </div>
  );
};
