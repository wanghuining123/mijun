import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import ScoreDetailModal from './components/ScoreDetailModal';
import SkippedEnterprisesAlert from './components/SkippedEnterprisesAlert';
import { useAuth } from '../../../contexts/AuthContext';

// 硬编码基础字段映射（中文名 → 数据库列名）
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

/**
 * 从年度数据中解析公式，计算指标值
 * fieldNameMap 支持动态传入，包含字典字段
 */
function calcIndicatorValue(
  formula: string,
  yearRecord: Record<string, unknown>,
  fieldNameMap: Record<string, string>
): number | null {
  try {
    let expr = formula;

    // 先处理 {字段名} 格式
    expr = expr.replace(/\{([^}]+)\}/g, (_, fieldName: string) => {
      const col = fieldNameMap[fieldName.trim()];
      if (!col) return '0';
      const val = yearRecord[col];
      return val !== null && val !== undefined ? String(Number(val)) : '0';
    });

    // 再处理不带花括号的中文字段名（按长度降序，避免短名覆盖长名）
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

interface CalculationResult {
  id: string;
  enterpriseName: string;
  score: number;
  baseScore: number;
  adjustmentScore: number;
  grade: 'A' | 'B' | 'C' | 'D';
  year: number;
  calculatedAt: string;
}

interface Enterprise {
  id: string;
  name: string;
  scale: string;
}

type SkipReason = 'no_record' | 'zero_value' | 'protection_period' | 'exempt';

interface SkippedEnterprise extends Enterprise {
  reason: SkipReason;
}

interface IndicatorTemplate {
  id: string;
  template_name: string;
  is_active: boolean;
}

interface ClassificationRuleOption {
  id: string;
  rule_name: string;
  rule_type: 'general' | 'industry';
  industry_type: string;
  division_mode: 'percentage' | 'score';
  grade_a_threshold: number;
  grade_b_threshold: number;
  grade_c_threshold: number;
  grade_d_threshold: number;
  indicator_overrides: Record<string, number> | null;
}

interface EvaluationIndicator {
  id: string;
  indicator_code: string;
  indicator_name: string;
  applicable_type: 'above' | 'below' | 'all';
  weight: number;
  formula: string;
  template_id: string | null;
  scoring_direction: 'positive' | 'negative';
}

export default function AutoCalcPage() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [calcScope, setCalcScope] = useState<'all' | 'selected'>('all');
  const [selectedEnterprises, setSelectedEnterprises] = useState<string[]>([]);
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);

  const [indicatorTemplates, setIndicatorTemplates] = useState<IndicatorTemplate[]>([]);
  const [classificationRules, setClassificationRules] = useState<ClassificationRuleOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');

  const [calculating, setCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [skippedEnterprises, setSkippedEnterprises] = useState<SkippedEnterprise[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'score-desc' | 'score-asc'>('score-desc');

  const [publishLoading, setPublishLoading] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<CalculationResult | null>(null);

  const { canEdit } = useAuth();
  const hasEditPermission = canEdit('evaluation_auto');

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2024 + i);

  useEffect(() => {
    loadEnterprises();
    loadIndicatorTemplates();
    loadClassificationRules();
  }, []);

  const loadEnterprises = async () => {
    const { data } = await supabase
      .from('enterprises')
      .select('id, name, scale')
      .order('name');
    setEnterprises(data || []);
  };

  const loadIndicatorTemplates = async () => {
    const { data } = await supabase
      .from('indicator_templates')
      .select('id, template_name, is_active')
      .order('created_at', { ascending: false });
    if (data) {
      setIndicatorTemplates(data);
      const active = data.find(t => t.is_active);
      if (active) setSelectedTemplateId(active.id);
    }
  };

  const loadClassificationRules = async () => {
    const { data } = await supabase
      .from('classification_rules')
      .select('id, rule_name, rule_type, industry_type, division_mode, grade_a_threshold, grade_b_threshold, grade_c_threshold, grade_d_threshold, indicator_overrides')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (data) {
      setClassificationRules(data as ClassificationRuleOption[]);
      const general = data.find(r => r.rule_type === 'general');
      if (general) setSelectedRuleId(general.id);
    }
  };

  const handleEnterpriseToggle = (enterpriseId: string) => {
    setSelectedEnterprises(prev =>
      prev.includes(enterpriseId)
        ? prev.filter(id => id !== enterpriseId)
        : [...prev, enterpriseId]
    );
  };

  const canCalculate =
    !calculating &&
    selectedTemplateId !== '' &&
    selectedRuleId !== '' &&
    (calcScope === 'all' || selectedEnterprises.length > 0);

  const getDisabledReason = () => {
    if (!selectedTemplateId) return '请先选择指标体系模板';
    if (!selectedRuleId) return '请先选择分类规则';
    if (calcScope === 'selected' && selectedEnterprises.length === 0) return '请至少选择一家企业';
    return '';
  };

  const handleStartCalculation = async () => {
    if (!canCalculate) return;
    setCalculating(true);
    setProgress(0);
    setProgressMsg('正在加载指标和规则配置...');
    setResults([]);
    setSkippedEnterprises([]);

    try {
      // ── 动态加载字典字段映射，合并到基础映射 ──────────────────────────
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

      // 加载指标
      const { data: indicators, error: indErr } = await supabase
        .from('evaluation_indicators')
        .select('*')
        .eq('template_id', selectedTemplateId)
        .eq('is_enabled', true);
      if (indErr) throw indErr;

      // 加载分类规则
      const { data: ruleData, error: ruleErr } = await supabase
        .from('classification_rules')
        .select('*')
        .eq('id', selectedRuleId)
        .maybeSingle();
      if (ruleErr) throw ruleErr;
      const rule = ruleData as ClassificationRuleOption | null;

      setProgressMsg('正在加载特殊企业配置...');
      const { data: protectionData } = await supabase
        .from('protection_period_enterprises')
        .select('enterprise_id')
        .eq('status', 'active');
      const protectionEnterpriseIds = new Set(
        (protectionData || []).map((p: { enterprise_id: string }) => p.enterprise_id)
      );

      const { data: exemptData } = await supabase
        .from('exempt_enterprises')
        .select('enterprise_id');
      const exemptEnterpriseIds = new Set(
        (exemptData || []).map((e: { enterprise_id: string }) => e.enterprise_id)
      );

      const targetEnterprises =
        calcScope === 'all'
          ? enterprises
          : enterprises.filter(e => selectedEnterprises.includes(e.id));

      const totalCount = targetEnterprises.length;

      // ── 第一轮：计算每家企业各指标的原始值 ──────────────────────────
      setProgressMsg('正在读取企业数据...');
      type RawEntry = { enterprise: Enterprise; yearRecord: Record<string, unknown> | null; rawValues: Record<string, number | null> };
      const rawEntries: RawEntry[] = [];

      for (let i = 0; i < targetEnterprises.length; i++) {
        const enterprise = targetEnterprises[i];
        const { data: yearRecord } = await supabase
          .from('enterprise_year_records')
          .select('*')
          .eq('enterprise_id', enterprise.id)
          .eq('year', selectedYear)
          .maybeSingle();

        const scaleType = enterprise.scale === '规上' ? 'above' : 'below';
        const applicableIndicators = (indicators as EvaluationIndicator[] || []).filter(
          ind => ind.applicable_type === scaleType || ind.applicable_type === 'all'
        );

        const rawValues: Record<string, number | null> = {};
        if (yearRecord) {
          for (const ind of applicableIndicators) {
            rawValues[ind.indicator_code] = calcIndicatorValue(
              ind.formula,
              yearRecord as Record<string, unknown>,
              fieldNameMap
            );
          }
        }
        rawEntries.push({ enterprise, yearRecord: yearRecord as Record<string, unknown> | null, rawValues });
        setProgress(Math.round(((i + 1) / totalCount) * 40));
      }

      // ── 第二轮：求各指标最大值和最小值，用于归一化 ──────────────────────────
      setProgressMsg('正在归一化指标数据...');
      const indicatorMaxMap: Record<string, number> = {};
      const indicatorMinMap: Record<string, number> = {};
      for (const entry of rawEntries) {
        if (protectionEnterpriseIds.has(entry.enterprise.id)) continue;
        if (exemptEnterpriseIds.has(entry.enterprise.id)) continue;
        for (const [code, val] of Object.entries(entry.rawValues)) {
          if (val !== null) {
            if (val > (indicatorMaxMap[code] ?? -Infinity)) indicatorMaxMap[code] = val;
            if (val < (indicatorMinMap[code] ?? Infinity)) indicatorMinMap[code] = val;
          }
        }
      }

      // ── 第三轮：计算综合得分 ──────────────────────────────────────────
      const calculationResults: CalculationResult[] = [];

      for (let i = 0; i < rawEntries.length; i++) {
        const { enterprise, yearRecord, rawValues } = rawEntries[i];
        setProgressMsg(`正在计算：${enterprise.name}（${i + 1}/${totalCount}）`);

        if (protectionEnterpriseIds.has(enterprise.id)) {
          setProgress(40 + Math.round(((i + 1) / totalCount) * 55));
          await new Promise(resolve => setTimeout(resolve, 30));
          setSkippedEnterprises(prev => [...prev, { ...enterprise, reason: 'protection_period' }]);
          continue;
        }

        if (exemptEnterpriseIds.has(enterprise.id)) {
          setProgress(40 + Math.round(((i + 1) / totalCount) * 55));
          await new Promise(resolve => setTimeout(resolve, 30));
          setSkippedEnterprises(prev => [...prev, { ...enterprise, reason: 'exempt' }]);
          continue;
        }

        if (!yearRecord) {
          setProgress(40 + Math.round(((i + 1) / totalCount) * 55));
          await new Promise(resolve => setTimeout(resolve, 30));
          setSkippedEnterprises(prev => [...prev, { ...enterprise, reason: 'no_record' }]);
          continue;
        }

        const scaleType = enterprise.scale === '规上' ? 'above' : 'below';
        const applicableIndicators = (indicators as EvaluationIndicator[] || []).filter(
          ind => ind.applicable_type === scaleType || ind.applicable_type === 'all'
        );

        let weightedSum = 0;
        let totalWeight = 0;

        for (const ind of applicableIndicators) {
          const overrideWeight = rule?.indicator_overrides?.[ind.indicator_code] ?? Number(ind.weight);
          const rawVal = rawValues[ind.indicator_code];
          if (rawVal === null || rawVal === undefined) continue;

          const maxVal = indicatorMaxMap[ind.indicator_code] ?? 0;
          const minVal = indicatorMinMap[ind.indicator_code] ?? 0;
          const isNegative = ind.scoring_direction === 'negative';

          let normalizedScore: number;
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

          weightedSum += normalizedScore * overrideWeight;
          totalWeight += overrideWeight;
        }

        if (totalWeight === 0) {
          setProgress(40 + Math.round(((i + 1) / totalCount) * 55));
          await new Promise(resolve => setTimeout(resolve, 30));
          setSkippedEnterprises(prev => [...prev, { ...enterprise, reason: 'zero_value' }]);
          continue;
        }

        const baseScore = Math.round((weightedSum / totalWeight) * 10) / 10;

        const { data: adjItems } = await supabase
          .from('adjustment_items')
          .select('score_value')
          .eq('enterprise_id', enterprise.id);

        const adjustmentScore = (adjItems || []).reduce(
          (sum, item) => sum + Number(item.score_value || 0),
          0
        );
        const adjustmentScoreRounded = Math.round(adjustmentScore * 10) / 10;
        const finalScore = Math.min(100, Math.max(0, Math.round((baseScore + adjustmentScoreRounded) * 10) / 10));

        let grade: 'A' | 'B' | 'C' | 'D' = 'D';
        if (rule && rule.division_mode === 'score') {
          if (finalScore >= rule.grade_a_threshold) grade = 'A';
          else if (finalScore >= rule.grade_b_threshold) grade = 'B';
          else if (finalScore >= rule.grade_c_threshold) grade = 'C';
        } else {
          if (finalScore >= 80) grade = 'A';
          else if (finalScore >= 60) grade = 'B';
          else if (finalScore >= 40) grade = 'C';
        }

        calculationResults.push({
          id: enterprise.id,
          enterpriseName: enterprise.name,
          score: finalScore,
          baseScore,
          adjustmentScore: adjustmentScoreRounded,
          grade,
          year: selectedYear,
          calculatedAt: new Date().toISOString(),
        });

        await supabase
          .from('enterprise_year_records')
          .update({
            comprehensive_score: finalScore,
            classification_grade: grade,
            template_id: selectedTemplateId || null,
            rule_id: selectedRuleId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('enterprise_id', enterprise.id)
          .eq('year', selectedYear);

        setProgress(40 + Math.round(((i + 1) / totalCount) * 55));
        await new Promise(resolve => setTimeout(resolve, 60));
      }

      // 按比例模式：按排名重新划分等级
      if (rule?.division_mode === 'percentage' && calculationResults.length > 0) {
        const sorted = [...calculationResults].sort((a, b) => b.score - a.score);
        const total = sorted.length;
        const aCount = Math.floor((rule.grade_a_threshold / 100) * total);
        const bCount = Math.floor((rule.grade_b_threshold / 100) * total);
        const cCount = Math.floor((rule.grade_c_threshold / 100) * total);
        const dCount = total - aCount - bCount - cCount;

        sorted.forEach((r, idx) => {
          if (idx < aCount) r.grade = 'A';
          else if (idx < aCount + bCount) r.grade = 'B';
          else if (idx < aCount + bCount + cCount) r.grade = 'C';
          else r.grade = 'D';
        });

        for (const sortedItem of sorted) {
          const original = calculationResults.find(r => r.id === sortedItem.id);
          if (original) original.grade = sortedItem.grade;
        }

        for (const r of sorted) {
          await supabase
            .from('enterprise_year_records')
            .update({ classification_grade: r.grade })
            .eq('enterprise_id', r.id)
            .eq('year', selectedYear);
        }

        console.log(`按比例分配：总${total}家 A=${aCount} B=${bCount} C=${cCount} D=${dCount}`);
      }

      setProgress(100);
      setProgressMsg('计算完成！');
      setResults(calculationResults);
    } catch (err) {
      console.error('计算失败:', err);
      alert('计算过程中出现错误，请重试');
    } finally {
      setCalculating(false);
    }
  };

  const handleRecalculate = () => {
    setResults([]);
    setSkippedEnterprises([]);
    setProgress(0);
    setProgressMsg('');
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case 'B': return 'bg-teal-100 text-teal-700 border-teal-300';
      case 'C': return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'D': return 'bg-rose-100 text-rose-700 border-rose-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getGradeLabel = (grade: string) => {
    switch (grade) {
      case 'A': return '优质';
      case 'B': return '良好';
      case 'C': return '一般';
      case 'D': return '待提升';
      default: return '';
    }
  };

  const filteredAndSortedResults = results
    .filter(r => !gradeFilter || r.grade === gradeFilter)
    .sort((a, b) => sortBy === 'score-desc' ? b.score - a.score : a.score - b.score);

  const selectedTemplate = indicatorTemplates.find(t => t.id === selectedTemplateId);
  const selectedRule = classificationRules.find(r => r.id === selectedRuleId);
  const disabledReason = getDisabledReason();

  const handleViewDetail = (result: CalculationResult) => {
    setSelectedResult(result);
    setDetailModalOpen(true);
  };

  const handlePublishToList = async () => {
    setShowPublishConfirm(false);
    setPublishLoading(true);
    setPublishSuccess(false);
    try {
      // 推送时将 template_id 和 rule_id 一并保存到 enterprise_year_records
      for (const result of results) {
        await supabase
          .from('enterprise_year_records')
          .update({
            comprehensive_score: result.score,
            classification_grade: result.grade,
            template_id: selectedTemplateId || null,
            rule_id: selectedRuleId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('enterprise_id', result.id)
          .eq('year', result.year);
      }

      // 写入留痕记录到 operation_audit_logs 表
      const currentTemplate = indicatorTemplates.find(t => t.id === selectedTemplateId);
      const currentRule = classificationRules.find(r => r.id === selectedRuleId);
      const now = new Date().toISOString();

      const { error: insertError } = await supabase
        .from('operation_audit_logs')
        .insert({
          operation_type: 'push',
          operation_year: selectedYear,
          template_id: selectedTemplateId || null,
          template_name: currentTemplate?.template_name || '未知模板',
          rule_id: selectedRuleId || null,
          rule_name: currentRule?.rule_name || '未知规则',
          enterprise_count: results.length,
          operator: '系统管理员',
          operation_time: now,
          created_at: now,
        });

      if (insertError) {
        console.error('留痕写入失败:', insertError);
      }

      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 5000);
    } catch (err) {
      console.error('推送失败:', err);
      alert('推送失败，请重试');
    } finally {
      setPublishLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">自动计算功能</h1>
            <p className="text-sm text-gray-500 mt-1">
              选定指标体系模板和分类规则后，批量计算企业综合得分和分类等级
            </p>
          </div>
          {results.length > 0 && !calculating && (
            <div className="flex items-center gap-3">
              {publishSuccess && (
                <div className="flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 rounded-lg animate-pulse">
                  <i className="ri-checkbox-circle-line text-teal-600"></i>
                  <span className="text-sm text-teal-700 font-medium">已成功推送至名单公示发布！</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                <i className="ri-checkbox-circle-line text-emerald-600"></i>
                <span className="text-sm text-emerald-700 font-medium">
                  已完成 {results.length} 家企业计算
                </span>
              </div>
              {hasEditPermission && (
                <button
                  onClick={() => setShowPublishConfirm(true)}
                  disabled={publishLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                >
                  {publishLoading ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
                  {publishLoading ? '推送中...' : '应用到名单公示发布'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {/* 计算配置区 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">计算配置</h2>
          <p className="text-xs text-gray-400 mb-5">请依次完成以下配置，所有必填项选定后方可开始计算</p>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="text-red-500 mr-1">*</span>指标体系模板
              </label>
              <p className="text-xs text-gray-400 mb-2">选择本次计算使用的指标权重配置方案</p>
              <select
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                disabled={calculating}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${
                  !selectedTemplateId ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
                }`}
              >
                <option value="">— 请选择指标体系模板 —</option>
                {indicatorTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.template_name}{t.is_active ? '（当前激活）' : ''}
                  </option>
                ))}
              </select>
              {selectedTemplate && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-teal-600">
                  <i className="ri-checkbox-circle-line"></i>已选：{selectedTemplate.template_name}
                </div>
              )}
              {!selectedTemplateId && (
                <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                  <i className="ri-error-warning-line"></i>必须选择指标体系模板才能开始计算
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="text-red-500 mr-1">*</span>分类规则
              </label>
              <p className="text-xs text-gray-400 mb-2">选择本次计算使用的等级划分规则</p>
              <select
                value={selectedRuleId}
                onChange={e => setSelectedRuleId(e.target.value)}
                disabled={calculating}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${
                  !selectedRuleId ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
                }`}
              >
                <option value="">— 请选择分类规则 —</option>
                {classificationRules.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.rule_name}
                    {r.rule_type === 'general' ? '（通用）' : `（${r.industry_type}）`}
                    · {r.division_mode === 'percentage' ? '按比例' : '按分值'}
                  </option>
                ))}
              </select>
              {selectedRule && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-teal-600">
                  <i className="ri-checkbox-circle-line"></i>
                  已选：{selectedRule.rule_name}
                  {selectedRule.division_mode === 'percentage'
                    ? `（A:${selectedRule.grade_a_threshold}% / B:${selectedRule.grade_b_threshold}% / C:${selectedRule.grade_c_threshold}% / D:${selectedRule.grade_d_threshold}%）`
                    : `（A≥${selectedRule.grade_a_threshold}分 / B≥${selectedRule.grade_b_threshold}分 / C≥${selectedRule.grade_c_threshold}分）`}
                </div>
              )}
              {!selectedRuleId && (
                <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                  <i className="ri-error-warning-line"></i>必须选择分类规则才能开始计算
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 mb-6"></div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="text-red-500 mr-1">*</span>计算年度
              </label>
              <p className="text-xs text-gray-400 mb-2">选择要计算的数据年度</p>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                disabled={calculating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="text-red-500 mr-1">*</span>计算范围
              </label>
              <p className="text-xs text-gray-400 mb-2">选择全量或指定企业</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCalcScope('all')}
                  disabled={calculating}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                    calcScope === 'all'
                      ? 'bg-teal-600 text-white hover:bg-teal-700 cursor-pointer'
                      : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                  } ${calculating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <i className="ri-building-4-line mr-1"></i>全量企业
                </button>
                <button
                  onClick={() => setCalcScope('selected')}
                  disabled={calculating}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                    calcScope === 'selected'
                      ? 'bg-teal-600 text-white hover:bg-teal-700 cursor-pointer'
                      : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                  } ${calculating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <i className="ri-checkbox-multiple-line mr-1"></i>指定企业
                </button>
              </div>
            </div>
          </div>

          {calcScope === 'selected' && (
            <div className="mt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择企业
                <span className="ml-2 text-sm font-normal text-gray-500">已选 {selectedEnterprises.length} 家</span>
              </label>
              <div className="border border-gray-300 rounded-lg max-h-56 overflow-y-auto">
                {enterprises.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">暂无企业数据</div>
                ) : (
                  enterprises.map(enterprise => (
                    <label
                      key={enterprise.id}
                      className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEnterprises.includes(enterprise.id)}
                        onChange={() => handleEnterpriseToggle(enterprise.id)}
                        disabled={calculating}
                        className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                      />
                      <span className="ml-3 text-sm text-gray-900">{enterprise.name}</span>
                      <span className="ml-auto text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded">
                        {enterprise.scale}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <div className="relative group">
              {hasEditPermission ? (
                <button
                  onClick={handleStartCalculation}
                  disabled={!canCalculate}
                  className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${
                    canCalculate
                      ? 'bg-teal-600 text-white hover:bg-teal-700 cursor-pointer'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <i className={`${calculating ? 'ri-loader-4-line animate-spin' : 'ri-play-circle-line'}`}></i>
                  {calculating ? '计算中...' : '开始计算'}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-400 rounded-lg text-sm">
                  <i className="ri-lock-line"></i>
                  <span>无编辑权限，不可执行计算</span>
                </div>
              )}
              {!canCalculate && disabledReason && (
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-56">
                  <div className="bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                    {disabledReason}
                    <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-800"></div>
                  </div>
                </div>
              )}
            </div>

            {results.length > 0 && !calculating && (
              <button
                onClick={handleRecalculate}
                className="px-6 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-refresh-line mr-1"></i>重新计算
              </button>
            )}

            {selectedTemplateId && selectedRuleId && (
              <div className="ml-2 flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <i className="ri-bar-chart-grouped-line text-teal-500"></i>
                  {selectedTemplate?.template_name}
                </span>
                <i className="ri-arrow-right-line text-gray-300"></i>
                <span className="flex items-center gap-1">
                  <i className="ri-git-branch-line text-teal-500"></i>
                  {selectedRule?.rule_name}
                </span>
                <i className="ri-arrow-right-line text-gray-300"></i>
                <span className="flex items-center gap-1">
                  <i className="ri-calendar-line text-teal-500"></i>
                  {selectedYear}年
                </span>
                <i className="ri-arrow-right-line text-gray-300"></i>
                <span className="flex items-center gap-1">
                  <i className="ri-building-line text-teal-500"></i>
                  {calcScope === 'all' ? `全量（${enterprises.length}家）` : `已选${selectedEnterprises.length}家`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 计算进度 */}
        {calculating && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">计算进度</span>
              <span className="text-sm font-semibold text-teal-600">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
              <div
                className="bg-teal-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <i className="ri-loader-4-line animate-spin text-teal-500"></i>
              {progressMsg || '正在计算企业综合得分和分类等级，请稍候...'}
            </p>
          </div>
        )}

        {/* 计算结果 */}
        {results.length > 0 && !calculating && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    计算结果
                    <span className="ml-2 text-sm font-normal text-gray-500">共 {results.length} 家企业</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    使用「{selectedTemplate?.template_name}」指标模板 · 「{selectedRule?.rule_name}」分类规则 · {selectedYear}年数据
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {hasEditPermission && (
                    <button
                      onClick={() => setShowPublishConfirm(true)}
                      disabled={publishLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                    >
                      {publishLoading ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
                      {publishLoading ? '推送中...' : '应用到名单公示发布'}
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">等级筛选：</span>
                    <select
                      value={gradeFilter}
                      onChange={e => setGradeFilter(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">全部</option>
                      <option value="A">A类（优质）</option>
                      <option value="B">B类（良好）</option>
                      <option value="C">C类（一般）</option>
                      <option value="D">D类（待提升）</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">排序：</span>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as 'score-desc' | 'score-asc')}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="score-desc">得分从高到低</option>
                      <option value="score-asc">得分从低到高</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-3">
                {(['A', 'B', 'C', 'D'] as const).map(grade => {
                  const count = results.filter(r => r.grade === grade).length;
                  return (
                    <div key={grade} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getGradeColor(grade)}`}>
                      <span>{grade}类</span>
                      <span className="font-bold">{count}</span>
                      <span>家</span>
                    </div>
                  );
                })}
              </div>

              {selectedRule?.division_mode === 'percentage' && (
                <div className="mt-4 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
                  <div className="flex items-start gap-2">
                    <i className="ri-pie-chart-2-line text-teal-600 mt-0.5 flex-shrink-0"></i>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-teal-800 mb-2">
                        按比例分配说明 · 共 {results.length} 家有效企业参与排名
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {(['A', 'B', 'C', 'D'] as const).map((grade) => {
                          const total = results.length;
                          const thresholds = {
                            A: selectedRule.grade_a_threshold,
                            B: selectedRule.grade_b_threshold,
                            C: selectedRule.grade_c_threshold,
                            D: selectedRule.grade_d_threshold,
                          };
                          const aCount = Math.floor((selectedRule.grade_a_threshold / 100) * total);
                          const bCount = Math.floor((selectedRule.grade_b_threshold / 100) * total);
                          const cCount = Math.floor((selectedRule.grade_c_threshold / 100) * total);
                          const dCount = total - aCount - bCount - cCount;
                          const actualCounts = { A: aCount, B: bCount, C: cCount, D: dCount };
                          const pct = thresholds[grade];
                          const actual = actualCounts[grade];
                          const gradeColors: Record<string, string> = {
                            A: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                            B: 'bg-teal-100 text-teal-800 border-teal-300',
                            C: 'bg-amber-100 text-amber-800 border-amber-300',
                            D: 'bg-rose-100 text-rose-800 border-rose-300',
                          };
                          return (
                            <div key={grade} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs ${gradeColors[grade]}`}>
                              <span className="font-bold">{grade}类</span>
                              <span className="text-gray-500">·</span>
                              <span>设定 {pct}%</span>
                              <span className="text-gray-400">→</span>
                              <span className="font-semibold">实际 {actual} 家</span>
                            </div>
                          );
                        })}
                        <span className="text-xs text-teal-600 ml-1 flex items-center gap-1">
                          <i className="ri-information-line"></i>
                          按综合得分从高到低排名后依次分配，A/B/C 向下取整，D 类取剩余
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {skippedEnterprises.length > 0 && (
                <SkippedEnterprisesAlert skippedEnterprises={skippedEnterprises} year={selectedYear} />
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">企业名称</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">综合得分</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">分类等级</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">计算年度</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">计算时间</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAndSortedResults.map(result => (
                      <tr key={result.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {result.enterpriseName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 min-w-[3rem]">{result.score}</span>
                              {result.adjustmentScore !== 0 && (
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                                  result.adjustmentScore > 0
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-600 border border-rose-200'
                                }`}>
                                  基础 {result.baseScore} {result.adjustmentScore > 0 ? '+' : ''}{result.adjustmentScore}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 w-full max-w-[160px]">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-teal-600 h-2 rounded-full"
                                  style={{ width: `${Math.min(result.score, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getGradeColor(result.grade)}`}>
                            {result.grade}类 · {getGradeLabel(result.grade)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{result.year}年</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(result.calculatedAt).toLocaleString('zh-CN')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleViewDetail(result)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-bar-chart-2-line"></i>查看详情
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredAndSortedResults.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <i className="ri-filter-off-line text-4xl text-gray-300"></i>
                  <p className="mt-2 text-sm text-gray-500">没有符合筛选条件的结果</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {results.length === 0 && !calculating && (
          <div className="bg-white rounded-lg border border-gray-200 px-6 py-16 text-center">
            <i className="ri-calculator-line text-5xl text-gray-300"></i>
            <p className="mt-4 text-base text-gray-600 font-medium">尚未开始计算</p>
            <p className="mt-2 text-sm text-gray-500">
              请先选择指标体系模板和分类规则，再配置年度和范围后点击"开始计算"
            </p>
            {(!selectedTemplateId || !selectedRuleId) && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <i className="ri-error-warning-line"></i>
                {!selectedTemplateId && !selectedRuleId
                  ? '还需选择指标体系模板和分类规则'
                  : !selectedTemplateId
                  ? '还需选择指标体系模板'
                  : '还需选择分类规则'}
              </div>
            )}
          </div>
        )}

        {selectedResult && (
          <ScoreDetailModal
            open={detailModalOpen}
            onClose={() => setDetailModalOpen(false)}
            enterpriseId={selectedResult.id}
            enterpriseName={selectedResult.enterpriseName}
            year={selectedResult.year}
            score={selectedResult.score}
            grade={selectedResult.grade}
            templateId={selectedTemplateId}
            ruleId={selectedRuleId}
          />
        )}

        {showPublishConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-teal-100">
                  <i className="ri-send-plane-line text-teal-600 text-xl"></i>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">应用到名单公示发布</h3>
                  <p className="text-xs text-gray-500 mt-0.5">请确认推送操作</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3 mb-5 text-sm text-gray-700 space-y-1.5">
                <div className="flex items-center gap-2">
                  <i className="ri-building-line text-teal-500"></i>
                  <span>本次将推送 <strong>{results.length}</strong> 家企业的计算结果</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="ri-calendar-line text-teal-500"></i>
                  <span>计算年度：<strong>{selectedYear} 年</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="ri-bar-chart-grouped-line text-teal-500"></i>
                  <span>指标模板：<strong>{selectedTemplate?.template_name}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="ri-git-branch-line text-teal-500"></i>
                  <span>分类规则：<strong>{selectedRule?.rule_name}</strong></span>
                </div>
              </div>
              <p className="text-xs text-amber-600 flex items-start gap-1.5 mb-5">
                <i className="ri-error-warning-line mt-0.5 flex-shrink-0"></i>
                推送后，名单公示发布模块将展示本次计算的最新分类结果，原有同年度数据将被覆盖。
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowPublishConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  取消
                </button>
                <button
                  onClick={handlePublishToList}
                  className="px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
                >
                  确认推送
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
