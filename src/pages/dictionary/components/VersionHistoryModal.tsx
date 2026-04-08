import { useEffect, useState } from 'react';
import { useDictionaryVersions, DictionaryVersion } from '../../../hooks/useDictionaryVersions';

interface VersionHistoryModalProps {
  onClose: () => void;
}

export default function VersionHistoryModal({ onClose }: VersionHistoryModalProps) {
  const { versions, loading, fetchVersions } = useDictionaryVersions();
  const [currentVersionId, setCurrentVersionId] = useState<string>('');

  useEffect(() => {
    fetchVersions();
  }, []);

  useEffect(() => {
    // 获取最新版本作为当前版本
    if (versions.length > 0) {
      setCurrentVersionId(versions[0].id);
    }
  }, [versions]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">数据字典版本历史</h3>
            <p className="text-sm text-gray-500 mt-1">共 {versions.length} 个版本</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">暂无版本记录</div>
          ) : (
            <div className="space-y-6">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* 版本头部 */}
                  <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h4 className="text-base font-semibold text-gray-900">
                          {version.version_number}
                        </h4>
                        {version.id === currentVersionId && (
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded whitespace-nowrap">
                            当前版本
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(version.publish_time).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })} · {version.operator}
                      </div>
                    </div>
                  </div>

                  {/* 变更内容 */}
                  <div className="p-5">
                    {version.change_summary && version.change_summary.length > 0 ? (
                      <div className="space-y-3">
                        {version.change_summary.map((change, index) => (
                          <div
                            key={index}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-start gap-2">
                              <div
                                className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                                  change.operation === '新增'
                                    ? 'bg-blue-50'
                                    : change.operation === '修改'
                                    ? 'bg-orange-50'
                                    : 'bg-red-50'
                                }`}
                              >
                                <i
                                  className={`text-sm ${
                                    change.operation === '新增'
                                      ? 'ri-add-line text-blue-600'
                                      : change.operation === '修改'
                                      ? 'ri-edit-line text-orange-600'
                                      : 'ri-delete-bin-line text-red-600'
                                  }`}
                                ></i>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 text-xs rounded whitespace-nowrap ${
                                      change.operation === '新增'
                                        ? 'bg-blue-100 text-blue-700'
                                        : change.operation === '修改'
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {change.operation}
                                  </span>
                                  <span className="text-sm font-medium text-gray-900">
                                    {change.field_name}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">无变更记录</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}