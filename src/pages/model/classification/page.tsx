import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import IndustryRuleModal from './components/IndustryRuleModal';
import TemplateSaveModal from './components/TemplateSaveModal';
import { useAuth } from '../../../contexts/AuthContext';

interface ClassificationRule {
  id: string;
  rule_name: string;
  rule_type: 'general' | 'industry';
  division_mode: 'percentage' | 'score';
  industry_type: string;
  grade_a_threshold: number;
  grade_b_threshold: number;
  grade_c_threshold: number;
  grade_d_threshold: number;
  indicator_overrides: Record<string, number> | null;
  is_active: boolean;
}

interface IndustryItem {
  id: string;
  name: string;
  type: 'general' | 'industry';
}

interface IndicatorOption {
  id: string;
  indicator_code: string;
  indicator_name: string;
  applicable_type: string;
  weight: number;
  template_id: string | null;
}

interface TemplateGroup {
  id: string | null;
  template_name: string;
  indicators: IndicatorOption[];
}

interface TemplateSaveModalProps {
  onClose: () => void;
  onSave: (templateName: string) => void;
}

export default function ClassificationPage() {
  const [industries, setIndustries] = useState<IndustryItem[]>([
    { id: 'general', name: '通用规则', type: 'general' }
  ]);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('general');
  const [currentRule, setCurrentRule] = useState<ClassificationRule | null>(null);
  const [divisionMode, setDivisionMode] = useState<'percentage' | 'score'>('percentage');
  const [gradeA, setGradeA] = useState<number>(20);
  const [gradeB, setGradeB] = useState<number>(30);
  const [gradeC, setGradeC] = useState<number>(30);
  const [gradeD, setGradeD] = useState<number>(20);
  const [indicatorOverrides, setIndicatorOverrides] = useState<Record<string, number>>({});
  // 指标名称映射 code -> name
  const [indicatorNameMap, setIndicatorNameMap] = useState<Record<string, string>>({});
  const [allIndicators, setAllIndicators] = useState<IndicatorOption[]>([]);
  const [templateGroups, setTemplateGroups] = useState<TemplateGroup[]>([]);
  const [selectedIndicatorCode, setSelectedIndicatorCode] = useState<string>('');
  const [overrideWeight, setOverrideWeight] = useState<string>('');
  const [overrideError, setOverrideError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [industryModalOpen, setIndustryModalOpen] = useState(false);
  const [templateSaveModalOpen, setTemplateSaveModalOpen] = useState(false);

  const { canEdit } = useAuth();
  const hasEditPermission = canEdit('model_classification');

  useEffect(() => {
    loadIndustries();
    loadAllIndicators();
  }, []);

  useEffect(() => {
    if (selectedIndustry) {
      loadRule(selectedIndustry);
    }
  }, [selectedIndustry]);

  const loadAllIndicators = async () => {
    // 同时加载模板列表和指标列表
    const [indicatorsRes, templatesRes] = await Promise.all([
      supabase
        .from('evaluation_indicators')
        .select('id, indicator_code, indicator_name, applicable_type, weight, template_id')
        .eq('is_enabled', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('indicator_templates')
        .select('id, template_name')
        .order('created_at', { ascending: true }),
    ]);

    if (!indicatorsRes.error && indicatorsRes.data) {
      setAllIndicators(indicatorsRes.data);
      const nameMap: Record<string, string> = {};
      indicatorsRes.data.forEach(ind => {
        nameMap[ind.indicator_code] = ind.indicator_name;
      });
      setIndicatorNameMap(nameMap);

      // 构建模板分组
      const templates = templatesRes.data || [];
      const groups: TemplateGroup[] = [];

      // 先按模板分组
      templates.forEach(tpl => {
        const inds = indicatorsRes.data.filter(ind => ind.template_id === tpl.id);
        if (inds.length > 0) {
          groups.push({ id: tpl.id, template_name: tpl.template_name, indicators: inds });
        }
      });

      // 没有模板的指标归入"未分组"
      const ungrouped = indicatorsRes.data.filter(ind => !ind.template_id);
      if (ungrouped.length > 0) {
        groups.push({ id: null, template_name: '未分组指标', indicators: ungrouped });
      }

      setTemplateGroups(groups);
    }
  };

  const loadIndustries = async () => {
    const { data, error } = await supabase
      .from('classification_rules')
      .select('id, industry_type, rule_type')
      .eq('is_active', true);

    if (!error && data) {
      const industryList: IndustryItem[] = [
        { id: 'general', name: '通用规则', type: 'general' }
      ];
      
      data.forEach(rule => {
        if (rule.rule_type === 'industry' && rule.industry_type) {
          industryList.push({
            id: rule.id,
            name: rule.industry_type,
            type: 'industry'
          });
        }
      });
      
      setIndustries(industryList);
    }
  };

  const loadRule = async (industryId: string) => {
    setLoading(true);
    
    if (industryId === 'general') {
      const { data, error } = await supabase
        .from('classification_rules')
        .select('*')
        .eq('rule_type', 'general')
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) {
        setCurrentRule(data);
        setDivisionMode(data.division_mode);
        setGradeA(data.grade_a_threshold);
        setGradeB(data.grade_b_threshold);
        setGradeC(data.grade_c_threshold);
        setGradeD(data.grade_d_threshold);
        setIndicatorOverrides(data.indicator_overrides || {});
      } else {
        setCurrentRule(null);
        setDivisionMode('percentage');
        setGradeA(20);
        setGradeB(30);
        setGradeC(30);
        setGradeD(20);
        setIndicatorOverrides({});
      }
    } else {
      const { data, error } = await supabase
        .from('classification_rules')
        .select('*')
        .eq('id', industryId)
        .maybeSingle();

      if (!error && data) {
        setCurrentRule(data);
        setDivisionMode(data.division_mode);
        setGradeA(data.grade_a_threshold);
        setGradeB(data.grade_b_threshold);
        setGradeC(data.grade_c_threshold);
        setGradeD(data.grade_d_threshold);
        setIndicatorOverrides(data.indicator_overrides || {});
      }
    }

    setSelectedIndicatorCode('');
    setOverrideWeight('');
    setOverrideError('');
    setLoading(false);
  };

  const handleAddOverride = () => {
    setOverrideError('');
    if (!selectedIndicatorCode) {
      setOverrideError('请选择要覆盖的指标');
      return;
    }
    const weightNum = Number(overrideWeight);
    if (!overrideWeight || isNaN(weightNum) || weightNum <= 0 || weightNum > 100) {
      setOverrideError('请输入有效权重（1-100）');
      return;
    }
    if (indicatorOverrides[selectedIndicatorCode] !== undefined) {
      setOverrideError('该指标已添加，请直接修改或删除后重新添加');
      return;
    }
    setIndicatorOverrides({ ...indicatorOverrides, [selectedIndicatorCode]: weightNum });
    setSelectedIndicatorCode('');
    setOverrideWeight('');
  };

  const handleSave = async () => {
    setSaving(true);
    
    const ruleData = {
      rule_name: selectedIndustry === 'general' ? '通用规则' : industries.find(i => i.id === selectedIndustry)?.name || '',
      rule_type: selectedIndustry === 'general' ? 'general' : 'industry',
      division_mode: divisionMode,
      industry_type: selectedIndustry === 'general' ? '' : industries.find(i => i.id === selectedIndustry)?.name || '',
      grade_a_threshold: gradeA,
      grade_b_threshold: gradeB,
      grade_c_threshold: gradeC,
      grade_d_threshold: gradeD,
      indicator_overrides: Object.keys(indicatorOverrides).length > 0 ? indicatorOverrides : null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (currentRule) {
      const { error } = await supabase
        .from('classification_rules')
        .update(ruleData)
        .eq('id', currentRule.id);

      if (!error) {
        alert('保存成功');
        loadRule(selectedIndustry);
      } else {
        alert('保存失败：' + error.message);
      }
    } else {
      const { error } = await supabase
        .from('classification_rules')
        .insert(ruleData);

      if (!error) {
        alert('保存成功');
        loadIndustries();
        loadRule(selectedIndustry);
      } else {
        alert('保存失败：' + error.message);
      }
    }
    
    setSaving(false);
  };

  const handleAddIndustry = async (industryName: string) => {
    const { data, error } = await supabase
      .from('classification_rules')
      .insert({
        rule_name: industryName,
        rule_type: 'industry',
        division_mode: 'percentage',
        industry_type: industryName,
        grade_a_threshold: 20,
        grade_b_threshold: 30,
        grade_c_threshold: 30,
        grade_d_threshold: 20,
        indicator_overrides: null,
        is_active: true,
      })
      .select()
      .single();

    if (!error && data) {
      await loadIndustries();
      setSelectedIndustry(data.id);
      setIndustryModalOpen(false);
    } else {
      alert('添加失败：' + error?.message);
    }
  };

  const handleDeleteIndustry = async (industryId: string) => {
    if (industryId === 'general') {
      alert('通用规则不可删除');
      return;
    }

    if (!confirm('确定要删除该行业规则吗？')) return;

    const { error } = await supabase
      .from('classification_rules')
      .delete()
      .eq('id', industryId);

    if (!error) {
      await loadIndustries();
      setSelectedIndustry('general');
    } else {
      alert('删除失败：' + error.message);
    }
  };

  const handleSaveTemplate = async (templateName: string) => {
    const allRules = await supabase
      .from('classification_rules')
      .select('*')
      .eq('is_active', true);

    if (allRules.data) {
      const templateData = {
        template_name: templateName,
        rules: allRules.data,
        created_at: new Date().toISOString(),
      };

      localStorage.setItem(`classification_template_${Date.now()}`, JSON.stringify(templateData));
      alert('模板保存成功');
      setTemplateSaveModalOpen(false);
    }
  };

  const validateThresholds = () => {
    if (divisionMode === 'percentage') {
      const total = gradeA + gradeB + gradeC + gradeD;
      return total === 100;
    }
    return true;
  };

  const isValid = validateThresholds();

  // 可选指标：排除已添加的
  const availableIndicators = allIndicators.filter(
    ind => indicatorOverrides[ind.indicator_code] === undefined
  );

  // 可选指标按模板分组（排除已添加的）
  const availableTemplateGroups: TemplateGroup[] = templateGroups
    .map(group => ({
      ...group,
      indicators: group.indicators.filter(
        ind => indicatorOverrides[ind.indicator_code] === undefined
      ),
    }))
    .filter(group => group.indicators.length > 0);

  return (
    <div className="h-full flex bg-gray-50">
      {/* 左侧行业列表 */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">行业规则</h2>
          <p className="text-xs text-gray-400 mt-1">通用规则适用于所有行业；可为特定行业单独配置分类标准</p>
          {hasEditPermission && (
            <button
              onClick={() => setIndustryModalOpen(true)}
              title="新增一个行业专属分类规则"
              className="mt-3 w-full px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 whitespace-nowrap"
            >
              <i className="ri-add-line mr-1"></i>
              新增行业
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-auto">
          {industries.map(industry => (
            <div
              key={industry.id}
              className={`px-4 py-3 cursor-pointer border-b border-gray-100 flex items-center justify-between group ${
                selectedIndustry === industry.id ? 'bg-teal-50 border-l-4 border-l-teal-600' : 'hover:bg-gray-50'
              }`}
              onClick={() => setSelectedIndustry(industry.id)}
            >
              <div className="flex items-center gap-2">
                <i className={`${industry.type === 'general' ? 'ri-global-line' : 'ri-building-line'} text-gray-400`}></i>
                <span className={`text-sm ${selectedIndustry === industry.id ? 'text-teal-700 font-medium' : 'text-gray-700'}`}>
                  {industry.name}
                </span>
              </div>
              {industry.type === 'industry' && hasEditPermission && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteIndustry(industry.id);
                  }}
                  title="删除该行业规则"
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 右侧配置区 */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {industries.find(i => i.id === selectedIndustry)?.name || '分类规则设置'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {selectedIndustry === 'general'
                  ? '通用规则作为默认基准，适用于未单独配置行业规则的所有企业'
                  : '行业专属规则，优先级高于通用规则，仅对该行业企业生效'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasEditPermission && (
                <>
                  {/* 保存为模板 */}
                  <div className="relative group">
                    <button
                      onClick={() => setTemplateSaveModalOpen(true)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                    >
                      <i className="ri-save-line mr-2"></i>
                      保存为模板
                    </button>
                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-72">
                      <div className="bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                        将当前所有行业规则另存为模板，方便在不同场景下快速复用
                        <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                  </div>

                  {/* 保存规则 */}
                  <div className="relative group">
                    <button
                      onClick={handleSave}
                      disabled={!isValid || saving}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {saving ? (
                        <>
                          <i className="ri-loader-4-line mr-2 animate-spin"></i>
                          保存中...
                        </>
                      ) : (
                        <>
                          <i className="ri-save-line mr-2"></i>
                          保存规则
                        </>
                      )}
                    </button>
                    {!isValid && (
                      <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10 w-56">
                        <div className="bg-red-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                          按比例划分时，A+B+C+D 四类比例之和须等于 100% 才可保存
                          <div className="absolute top-full right-4 border-4 border-transparent border-t-red-700"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-3xl text-gray-400 animate-spin"></i>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 划分方式选择 */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900">划分方式</h3>
                  <div className="relative group">
                    <i className="ri-question-line text-gray-400 cursor-help text-base"></i>
                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-72">
                      <div className="bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                        <p className="mb-1"><strong>按得分比例：</strong>将所有企业排名后，按名次百分比划分等级，A+B+C+D 之和须为 100%</p>
                        <p><strong>按具体分值：</strong>设定各等级的分数门槛，企业得分达到对应阈值即归入该等级</p>
                        <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-4">选择企业等级划分的计算方式</p>
                <div className="flex gap-6">
                  <label className={`flex items-center gap-2 ${hasEditPermission ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                    <input
                      type="radio"
                      checked={divisionMode === 'percentage'}
                      onChange={() => hasEditPermission && setDivisionMode('percentage')}
                      disabled={!hasEditPermission}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <span className="text-sm text-gray-700 font-medium">按得分比例划分</span>
                      <p className="text-xs text-gray-400">按企业排名百分比分配等级，A+B+C+D 须合计 100%</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-2 ${hasEditPermission ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                    <input
                      type="radio"
                      checked={divisionMode === 'score'}
                      onChange={() => hasEditPermission && setDivisionMode('score')}
                      disabled={!hasEditPermission}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <span className="text-sm text-gray-700 font-medium">按具体分值阈值划分</span>
                      <p className="text-xs text-gray-400">设定各等级的最低分数线，企业综合得分达标即归入该等级</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* 等级阈值配置 */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">等级阈值配置</h3>
                    <div className="relative group">
                      <i className="ri-question-line text-gray-400 cursor-help text-base"></i>
                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-72">
                        <div className="bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                          {divisionMode === 'percentage'
                            ? '设置各等级企业所占的比例区间。例如 A=20% 表示综合得分排名前 20% 的企业归为 A 类，四类之和须等于 100%'
                            : '设置各等级的最低分数线。例如 A=80 表示综合得分 ≥ 80 分的企业归为 A 类'}
                          <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {divisionMode === 'percentage' && (
                    <span className={`text-sm font-medium ${isValid ? 'text-teal-600' : 'text-red-600'}`}>
                      总计：{gradeA + gradeB + gradeC + gradeD}%
                      {!isValid && ' （应为100%）'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  {divisionMode === 'percentage'
                    ? '设置 A/B/C/D 四类企业各自占全部企业的比例，四项之和须为 100%'
                    : '设置 A/B/C/D 四类企业的最低得分门槛，企业综合得分达到对应阈值即归入该等级'}
                </p>

                <div className="grid grid-cols-2 gap-6">
                  {/* A类 */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white font-bold text-sm">A</div>
                      <div>
                        <span className="font-medium text-gray-900">A类企业</span>
                        <span className="ml-2 text-xs text-gray-400">优质企业</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={gradeA}
                        onChange={(e) => setGradeA(Number(e.target.value))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        min="0"
                        max="100"
                      />
                      <span className="text-sm text-gray-600">
                        {divisionMode === 'percentage' ? '%' : '分'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {divisionMode === 'percentage'
                        ? `排名前 ${gradeA}% 的企业归为 A 类`
                        : `综合得分 ≥ ${gradeA} 分的企业归为 A 类`}
                    </p>
                  </div>

                  {/* B类 */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-teal-500 rounded flex items-center justify-center text-white font-bold text-sm">B</div>
                      <div>
                        <span className="font-medium text-gray-900">B类企业</span>
                        <span className="ml-2 text-xs text-gray-400">良好企业</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={gradeB}
                        onChange={(e) => setGradeB(Number(e.target.value))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        min="0"
                        max="100"
                      />
                      <span className="text-sm text-gray-600">
                        {divisionMode === 'percentage' ? '%' : '分'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {divisionMode === 'percentage'
                        ? `排名 ${gradeA}%–${gradeA + gradeB}% 的企业归为 B 类`
                        : `综合得分 ${gradeA - gradeB}–${gradeA} 分的企业归为 B 类`}
                    </p>
                  </div>

                  {/* C类 */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center text-white font-bold text-sm">C</div>
                      <div>
                        <span className="font-medium text-gray-900">C类企业</span>
                        <span className="ml-2 text-xs text-gray-400">一般企业</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={gradeC}
                        onChange={(e) => setGradeC(Number(e.target.value))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        min="0"
                        max="100"
                      />
                      <span className="text-sm text-gray-600">
                        {divisionMode === 'percentage' ? '%' : '分'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {divisionMode === 'percentage'
                        ? `排名 ${gradeA + gradeB}%–${gradeA + gradeB + gradeC}% 的企业归为 C 类`
                        : `综合得分 ${gradeA - gradeB - gradeC}–${gradeA - gradeB} 分的企业归为 C 类`}
                    </p>
                  </div>

                  {/* D类 */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-red-500 rounded flex items-center justify-center text-white font-bold text-sm">D</div>
                      <div>
                        <span className="font-medium text-gray-900">D类企业</span>
                        <span className="ml-2 text-xs text-gray-400">待提升企业</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={gradeD}
                        onChange={(e) => setGradeD(Number(e.target.value))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        min="0"
                        max="100"
                      />
                      <span className="text-sm text-gray-600">
                        {divisionMode === 'percentage' ? '%' : '分'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {divisionMode === 'percentage'
                        ? `排名后 ${gradeD}% 的企业归为 D 类`
                        : `综合得分 &lt; ${gradeA - gradeB - gradeC} 分的企业归为 D 类`}
                    </p>
                  </div>
                </div>
              </div>

              {/* 特殊指标权重覆盖（仅行业规则显示） */}
              {selectedIndustry !== 'general' && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">特殊指标权重覆盖</h3>
                    <div className="relative group">
                      <i className="ri-question-line text-gray-400 cursor-help text-base"></i>
                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-80">
                        <div className="bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                          针对当前行业，可将某些指标的权重调整为不同于通用规则的值。例如：高耗能行业可将"单位能耗增加值"权重从默认 20% 提高到 35%，其余指标仍沿用通用权重。
                          <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    针对该行业单独调整特定指标的权重，未覆盖的指标仍使用通用规则中的默认权重
                  </p>

                  {/* 添加行 */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">选择要覆盖的指标</label>
                      <select
                        value={selectedIndicatorCode}
                        onChange={(e) => {
                          setSelectedIndicatorCode(e.target.value);
                          setOverrideError('');
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      >
                        <option value="">请选择指标</option>
                        {availableTemplateGroups.map(group => (
                          <optgroup
                            key={group.id ?? 'ungrouped'}
                            label={`📁 ${group.template_name}`}
                          >
                            {group.indicators.map(ind => (
                              <option key={ind.indicator_code} value={ind.indicator_code}>
                                {ind.indicator_name}（{
                                  ind.applicable_type === 'above' ? '规模以上' :
                                  ind.applicable_type === 'below' ? '规模以下' : '通用'
                                }，默认权重 {ind.weight}%）
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">覆盖后的权重</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={overrideWeight}
                          onChange={(e) => {
                            setOverrideWeight(e.target.value);
                            setOverrideError('');
                          }}
                          placeholder="输入 1-100"
                          className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          min="1"
                          max="100"
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddOverride(); }}
                        />
                        <span className="text-sm text-gray-500">%</span>
                        <button
                          onClick={handleAddOverride}
                          title="将该指标的覆盖权重添加到列表"
                          className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 whitespace-nowrap"
                        >
                          <i className="ri-add-line mr-1"></i>
                          添加
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 错误提示 */}
                  {overrideError && (
                    <p className="text-xs text-red-500 mb-3 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {overrideError}
                    </p>
                  )}

                  {/* 已添加列表 */}
                  {Object.keys(indicatorOverrides).length > 0 ? (
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                      <div className="grid grid-cols-4 px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium">
                        <span className="col-span-2">指标名称</span>
                        <span className="text-center">权重变化</span>
                        <span className="text-right">操作</span>
                      </div>
                      {Object.entries(indicatorOverrides).map(([code, weight]) => {
                        const origIndicator = allIndicators.find(ind => ind.indicator_code === code);
                        return (
                          <div key={code} className="grid grid-cols-4 items-center px-4 py-3">
                            <div className="col-span-2 flex items-center gap-3">
                              <i className="ri-bar-chart-line text-teal-500"></i>
                              <div>
                                <span className="text-sm font-medium text-gray-900">
                                  {indicatorNameMap[code] || code}
                                </span>
                                {origIndicator && (
                                  <span className="ml-2 text-xs text-gray-400">
                                    ({origIndicator.applicable_type === 'above' ? '规模以上' : '规模以下'})
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-center gap-1">
                              {origIndicator && (
                                <>
                                  <span className="text-xs text-gray-400 line-through">{origIndicator.weight}%</span>
                                  <i className="ri-arrow-right-line text-xs text-gray-400"></i>
                                </>
                              )}
                              <span className="text-sm font-semibold text-teal-600">{weight}%</span>
                            </div>
                            <div className="flex justify-end">
                              <button
                                onClick={() => {
                                  const newOverrides = { ...indicatorOverrides };
                                  delete newOverrides[code];
                                  setIndicatorOverrides(newOverrides);
                                }}
                                title="移除该指标的权重覆盖，恢复使用默认权重"
                                className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              >
                                <i className="ri-delete-bin-line text-sm"></i>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-200 rounded-lg py-6 text-center text-sm text-gray-400">
                      <i className="ri-inbox-line text-2xl block mb-1"></i>
                      暂未添加任何指标覆盖规则
                      <p className="text-xs mt-1">从上方选择指标并设置覆盖权重后点击"添加"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {industryModalOpen && (
        <IndustryRuleModal
          onClose={() => setIndustryModalOpen(false)}
          onSave={handleAddIndustry}
        />
      )}

      {templateSaveModalOpen && (
        <TemplateSaveModal
          onClose={() => setTemplateSaveModalOpen(false)}
          onSave={handleSaveTemplate}
        />
      )}
    </div>
  );
}
