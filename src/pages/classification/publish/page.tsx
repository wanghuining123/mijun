import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import PublishFilters from "./components/PublishFilters";
import ClassificationList from "./components/ClassificationList";
import PrintView from "./components/PrintView";
import OperationHistoryModal from "./components/OperationHistoryModal";

interface ClassificationRecord {
  id: string;
  enterprise_id: string;
  enterprise_name: string;
  industry: string;
  industry_code: string;
  comprehensive_score: number;
  classification_grade: string;
  year: number;
  is_above_scale: boolean;
}

interface ExemptEnterprise {
  id: string;
  enterprise_name: string;
  exempt_reason: string;
  marked_by: string;
  marked_at: string;
}

interface ProtectionEnterprise {
  id: string;
  enterprise_name: string;
  protection_reason: string;
  protection_months: number;
  start_date: string;
  end_date: string;
  status: "active" | "expired";
}

interface DishonestEnterprise {
  id: string;
  enterprise_name: string;
  credit_code: string;
  reason: string;
  punishment_measures: string;
  marked_by: string;
  marked_at: string;
}

export interface Policy {
  id: string;
  policy_name: string;
  policy_type: string;
  policy_content: string;
  applicable_grades: string[];
  status: string;
  effective_date: string;
}

interface PushInfo {
  templateName: string;
  ruleName: string;
  pushTime: string;
  enterpriseCount: number;
}

