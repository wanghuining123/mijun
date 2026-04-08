import { useRef, useState } from "react";

// @ts-expect-error html2pdf.js 没有类型声明文件
import html2pdf from "html2pdf.js";

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

interface PrintViewProps {
  year: number;
  records: ClassificationRecord[];
  exemptEnterprises: ExemptEnterprise[];
  protectionEnterprises: ProtectionEnterprise[];
  dishonestEnterprises: DishonestEnterprise[];
  templateName: string;
  ruleName: string;
  onClose: () => void;
}

const GRADE_CONFIG = {
  A: {
    label: "优质企业（A类）",
    color: "#16a34a",
    bgColor: "#f0fdf4",
    borderColor: "#86efac",
    desc: "享受优先续租、政策奖励等扶持措施",
  },
  B: {
    label: "良好企业（B类）",
    color: "#0891b2",
    bgColor: "#ecfeff",
    borderColor: "#67e8f9",
    desc: "维持现有政策支持",
  },
  C: {
    label: "一般企业（C类）",
    color: "#d97706",
    bgColor: "#fffbeb",
    borderColor: "#fcd34d",
    desc: "纳入提升引导计划",
  },
  D: {
    label: "落后企业（D类）",
    color: "#dc2626",
    bgColor: "#fef2f2",
    borderColor: "#fca5a5",
    desc: "列入整改督促名单，限期提升",
  },
};

