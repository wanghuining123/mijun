import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import IndicatorEditModal from './components/IndicatorEditModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import TemplateSaveModal from './components/TemplateSaveModal';
import { useAuth } from '../../../contexts/AuthContext';

interface Indicator {
  id: string;
  template_id: string | null;
  indicator_name: string;
  indicator_code: string;
  applicable_type: 'above' | 'below';
  weight: number;
  formula: string;
  unit: string | null;
  is_enabled: boolean;
  sort_order: number;
  scoring_direction: 'positive' | 'negative';
  is_deletable: boolean;
}

interface Template {
  id: string;
  template_name: string;
  is_active: boolean;
}

export default function IndicatorsPage() {
  const [activeTab, setActiveTab] = useState<'above' | 'below'>('above');
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [allIndicators, setAllIndicators] = useState<Indicator[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [deleteTemplateModalOpen, setDeleteTemplateModalOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);
  const [deletingIndicator, setDeletingIndicator] = useState<Indicator | null>(null);
  const [weightError, setWeightError] = useState<string>('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showNewTemplateInput, setShowNewTemplateInput] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const { canEdit } = useAuth();
  const hasEditPermission = canEdit('model_indicators');

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (currentTemplate !== null) {
      loadIndicators();
    }
  }, [activeTab, currentTemplate]);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from('indicator_templates')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setTemplates(data);
      if (data.length > 0 && currentTemplate === null) {
        const active = data.find(t => t.is_active) || data[0];
        setCurrentTemplate(active.id);
      }
    }
    setLoading(false);
  };

  const loadIndicators = async () => {
    setLoading(true);

    // 加载当前 Tab 的指标（用于表格展示）
    let query = supabase
      .from('evaluation_indicators')
      .select('*')
      .eq('applicable_type', activeTab)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });

    if (currentTemplate) {
      query = query.eq('template_id', currentTemplate);
    }

    const { data, error } = await query;
    if (!error && data) {
      setIndicators(data);
    }

    // 同时加载该模板下所有类型的指标（用于权重计算）
    let allQuery = supabase
      .from('evaluation_indicators')
      .select('*')
      .eq('is_enabled', true);

    if (currentTemplate) {
      allQuery = allQuery.eq('template_id', currentTemplate);
    }

    const { data: allData, error: allError } = await allQuery;
    if (!allError && allData) {
      setAllIndicators(allData);
    }

    setLoading(false);
  };

  const handleSelectTemplate = (id: string) => {
    setCurrentTemplate(id);
  };

  const handleCreateTemplate = async () => {
    const name = newTemplateName.trim();
    if (!name) return;
    setCreatingTemplate(true);
    const { data, error } = await supabase
      .from('indicator_templates')
      .insert({ template_name: name, is_active: false })
      .select()
      .single();
    setCreatingTemplate(false);
    if (!error && data) {
      // 自动插入6个核心必须指标（规上+规下各一套）
      const coreIndicators = [
        { name: '米均销售收入', code: 'CORE_01', formula: '销售收入 / 自有土地面积', unit: '万元/亩' },
        { name: '米均工业产值', code: 'CORE_02', formula: '工业总产值 / 自有土地面积', unit: '万元/亩' },
        { name: '米均增加值',   code: 'CORE_03', formula: '工业增加值 / 自有土地面积', unit: '万元/亩' },
        { name: '米均利润',     code: 'CORE_04', formula: '利润总额 / 自有土地面积',   unit: '万元/亩' },
        { name: '米均研发投入', code: 'CORE_05', formula: '研发经费支出 / 自有土地面积', unit: '万元/亩' },
        { name: '米均从业人数', code: 'CORE_06', formula: '从业人数 / 自有土地面积',   unit: '人/亩' },
      ];
      const inserts: any[] = [];
      (['above', 'below'] as const).forEach((type) => {
        coreIndicators.forEach((ind, idx) => {
          inserts.push({
            template_id: data.id,
            indicator_name: ind.name,
            indicator_code: `${ind.code}_${type.toUpperCase()}`,
            applicable_type: type,
            weight: 0,
            formula: ind.formula,
            unit: ind.unit,
            is_enabled: true,
            sort_order: idx + 1,
            scoring_direction: 'positive',
            is_deletable: false,
          });
        });
      });
      await supabase.from('evaluation_indicators').insert(inserts);

      setTemplates(prev => [...prev, data]);
      setCurrentTemplate(data.id);
      setNewTemplateName('');
      setShowNewTemplateInput(false);
    }
  };

  const handleDeleteTemplate = () => {
    if (!currentTemplate) return;
    const tpl = templates.find(t => t.id === currentTemplate);
    if (tpl) {
      setDeletingTemplate(tpl);
      setDeleteTemplateModalOpen(true);
    }
  };

  const confirmDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    await supabase
      .from('evaluation_indicators')
      .update({ is_enabled: false })
      .eq('template_id', deletingTemplate.id);

    const { error } = await supabase
      .from('indicator_templates')
      .delete()
      .eq('id', deletingTemplate.id);

    if (!error) {
      const remaining = templates.filter(t => t.id !== deletingTemplate.id);
      setTemplates(remaining);
      setCurrentTemplate(remaining.length > 0 ? remaining[0].id : null);
      setDeleteTemplateModalOpen(false);
      setDeletingTemplate(null);
    }
  };

  const handleAdd = () => {
    setEditingIndicator(null);
    setEditModalOpen(true);
  };

  const handleEdit = (indicator: Indicator) => {
    setEditingIndicator(indicator);
    setEditModalOpen(true);
  };

  const handleDelete = (indicator: Indicator) => {
    if (indicator.is_deletable === false) return;
    setDeletingIndicator(indicator);
    setDeleteModalOpen(true);
  };

  const handleSave = async (dataOrArray: any) => {
    // 兼容单条（编辑）和多条（新增多类型）
    const items: any[] = Array.isArray(dataOrArray) ? dataOrArray : [dataOrArray];

    if (editingIndicator) {
      // 编辑模式：items 可能包含 1 或 2 条（当同时勾选了两种类型时）
      setWeightError('');

      for (const data of items) {
        const targetType = data.applicable_type as 'above' | 'below';
        const newWeight = Number(data.weight) || 0;

        if (targetType === editingIndicator.applicable_type) {
          // 更新当前正在编辑的这条记录
          const otherIndicators = allIndicators.filter(
            (ind) => ind.applicable_type === targetType && ind.id !== editingIndicator.id
          );
          const otherWeightSum = otherIndicators.reduce((sum, ind) => sum + Number(ind.weight), 0);
          if (otherWeightSum + newWeight > 100) {
            const remaining = parseFloat((100 - otherWeightSum).toFixed(1));
            setWeightError(
              `${targetType === 'above' ? '规模以上' : '规模以下'}企业当前已用权重 ${otherWeightSum.toFixed(1)}%，本次最多可设置 ${remaining > 0 ? remaining : 0}%，权重总和不能超过 100%`
            );
            return;
          }
          await supabase
            .from('evaluation_indicators')
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', editingIndicator.id);
        } else {
          // 另一种类型：查找同模板下同名的指标，有则更新，无则新建
          const existing = allIndicators.find(
            (ind) =>
              ind.applicable_type === targetType &&
              ind.indicator_name === editingIndicator.indicator_name &&
              ind.template_id === editingIndicator.template_id
          );

          if (existing) {
            await supabase
              .from('evaluation_indicators')
              .update({
                indicator_name: data.indicator_name,
                formula: data.formula,
                unit: data.unit || null,
                weight: newWeight,
                scoring_direction: data.scoring_direction,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
          } else {
            // 新建对应类型的指标
            const maxOrder = allIndicators
              .filter((i) => i.applicable_type === targetType)
              .reduce((max, i) => Math.max(max, i.sort_order || 0), 0);
            await supabase.from('evaluation_indicators').insert({
              indicator_name: data.indicator_name,
              formula: data.formula,
              unit: data.unit || null,
              applicable_type: targetType,
              weight: newWeight,
              template_id: editingIndicator.template_id,
              is_enabled: true,
              sort_order: maxOrder + 1,
              indicator_code: `IND_${Date.now()}_${targetType}`,
              scoring_direction: data.scoring_direction,
              is_deletable: editingIndicator.is_deletable,
            });
          }
        }
      }

      loadIndicators();
      setEditModalOpen(false);
      return;
    }

    // 新增模式：批量插入
    setWeightError('');
    const maxOrder = indicators.length > 0 ? Math.max(...indicators.map(i => i.sort_order || 0)) : 0;
    const inserts = items.map((data, idx) => ({
      indicator_name: data.indicator_name,
      formula: data.formula,
      unit: data.unit || null,
      applicable_type: data.applicable_type,
      weight: data.weight,
      template_id: currentTemplate,
      is_enabled: true,
      sort_order: maxOrder + 1 + idx,
      indicator_code: `IND_${Date.now()}_${idx}`,
      scoring_direction: data.scoring_direction,
    }));

    const { error } = await supabase
      .from('evaluation_indicators')
      .insert(inserts);

    if (!error) { loadIndicators(); setEditModalOpen(false); }
  };

  const confirmDelete = async () => {
    if (!deletingIndicator) return;
    const { error } = await supabase
      .from('evaluation_indicators')
      .update({ is_enabled: false })
      .eq('id', deletingIndicator.id);
    if (!error) { loadIndicators(); setDeleteModalOpen(false); setDeletingIndicator(null); }
  };

  const handleSaveTemplate = async (templateName: string) => {
    const { data: newTemplate, error: templateError } = await supabase
      .from('indicator_templates')
      .insert({ template_name: templateName, is_active: false })
      .select()
      .single();
    if (templateError || !newTemplate) return;

    const indicatorsToSave = indicators.map(ind => ({
      template_id: newTemplate.id,
      indicator_name: ind.indicator_name,
      indicator_code: `IND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      applicable_type: ind.applicable_type,
      weight: ind.weight,
      formula: ind.formula,
      unit: ind.unit,
      is_enabled: true,
      sort_order: ind.sort_order,
      is_deletable: ind.is_deletable,
    }));

    const { error: insertError } = await supabase
      .from('evaluation_indicators')
      .insert(indicatorsToSave);

    if (!insertError) {
      loadTemplates();
      setTemplateModalOpen(false);
    }
  };

  const totalWeight = indicators.reduce((sum, ind) => sum + Number(ind.weight), 0);
  const selectedTemplate = templates.find(t => t.id === currentTemplate);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 顶部标题 */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <h1 className="text-2xl font-semibold text-gray-900">指标体系管理</h1>
        <p className="text-sm text-gray-500 mt-1">先选择或新建模板，再分别配置规上/规下企业的评价指标</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：模板列表 */}
        <div className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">指标模板</span>
              {hasEditPermission && (
                <button
                  onClick={() => setShowNewTemplateInput(true)}
                  title="新建模板"
                  className="w-6 h-6 flex items-center justify-center text-teal-600 hover:bg-teal-50 rounded cursor-pointer transition-colors"
                >
                  <i className="ri-add-line text-base"></i>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {templates.length === 0 && !showNewTemplateInput && (
              <div className="px-4 py-6 text-center">
                <i className="ri-file-list-3-line text-3xl text-gray-300"></i>
                <p className="text-xs text-gray-400 mt-2">暂无模板</p>
                <button
                  onClick={() => setShowNewTemplateInput(true)}
                  className="mt-3 text-xs text-teal-600 hover:underline cursor-pointer"
                >
                  新建第一个模板
                </button>
              </div>
            )}
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t.id)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer flex items-center gap-2 group ${
                  currentTemplate === t.id
                    ? 'bg-teal-50 text-teal-700 font-medium border-r-2 border-teal-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <i className={`ri-file-text-line flex-shrink-0 ${currentTemplate === t.id ? 'text-teal-600' : 'text-gray-400'}`}></i>
                <span className="truncate flex-1">{t.template_name}</span>
                {t.is_active && (
                  <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full flex-shrink-0">启用</span>
                )}
              </button>
            ))}
          </div>

          {/* 新建模板输入框 */}
          {showNewTemplateInput && hasEditPermission && (
            <div className="px-3 py-3 border-t border-gray-100 bg-gray-50">
              <input
                type="text"
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateTemplate(); if (e.key === 'Escape') { setShowNewTemplateInput(false); setNewTemplateName(''); } }}
                placeholder="输入模板名称"
                autoFocus
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 mb-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateTemplate}
                  disabled={!newTemplateName.trim() || creatingTemplate}
                  className="flex-1 py-1.5 bg-teal-600 text-white text-xs rounded-md hover:bg-teal-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  {creatingTemplate ? '创建中...' : '确认'}
                </button>
                <button
                  onClick={() => { setShowNewTemplateInput(false); setNewTemplateName(''); }}
                  className="flex-1 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-md hover:bg-gray-100 cursor-pointer whitespace-nowrap"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 右侧：指标配置区 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {currentTemplate === null ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <i className="ri-arrow-left-line text-4xl text-gray-300"></i>
                <p className="text-gray-400 mt-3 text-sm">请先在左侧选择或新建一个模板</p>
              </div>
            </div>
          ) : (
            <>
              {/* 右侧顶部操作栏 */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-gray-900">{selectedTemplate?.template_name}</span>
                    {selectedTemplate?.is_active && (
                      <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">当前启用</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasEditPermission && (
                      <>
                        <button
                          onClick={() => setTemplateModalOpen(true)}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap cursor-pointer"
                        >
                          <i className="ri-save-line mr-1.5"></i>另存为模板
                        </button>
                        <button
                          onClick={handleDeleteTemplate}
                          className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-50 whitespace-nowrap cursor-pointer"
                        >
                          <i className="ri-delete-bin-line mr-1.5"></i>删除模板
                        </button>
                        <button
                          onClick={handleAdd}
                          className="px-4 py-1.5 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 whitespace-nowrap cursor-pointer"
                        >
                          <i className="ri-add-line mr-1.5"></i>新增指标
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 规上/规下 Tab */}
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => setActiveTab('above')}
                    className={`px-5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === 'above' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    规模以上企业
                  </button>
                  <button
                    onClick={() => setActiveTab('below')}
                    className={`px-5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === 'below' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    规模以下企业
                  </button>
                  <div className="ml-auto flex items-center gap-2 text-sm text-gray-600">
                    <span>权重总计：</span>
                    <span className={`font-semibold ${totalWeight === 100 ? 'text-teal-600' : 'text-red-600'}`}>
                      {totalWeight.toFixed(1)}%
                    </span>
                    {totalWeight !== 100 && (
                      <span className="text-red-500 text-xs">（须为100%）</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 指标表格 */}
              <div className="flex-1 overflow-auto px-6 py-5">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <i className="ri-loader-4-line text-3xl text-gray-400 animate-spin"></i>
                  </div>
                ) : indicators.length === 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <i className="ri-file-list-3-line text-5xl text-gray-300"></i>
                    <p className="text-gray-500 mt-4 text-sm">
                      当前模板下暂无「{activeTab === 'above' ? '规模以上' : '规模以下'}」指标
                    </p>
                    <button
                      onClick={handleAdd}
                      className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 whitespace-nowrap cursor-pointer"
                    >
                      新增第一个指标
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">指标名称</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">适用类型</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">权重</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">计分方式</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">计算公式</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">单位</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {indicators.map((indicator) => (
                          <tr key={indicator.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              <div className="flex items-center gap-2">
                                {indicator.is_deletable === false && (
                                  <span title="核心指标，不可删除" className="inline-flex items-center justify-center w-4 h-4">
                                    <i className="ri-lock-line text-xs text-amber-500"></i>
                                  </span>
                                )}
                                {indicator.indicator_name}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded text-xs">
                                {indicator.applicable_type === 'above' ? '规模以上' : '规模以下'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">{indicator.weight}%</td>
                            <td className="px-6 py-4 text-sm">
                              {indicator.scoring_direction === 'negative' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 rounded text-xs font-medium">
                                  <i className="ri-arrow-down-line text-xs"></i>反向计分
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 rounded text-xs font-medium">
                                  <i className="ri-arrow-up-line text-xs"></i>正向计分
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 font-mono max-w-xs truncate" title={indicator.formula}>
                              {indicator.formula}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{indicator.unit || '-'}</td>
                            <td className="px-6 py-4 text-right text-sm">
                              {hasEditPermission ? (
                                <>
                                  <button
                                    onClick={() => handleEdit(indicator)}
                                    className="text-teal-600 hover:text-teal-700 mr-4 whitespace-nowrap cursor-pointer"
                                  >
                                    <i className="ri-edit-line mr-1"></i>编辑
                                  </button>
                                  {indicator.is_deletable === false ? (
                                    <span
                                      title="核心指标，不可删除"
                                      className="inline-flex items-center gap-1 text-xs text-gray-300 cursor-not-allowed select-none"
                                    >
                                      <i className="ri-lock-line"></i>不可删除
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleDelete(indicator)}
                                      className="text-red-500 hover:text-red-700 whitespace-nowrap cursor-pointer"
                                    >
                                      <i className="ri-delete-bin-line mr-1"></i>删除
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 弹窗 */}
      {editModalOpen && (
        <IndicatorEditModal
          indicator={editingIndicator}
          applicableType={activeTab}
          onClose={() => { setEditModalOpen(false); setWeightError(''); }}
          onSave={handleSave}
          weightError={weightError}
          indicators={allIndicators}
          editingId={editingIndicator?.id}
          allIndicators={allIndicators}
        />
      )}

      {deleteModalOpen && deletingIndicator && (
        <DeleteConfirmModal
          indicatorName={deletingIndicator.indicator_name}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={confirmDelete}
        />
      )}

      {templateModalOpen && (
        <TemplateSaveModal
          onClose={() => setTemplateModalOpen(false)}
          onSave={handleSaveTemplate}
        />
      )}

      {deleteTemplateModalOpen && deletingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">删除模板</h2>
              <button onClick={() => setDeleteTemplateModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-3 mb-6">
                <div className="w-10 h-10 flex items-center justify-center bg-red-100 rounded-full flex-shrink-0">
                  <i className="ri-error-warning-line text-red-600 text-xl"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-800 font-medium">确定要删除模板「{deletingTemplate.template_name}」吗？</p>
                  <p className="text-sm text-gray-500 mt-1">删除后，该模板下的所有指标配置将一并移除，此操作不可恢复。</p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteTemplateModalOpen(false)} className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap cursor-pointer">取消</button>
                <button onClick={confirmDeleteTemplate} className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 whitespace-nowrap cursor-pointer">确认删除</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