const GRADE_CONFIG = {
  A: { label: 'A类', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  B: { label: 'B类', color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  C: { label: 'C类', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  D: { label: 'D类', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' },
};

const POLICY_TYPE_COLOR: Record<string, string> = {
  '用地': 'bg-violet-100 text-violet-700',
  '信贷': 'bg-sky-100 text-sky-700',
  '用能': 'bg-orange-100 text-orange-700',
  '其他': 'bg-gray-100 text-gray-600',
};

export default function PublishPage() {
  const currentYear = new Date().getFullYear();
  const [searchParams] = useSearchParams();

  const initYear = searchParams.get("year") ? Number(searchParams.get("year")) : currentYear;
  const initGrade = searchParams.get("grade") || "all";
  const initIndustry = searchParams.get("industry") || "all";

  const [selectedYear, setSelectedYear] = useState<number>(initYear);
  const [selectedIndustry, setSelectedIndustry] = useState<string>(initIndustry);
  const [selectedGrade, setSelectedGrade] = useState<string>(initGrade);
  const [records, setRecords] = useState<ClassificationRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ClassificationRecord[]>([]);
  const [industries, setIndustries] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [exemptEnterprises, setExemptEnterprises] = useState<ExemptEnterprise[]>([]);
  const [protectionEnterprises, setProtectionEnterprises] = useState<ProtectionEnterprise[]>([]);
  const [dishonestEnterprises, setDishonestEnterprises] = useState<DishonestEnterprise[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [policyPanelGrade, setPolicyPanelGrade] = useState<string>('A');
  const [showPolicyPanel, setShowPolicyPanel] = useState(true);
  const [pushInfo, setPushInfo] = useState<PushInfo | null>(null);
  const [showOperationHistory, setShowOperationHistory] = useState(false);

  // 加载差别化政策
  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        const { data, error } = await supabase
          .from('differentiated_policies')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        if (!error && data) setPolicies(data as Policy[]);
      } catch (e) {
        console.error('加载差别化政策失败:', e);
      }
    };
    fetchPolicies();
  }, []);

  // 从数据字典加载行业列表
  useEffect(() => {
    const loadIndustries = async () => {
      try {
        const { data: fields } = await supabase
          .from("dictionary_fields")
          .select("code")
          .ilike("name", "%行业%")
          .eq("status", "enabled")
          .limit(5);

        let fieldCode = "industry";
        if (fields && fields.length > 0) {
          fieldCode = fields[0].code;
        }

        const { data: items } = await supabase
          .from("dictionary_items")
          .select("code, name")
          .eq("field_code", fieldCode)
          .order("sort_order", { ascending: true });

        if (items && items.length > 0) {
          setIndustries(items.map((i: any) => ({ code: i.code, name: i.name })));
        }
      } catch (err) {
        console.error("加载行业字典失败:", err);
      }
    };
    loadIndustries();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      let industryMap = new Map<string, string>();
      try {
        const { data: fields } = await supabase
          .from("dictionary_fields")
          .select("code")
          .ilike("name", "%行业%")
          .eq("status", "enabled")
          .limit(5);

        let fieldCode = "industry";
        if (fields && fields.length > 0) {
          fieldCode = fields[0].code;
        }

        const { data: dictItems } = await supabase
          .from("dictionary_items")
          .select("code, name")
          .eq("field_code", fieldCode);

        if (dictItems) {
          dictItems.forEach((item: any) => {
            industryMap.set(item.code, item.name);
          });
        }
      } catch (e) {
        console.error("加载行业字典映射失败:", e);
      }

      const { data: yearRecords, error: yrError } = await supabase
        .from("enterprise_year_records")
        .select("enterprise_id, comprehensive_score, classification_grade, industry_code, updated_at, template_id, rule_id")
        .eq("year", selectedYear)
        .not("classification_grade", "is", null)
        .not("comprehensive_score", "is", null)
        .order("updated_at", { ascending: false });

      if (yrError) throw yrError;

      if (!yearRecords || yearRecords.length === 0) {
        setRecords([]);
        setLastUpdated(null);
        setPushInfo(null);
        return;
      }

      // 读取模板和规则信息
      const firstRecord = yearRecords[0];
      if (firstRecord.template_id || firstRecord.rule_id) {
        let templateName = "未知模板";
        let ruleName = "未知规则";

        if (firstRecord.template_id) {
          const { data: templateData } = await supabase
            .from("indicator_templates")
            .select("template_name")
            .eq("id", firstRecord.template_id)
            .maybeSingle();
          if (templateData) templateName = templateData.template_name;
        }

        if (firstRecord.rule_id) {
          const { data: ruleData } = await supabase
            .from("classification_rules")
            .select("rule_name")
            .eq("id", firstRecord.rule_id)
            .maybeSingle();
          if (ruleData) ruleName = ruleData.rule_name;
        }

        // 查询最近一次推送留痕记录
        const { data: pushRecord } = await supabase
          .from("data_push_records")
          .select("created_at, enterprise_count")
          .eq("operation_type", "push")
          .eq("year", selectedYear)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setPushInfo({
          templateName,
          ruleName,
          pushTime: pushRecord?.created_at ? new Date(pushRecord.created_at).toLocaleString("zh-CN") : new Date(firstRecord.updated_at).toLocaleString("zh-CN"),
          enterpriseCount: pushRecord?.enterprise_count || yearRecords.length,
        });
      } else {
        setPushInfo(null);
      }

      const enterpriseIds = yearRecords.map((r: any) => r.enterprise_id);
      const { data: enterprisesData, error: entError } = await supabase
        .from("enterprises")
        .select("id, name, scale")
        .in("id", enterpriseIds);

      if (entError) throw entError;

      const enterpriseMap = new Map(
        (enterprisesData || []).map((e: any) => [e.id, e])
      );

      const formattedRecords: ClassificationRecord[] = yearRecords
        .map((yr: any) => {
          const ent = enterpriseMap.get(yr.enterprise_id) as any;
          if (!ent) return null;
          const industryCode = yr.industry_code || "";
          const industryName = industryMap.get(industryCode) || industryCode || "未分类";
          return {
            id: yr.enterprise_id,
            enterprise_id: yr.enterprise_id,
            enterprise_name: ent.name || "未知企业",
            industry: industryName,
            industry_code: industryCode,
            comprehensive_score: Number(yr.comprehensive_score) || 0,
            classification_grade: yr.classification_grade || "-",
            year: selectedYear,
            is_above_scale: ent.scale === "规上",
          };
        })
        .filter(Boolean) as ClassificationRecord[];

      setRecords(formattedRecords);

      if (yearRecords.length > 0) {
        const latest = yearRecords[0].updated_at;
        setLastUpdated(latest ? new Date(latest).toLocaleString("zh-CN") : null);
      }
    } catch (error) {
      console.error("加载分类记录失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [selectedYear]);

  useEffect(() => {
    let filtered = records.filter((record) => {
      if (selectedIndustry !== "all" && record.industry_code !== selectedIndustry) return false;
      if (selectedGrade !== "all" && record.classification_grade !== selectedGrade) return false;
      return true;
    });
    filtered.sort((a, b) => b.comprehensive_score - a.comprehensive_score);
    setFilteredRecords(filtered);
  }, [records, selectedIndustry, selectedGrade]);

  const handleExportPDF = async () => {
    const { data: exemptData } = await supabase
      .from("exempt_enterprises")
      .select("id, enterprise_name, exempt_reason, marked_by, marked_at")
      .order("created_at", { ascending: false });

    const { data: protectionData } = await supabase
      .from("protection_period_enterprises")
      .select("id, enterprise_name, protection_reason, protection_months, start_date, end_date, status")
      .order("created_at", { ascending: false });

    // 查询惩戒中的失信企业，关联企业表获取信用代码
    const { data: dishonestData } = await supabase
      .from("dishonest_enterprises")
      .select("id, enterprise_id, reason, punishment_measures, marked_by, marked_at")
      .eq("status", "active")
      .order("marked_at", { ascending: false });

    let dishonestList: DishonestEnterprise[] = [];
    if (dishonestData && dishonestData.length > 0) {
      const enterpriseIds = dishonestData.map((d: any) => d.enterprise_id);
      const { data: entData } = await supabase
        .from("enterprises")
        .select("id, name, credit_code")
        .in("id", enterpriseIds);
      const entMap = new Map((entData || []).map((e: any) => [e.id, e]));
      dishonestList = dishonestData.map((d: any) => {
        const ent = entMap.get(d.enterprise_id) as any;
        return {
          id: d.id,
          enterprise_name: ent?.name || "未知企业",
          credit_code: ent?.credit_code || "-",
          reason: d.reason,
          punishment_measures: d.punishment_measures,
          marked_by: d.marked_by,
          marked_at: d.marked_at,
        };
      });
    }

    setExemptEnterprises((exemptData as ExemptEnterprise[]) || []);
    setProtectionEnterprises((protectionData as ProtectionEnterprise[]) || []);
    setDishonestEnterprises(dishonestList);
    setShowPreview(true);

    // 导出PDF留痕：写入 operation_audit_logs 表
    try {
      const templateName = pushInfo?.templateName || "未知模板";
      const ruleName = pushInfo?.ruleName || "未知规则";
      
      await supabase.from("operation_audit_logs").insert({
        operation_type: "export_pdf",
        operation_year: selectedYear,
        template_name: templateName,
        rule_name: ruleName,
        enterprise_count: filteredRecords.length,
        operator: "系统管理员",
        operation_time: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("导出PDF留痕失败:", error);
    }
  };

  const activePoliciesForGrade = policies.filter(p => p.applicable_grades.includes(policyPanelGrade));

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {showPreview && (
        <PrintView
          year={selectedYear}
          records={filteredRecords}
          exemptEnterprises={exemptEnterprises}
          protectionEnterprises={protectionEnterprises}
          dishonestEnterprises={dishonestEnterprises}
          templateName={pushInfo?.templateName || "未知模板"}
          ruleName={pushInfo?.ruleName || "未知规则"}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showOperationHistory && (
        <OperationHistoryModal
          year={selectedYear}
          onClose={() => setShowOperationHistory(false)}
        />
      )}

      {/* 页面标题 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">名单公示发布</h1>
            <p className="text-sm text-gray-500 mt-1">
              展示自动计算推送的企业分类名单，支持筛选和导出PDF用于门户网站公示
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <i className="ri-time-line"></i>
                <span>数据更新于 {lastUpdated}</span>
              </div>
            )}
            <button
              onClick={() => setShowOperationHistory(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-history-line"></i>
              操作记录
            </button>
            <button
              onClick={() => setShowPolicyPanel(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className={`ri-${showPolicyPanel ? 'eye-off' : 'eye'}-line`}></i>
              {showPolicyPanel ? '隐藏政策面板' : '显示政策面板'}
            </button>
            <button
              onClick={loadRecords}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-refresh-line"></i>
              刷新
            </button>
            <button
              onClick={handleExportPDF}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              <i className="ri-file-pdf-line text-base"></i>
              导出PDF用于公示
            </button>
          </div>
        </div>

        {/* 推送信息展示 */}
        {pushInfo && (
          <div className="mt-3 flex items-center gap-3 p-3 bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg">
            <div className="flex items-center gap-2">
              <i className="ri-information-line text-teal-600 text-base"></i>
              <span className="text-xs font-medium text-gray-700">本年度评价配置</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-white border border-teal-200 rounded-md text-xs font-medium text-teal-700">
                <i className="ri-file-list-3-line mr-1"></i>
                模板：{pushInfo.templateName}
              </span>
              <span className="px-2.5 py-1 bg-white border border-cyan-200 rounded-md text-xs font-medium text-cyan-700">
                <i className="ri-settings-3-line mr-1"></i>
                规则：{pushInfo.ruleName}
              </span>
            </div>
            <div className="h-4 w-px bg-teal-300"></div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <i className="ri-time-line"></i>
              <span>推送时间：{pushInfo.pushTime}</span>
              <span className="text-gray-400">|</span>
              <span>推送企业：{pushInfo.enterpriseCount} 家</span>
            </div>
          </div>
        )}

        {!pushInfo && records.length === 0 && !loading && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <i className="ri-alert-line text-amber-600 text-base"></i>
            <span className="text-xs text-amber-700">暂无推送记录，请先在「评价计算 - 自动计算功能」中执行计算并推送</span>
          </div>
        )}
      </div>

      {/* 差别化政策概览面板 */}
      {showPolicyPanel && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="ri-government-line text-teal-600 text-base"></i>
              <span className="text-sm font-semibold text-gray-800">差别化政策配置</span>
              <span className="text-xs text-gray-400 ml-1">— 各等级企业对应的政策措施</span>
            </div>
            <a
              href="/resource/policy"
              className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
            >
              <i className="ri-settings-3-line"></i>
              管理政策配置
            </a>
          </div>

          {/* 等级切换 */}
          <div className="flex gap-2 mb-3">
            {(['A', 'B', 'C', 'D'] as const).map(grade => {
              const cfg = GRADE_CONFIG[grade];
              const count = policies.filter(p => p.applicable_grades.includes(grade)).length;
              return (
                <button
                  key={grade}
                  onClick={() => setPolicyPanelGrade(grade)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap border ${
                    policyPanelGrade === grade
                      ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`}></span>
                  {cfg.label}企业
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                    policyPanelGrade === grade ? 'bg-white/70' : 'bg-gray-200'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 政策列表 */}
          {activePoliciesForGrade.length === 0 ? (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
              <i className="ri-information-line"></i>
              <span>暂未配置 {policyPanelGrade} 类企业的差别化政策，请前往「差别化政策配置」页面添加</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {activePoliciesForGrade.map(policy => (
                <div
                  key={policy.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${GRADE_CONFIG[policyPanelGrade as keyof typeof GRADE_CONFIG]?.bg} ${GRADE_CONFIG[policyPanelGrade as keyof typeof GRADE_CONFIG]?.border}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${POLICY_TYPE_COLOR[policy.policy_type] || 'bg-gray-100 text-gray-600'}`}>
                      {policy.policy_type}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{policy.policy_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{policy.policy_content}</p>
                    <p className="text-xs text-gray-400 mt-1">生效：{policy.effective_date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 筛选栏 */}
      <PublishFilters
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        selectedIndustry={selectedIndustry}
        onIndustryChange={setSelectedIndustry}
        industries={industries}
        selectedGrade={selectedGrade}
        onGradeChange={setSelectedGrade}
      />

      {/* 分类名单列表 */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <i className="ri-loader-4-line text-3xl text-teal-600 animate-spin"></i>
              <p className="text-sm text-gray-500 mt-2">加载中...</p>
            </div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <i className="ri-file-list-3-line text-5xl text-gray-300"></i>
            <p className="text-gray-500 mt-4">暂无符合条件的分类记录</p>
            <p className="text-sm text-gray-400 mt-2">
              请先在「评价计算 - 自动计算功能」中执行计算，并点击「应用到名单公示发布」推送结果
            </p>
          </div>
        ) : (
          <ClassificationList records={filteredRecords} policies={policies} />
        )}
      </div>
    </div>
  );
}