export default function PrintView({ year, records, exemptEnterprises, protectionEnterprises, dishonestEnterprises, templateName, ruleName, onClose }: PrintViewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const today = new Date();
  const dateStr = today.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const publicEndDate = new Date(today);
  publicEndDate.setDate(publicEndDate.getDate() + 30);
  const endDateStr = publicEndDate.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const gradeGroups: Record<string, ClassificationRecord[]> = { A: [], B: [], C: [], D: [] };
  records.forEach((r) => {
    if (r.classification_grade in gradeGroups) {
      gradeGroups[r.classification_grade].push(r);
    }
  });
  Object.keys(gradeGroups).forEach((g) => {
    gradeGroups[g].sort((a, b) => b.comprehensive_score - a.comprehensive_score);
  });

  const totalCount = records.length;

  const handlePrint = async () => {
    const element = printRef.current;
    if (!element) return;

    setDownloading(true);
    try {
      const opt = {
        margin: [10, 12, 10, 12],
        filename: `${year}年度企业分类名单公示.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
          allowTaint: true,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };
      await html2pdf().set(opt).from(element).save();
    } finally {
      setDownloading(false);
    }
  };

  // 通用表格样式
  const thStyle: React.CSSProperties = { border: "1px solid #d1d5db", padding: "8px 12px", textAlign: "left", fontWeight: "bold", background: "#f3f4f6" };
  const tdStyle: React.CSSProperties = { border: "1px solid #d1d5db", padding: "7px 12px" };
  const tdAltStyle: React.CSSProperties = { ...tdStyle, background: "#fafafa" };
  const creditCodeStyle: React.CSSProperties = {
    fontFamily: '"Courier New", Courier, "Lucida Console", monospace',
    letterSpacing: "0.05em",
    fontSize: 12,
    color: "#555",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col" style={{ width: 860, maxHeight: "92vh" }}>
        {/* 弹窗顶栏 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <i className="ri-file-text-line text-lg text-teal-600"></i>
            <span className="font-semibold text-gray-800 text-sm">名单公示预览</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={downloading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <>
                  <i className="ri-loader-4-line text-base animate-spin"></i>
                  生成中...
                </>
              ) : (
                <>
                  <i className="ri-download-line text-base"></i>
                  下载PDF
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>
        </div>

        {/* 预览内容区 */}
        <div className="flex-1 overflow-auto bg-gray-100 p-6">
          <div ref={printRef} className="print-wrap bg-white mx-auto shadow-sm" style={{ maxWidth: 760, padding: "40px 48px", fontFamily: '"SimSun", "宋体", serif' }}>

            {/* 机构名称 */}
            <div className="header">
              <p style={{ textAlign: "center", fontSize: 13, color: "#666", marginBottom: 8, letterSpacing: 2 }}>
                济南市历下区工业和信息化局
              </p>
              <h1 style={{ textAlign: "center", fontSize: 20, fontWeight: "bold", letterSpacing: 3, marginBottom: 4 }}>
                历下区工业企业亩均效益综合评价
              </h1>
              <h2 style={{ textAlign: "center", fontSize: 17, fontWeight: "bold", letterSpacing: 2, marginBottom: 16 }}>
                {year} 年度企业分类名单公示
              </h2>
              <div style={{ display: "flex", justifyContent: "center", gap: 24, fontSize: 12, color: "#555", borderTop: "1px solid #ccc", borderBottom: "1px solid #ccc", padding: "8px 0" }}>
                <span>公示日期：{dateStr}</span>
                <span>｜</span>
                <span>公示期：{dateStr} 至 {endDateStr}</span>
              </div>
            </div>

            {/* 公示说明 */}
            <div style={{ margin: "20px 0", padding: "14px 16px", background: "#f9f9f9", border: "1px solid #e5e7eb", fontSize: 13, lineHeight: 1.9, color: "#333" }}>
              <p style={{ fontWeight: "bold", marginBottom: 6 }}>公示说明：</p>
              <p>
                根据《济南市历下区工业企业亩均效益综合评价实施办法》，现将 {year} 年度历下区工业企业亩均效益综合评价分类结果予以公示。本次评价共涉及企业 {totalCount} 家，按综合得分分为A、B、C、D四类。公示期间，如有异议，请向历下区工业和信息化局反映。
              </p>
              <p style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #d1d5db", fontSize: 12, color: "#666" }}>
                <strong>评价配置：</strong>本次评价使用指标体系模板「{templateName}」，分类规则「{ruleName}」。
              </p>
            </div>

            {/* 各等级分组 */}
            {(["A", "B", "C", "D"] as const).map((grade) => {
              const group = gradeGroups[grade];
              if (group.length === 0) return null;
              const cfg = GRADE_CONFIG[grade];
              return (
                <div key={grade} style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", borderLeft: `4px solid ${cfg.color}`, paddingLeft: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: "bold", color: cfg.color }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: 12, color: "#666", marginLeft: 10 }}>
                      （共 {group.length} 家）— {cfg.desc}
                    </span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f3f4f6" }}>
                        <th style={{ ...thStyle, width: 48 }}>序号</th>
                        <th style={thStyle}>企业名称</th>
                        <th style={{ ...thStyle, width: 160 }}>统一社会信用代码</th>
                        <th style={{ ...thStyle, width: 72 }}>企业类型</th>
                        <th style={{ ...thStyle, width: 80 }}>综合得分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((record, idx) => (
                        <tr key={record.id}>
                          <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>{idx + 1}</td>
                          <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>{record.enterprise_name}</td>
                          <td style={{ ...(idx % 2 === 1 ? tdAltStyle : tdStyle), ...creditCodeStyle }}>
                            {record.enterprise_id || "—"}
                          </td>
                          <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>
                            {record.is_above_scale ? "规上" : "规下"}
                          </td>
                          <td style={{ ...(idx % 2 === 1 ? tdAltStyle : tdStyle), fontWeight: "bold" }}>
                            {record.comprehensive_score.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

            {/* ===== 特殊情形：免评企业 ===== */}
            {exemptEnterprises.length > 0 && (
              <div style={{ marginTop: 36, paddingTop: 24, borderTop: "2px dashed #e5e7eb" }}>
                <div style={{ display: "flex", alignItems: "center", borderLeft: "4px solid #7c3aed", paddingLeft: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: "bold", color: "#7c3aed" }}>附：免评企业名单</span>
                  <span style={{ fontSize: 12, color: "#666", marginLeft: 10 }}>（共 {exemptEnterprises.length} 家，不参与综合评价计算）</span>
                </div>
                <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
                  以下企业因行业特殊性或其他原因，本年度不参与亩均效益综合评价。
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f5f3ff" }}>
                      <th style={{ ...thStyle, width: 48, background: "#f5f3ff" }}>序号</th>
                      <th style={{ ...thStyle, background: "#f5f3ff" }}>企业名称</th>
                      <th style={{ ...thStyle, background: "#f5f3ff" }}>免评原因</th>
                      <th style={{ ...thStyle, width: 90, background: "#f5f3ff" }}>标记人</th>
                      <th style={{ ...thStyle, width: 130, background: "#f5f3ff" }}>标记时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exemptEnterprises.map((item, idx) => (
                      <tr key={item.id}>
                        <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>{idx + 1}</td>
                        <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>{item.enterprise_name}</td>
                        <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>{item.exempt_reason}</td>
                        <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>{item.marked_by}</td>
                        <td style={{ ...(idx % 2 === 1 ? tdAltStyle : tdStyle), fontSize: 12, color: "#555" }}>
                          {new Date(item.marked_at).toLocaleDateString("zh-CN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ===== 特殊情形：保护期企业 ===== */}
            {protectionEnterprises.length > 0 && (
              <div style={{ marginTop: 28, paddingTop: 24, borderTop: "2px dashed #e5e7eb" }}>
                <div style={{ display: "flex", alignItems: "center", borderLeft: "4px solid #d97706", paddingLeft: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: "bold", color: "#d97706" }}>附：保护期企业名单</span>
                  <span style={{ fontSize: 12, color: "#666", marginLeft: 10 }}>（共 {protectionEnterprises.length} 家，保护期内暂不参与评价）</span>
                </div>
                <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
                  以下企业处于保护期内（如首次升规、新设立等），本年度暂不参与亩均效益综合评价。
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#fffbeb" }}>
                      <th style={{ ...thStyle, width: 48, background: "#fffbeb" }}>序号</th>
                      <th style={{ ...thStyle, background: "#fffbeb" }}>企业名称</th>
                      <th style={{ ...thStyle, background: "#fffbeb" }}>保护原因</th>
                      <th style={{ ...thStyle, width: 80, background: "#fffbeb" }}>保护时长</th>
                      <th style={{ ...thStyle, width: 100, background: "#fffbeb" }}>开始日期</th>
                      <th style={{ ...thStyle, width: 100, background: "#fffbeb" }}>到期日期</th>
                      <th style={{ ...thStyle, width: 72, background: "#fffbeb" }}>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {protectionEnterprises.map((item, idx) => (
                      <tr key={item.id}>
                        <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>{idx + 1}</td>
                        <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>{item.enterprise_name}</td>
                        <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>{item.protection_reason}</td>
                        <td style={{ ...(idx % 2 === 1 ? tdAltStyle : tdStyle), textAlign: "center" }}>{item.protection_months} 个月</td>
                        <td style={{ ...(idx % 2 === 1 ? tdAltStyle : tdStyle), fontSize: 12 }}>
                          {new Date(item.start_date).toLocaleDateString("zh-CN")}
                        </td>
                        <td style={{ ...(idx % 2 === 1 ? tdAltStyle : tdStyle), fontSize: 12 }}>
                          {new Date(item.end_date).toLocaleDateString("zh-CN")}
                        </td>
                        <td style={{ ...(idx % 2 === 1 ? tdAltStyle : tdStyle), textAlign: "center" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: "bold",
                            background: item.status === "active" ? "#dcfce7" : "#f3f4f6",
                            color: item.status === "active" ? "#16a34a" : "#6b7280",
                          }}>
                            {item.status === "active" ? "保护中" : "已到期"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ===== 附录：失信企业名单 ===== */}
            {dishonestEnterprises.length > 0 && (
              <div style={{ marginTop: 28, paddingTop: 24, borderTop: "2px dashed #e5e7eb" }}>
                <div style={{ display: "flex", alignItems: "center", borderLeft: "4px solid #dc2626", paddingLeft: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: "bold", color: "#dc2626" }}>附：失信企业名单</span>
                  <span style={{ fontSize: 12, color: "#666", marginLeft: 10 }}>（共 {dishonestEnterprises.length} 家，当前惩戒中）</span>
                </div>
                <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
                  以下企业因存在失信行为，已依法列入联合惩戒名单，正处于惩戒期内。
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#fef2f2" }}>
                      <th style={{ ...thStyle, width: 48, background: "#fef2f2" }}>序号</th>
                      <th style={{ ...thStyle, background: "#fef2f2" }}>企业名称</th>
                      <th style={{ ...thStyle, width: 160, background: "#fef2f2" }}>统一社会信用代码</th>
                      <th style={{ ...thStyle, background: "#fef2f2" }}>失信原因</th>
                      <th style={{ ...thStyle, background: "#fef2f2" }}>惩戒措施</th>
                      <th style={{ ...thStyle, width: 90, background: "#fef2f2" }}>标记人</th>
                      <th style={{ ...thStyle, width: 110, background: "#fef2f2" }}>标记时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dishonestEnterprises.map((item, idx) => (
                      <tr key={item.id}>
                        <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>{idx + 1}</td>
                        <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>{item.enterprise_name}</td>
                        <td style={{ ...(idx % 2 === 1 ? tdAltStyle : tdStyle), ...creditCodeStyle }}>
                          {item.credit_code}
                        </td>
                        <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>{item.reason}</td>
                        <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>{item.punishment_measures}</td>
                        <td style={idx % 2 === 1 ? tdAltStyle : tdStyle}>{item.marked_by}</td>
                        <td style={{ ...(idx % 2 === 1 ? tdAltStyle : tdStyle), fontSize: 12, color: "#555" }}>
                          {new Date(item.marked_at).toLocaleDateString("zh-CN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 页脚 */}
            <div style={{ marginTop: 36, display: "flex", justifyContent: "flex-end", flexDirection: "column", alignItems: "flex-end", gap: 4, fontSize: 13, color: "#555" }}>
              <span style={{ fontWeight: "bold", color: "#333" }}>济南市历下区工业和信息化局</span>
              <span>{dateStr}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
