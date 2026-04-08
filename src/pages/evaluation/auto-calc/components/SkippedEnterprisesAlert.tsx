import { useState } from 'react';

type SkipReason = 'no_record' | 'zero_value' | 'protection_period' | 'exempt';

interface SkippedEnterprise {
  id: string;
  name: string;
  scale: string;
  reason: SkipReason;
}

interface SkippedEnterprisesAlertProps {
  skippedEnterprises: SkippedEnterprise[];
  year: number;
}

export default function SkippedEnterprisesAlert({ skippedEnterprises, year }: SkippedEnterprisesAlertProps) {
  const [expanded, setExpanded] = useState(false);

  if (skippedEnterprises.length === 0) return null;

  const noRecordList = skippedEnterprises.filter(e => e.reason === 'no_record');
  const zeroValueList = skippedEnterprises.filter(e => e.reason === 'zero_value');
  const protectionList = skippedEnterprises.filter(e => e.reason === 'protection_period');
  const exemptList = skippedEnterprises.filter(e => e.reason === 'exempt');

  return (
    <div className="mx-6 my-4 border border-amber-200 bg-amber-50 rounded-lg overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-error-warning-line text-amber-500 text-base"></i>
          </div>
          <span className="text-sm font-medium text-amber-800">
            {skippedEnterprises.length} 家企业未参与本次计算
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-200 text-amber-800">
            已跳过
          </span>
          {/* 原因分类小统计 */}
          <div className="flex items-center gap-2 ml-1">
            {exemptList.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-violet-50 text-violet-600 border-violet-200">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block"></span>
                免评企业 {exemptList.length} 家
              </span>
            )}
            {protectionList.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-teal-50 text-teal-600 border-teal-200">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block"></span>
                保护期内 {protectionList.length} 家
              </span>
            )}
            {noRecordList.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-rose-50 text-rose-600 border-rose-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block"></span>
                无年度记录 {noRecordList.length} 家
              </span>
            )}
            {zeroValueList.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-amber-100 text-amber-700 border-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span>
                关键字段为0 {zeroValueList.length} 家
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 cursor-pointer whitespace-nowrap transition-colors ml-2"
        >
          {expanded ? '收起列表' : '查看详情'}
          <div className="w-4 h-4 flex items-center justify-center">
            <i className={`ri-arrow-${expanded ? 'up' : 'down'}-s-line`}></i>
          </div>
        </button>
      </div>

      {/* 展开的企业列表 */}
      {expanded && (
        <div className="border-t border-amber-200 px-4 py-4 space-y-4">

          {/* 免评企业分组 */}
          {exemptList.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-pass-expired-line text-violet-500 text-sm"></i>
                </div>
                <span className="text-xs font-semibold text-violet-700">
                  免评企业（{exemptList.length} 家）
                </span>
                <span className="text-xs text-violet-500">— 已被标记为免评，本次不参与评价计算</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {exemptList.map((enterprise, index) => (
                  <div
                    key={enterprise.id}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-violet-200 rounded-lg"
                  >
                    <span className="text-xs text-violet-300 font-mono w-5 shrink-0">{index + 1}.</span>
                    <span className="text-sm text-gray-800 truncate flex-1">{enterprise.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">
                        {enterprise.scale}
                      </span>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border bg-violet-50 text-violet-600 border-violet-200">
                        <i className="ri-pass-expired-line text-xs"></i>
                        免评
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-violet-600 flex items-start gap-1">
                <i className="ri-lightbulb-line mt-0.5 shrink-0"></i>
                <span>这些企业在「特殊情况处理 - 免评企业」中被标记为免评，不参与本次综合得分计算。如需参与，请前往特殊情况处理页面删除对应记录。</span>
              </p>
            </div>
          )}

          {/* 分割线 */}
          {exemptList.length > 0 && (protectionList.length > 0 || noRecordList.length > 0 || zeroValueList.length > 0) && (
            <div className="border-t border-amber-200"></div>
          )}

          {/* 保护期内分组 */}
          {protectionList.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-shield-check-line text-teal-500 text-sm"></i>
                </div>
                <span className="text-xs font-semibold text-teal-700">
                  保护期内企业（{protectionList.length} 家）
                </span>
                <span className="text-xs text-teal-500">— 当前处于保护期，本次不参与评价计算</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {protectionList.map((enterprise, index) => (
                  <div
                    key={enterprise.id}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-teal-200 rounded-lg"
                  >
                    <span className="text-xs text-teal-300 font-mono w-5 shrink-0">{index + 1}.</span>
                    <span className="text-sm text-gray-800 truncate flex-1">{enterprise.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">
                        {enterprise.scale}
                      </span>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border bg-teal-50 text-teal-600 border-teal-200">
                        <i className="ri-shield-check-line text-xs"></i>
                        保护期
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-teal-600 flex items-start gap-1">
                <i className="ri-lightbulb-line mt-0.5 shrink-0"></i>
                <span>这些企业在「特殊情况处理 - 保护期企业」中被标记为保护期内，保护期到期后将自动参与计算。如需提前参与，请前往特殊情况处理页面删除对应记录。</span>
              </p>
            </div>
          )}

          {/* 分割线 */}
          {protectionList.length > 0 && (noRecordList.length > 0 || zeroValueList.length > 0) && (
            <div className="border-t border-amber-200"></div>
          )}

          {/* 无年度记录分组 */}
          {noRecordList.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-file-unknow-line text-rose-500 text-sm"></i>
                </div>
                <span className="text-xs font-semibold text-rose-700">
                  无年度记录（{noRecordList.length} 家）
                </span>
                <span className="text-xs text-rose-500">— 数据库中不存在 {year} 年的年度数据</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {noRecordList.map((enterprise, index) => (
                  <div
                    key={enterprise.id}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-rose-200 rounded-lg"
                  >
                    <span className="text-xs text-rose-300 font-mono w-5 shrink-0">{index + 1}.</span>
                    <span className="text-sm text-gray-800 truncate flex-1">{enterprise.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">
                        {enterprise.scale}
                      </span>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border bg-rose-50 text-rose-600 border-rose-200">
                        <i className="ri-file-unknow-line text-xs"></i>
                        无记录
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-rose-600 flex items-start gap-1">
                <i className="ri-lightbulb-line mt-0.5 shrink-0"></i>
                <span>请前往「企业管理」找到对应企业，点击「编辑」后补录 {year} 年的年度指标数据，再重新执行计算。</span>
              </p>
            </div>
          )}

          {/* 分割线 */}
          {noRecordList.length > 0 && zeroValueList.length > 0 && (
            <div className="border-t border-amber-200"></div>
          )}

          {/* 关键字段为0分组 */}
          {zeroValueList.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-error-warning-line text-amber-500 text-sm"></i>
                </div>
                <span className="text-xs font-semibold text-amber-700">
                  关键字段为0导致无法计算（{zeroValueList.length} 家）
                </span>
                <span className="text-xs text-amber-500">— 存在年度记录，但指标公式分母为0</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {zeroValueList.map((enterprise, index) => (
                  <div
                    key={enterprise.id}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-amber-200 rounded-lg"
                  >
                    <span className="text-xs text-amber-300 font-mono w-5 shrink-0">{index + 1}.</span>
                    <span className="text-sm text-gray-800 truncate flex-1">{enterprise.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">
                        {enterprise.scale}
                      </span>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border bg-amber-50 text-amber-600 border-amber-300">
                        <i className="ri-error-warning-line text-xs"></i>
                        字段为0
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-amber-600 flex items-start gap-1">
                <i className="ri-lightbulb-line mt-0.5 shrink-0"></i>
                <span>这些企业有 {year} 年的数据记录，但「自有房屋面积」「承租房屋面积」等关键字段值为 0，导致指标公式分母为 0 无法计算。请检查并修正这些字段后重新计算。</span>
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
