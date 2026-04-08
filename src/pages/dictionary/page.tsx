import { useState } from 'react';
import FieldConfigTab from './components/FieldConfigTab';
import DictionaryItemTab from './components/DictionaryItemTab';
import VersionHistoryModal from './components/VersionHistoryModal';
import PublishSuccessModal from './components/PublishSuccessModal';
import PublishConfirmModal from './components/PublishConfirmModal';
import { useDictionaryVersions } from '../../hooks/useDictionaryVersions';
import type { PendingChange } from '../../hooks/useDictionaryVersions';
import { useAuth } from '../../contexts/AuthContext';

export default function DictionaryConfig() {
  const [activeTab, setActiveTab] = useState<'field' | 'dictionary'>('field');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showPublishSuccess, setShowPublishSuccess] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [publishResult, setPublishResult] = useState<{
    versionNumber: string;
    changeCount: number;
    publishTime: string;
  } | null>(null);
  const { canEdit } = useAuth();
  const hasEditPermission = canEdit('dictionary');

  const { versions, createVersion } = useDictionaryVersions();
  const currentVersion = versions.length > 0 ? versions[0].version_number : 'V1.0';

  const handlePublish = () => {
    if (pendingChanges.length === 0) {
      alert('暂无待发布的配置变更');
      return;
    }
    setShowPublishConfirm(true);
  };

  const handleConfirmPublish = async () => {
    setShowPublishConfirm(false);
    setIsPublishing(true);

    // 执行发布
    const result = await createVersion(pendingChanges, '管理员');

    setIsPublishing(false);

    if (result.success && result.version) {
      setPendingChanges([]);
      setPublishResult({
        versionNumber: result.version.version_number,
        changeCount: pendingChanges.length,
        publishTime: new Date(result.version.publish_time).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      });
      setShowPublishSuccess(true);
    } else {
      alert(`发布失败: ${result.error || '未知错误'}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 顶部固定区域 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">数据字典配置</h1>
              <p className="text-sm text-gray-500">配置数据填报模块的字段规则和字典项</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                当前版本: {currentVersion}
              </div>
              <button
                onClick={() => setShowVersionHistory(true)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap flex items-center gap-2"
              >
                <i className="ri-history-line text-base"></i>
                版本历史
              </button>
              {hasEditPermission && (
                <button
                  onClick={handlePublish}
                  className={`relative px-6 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                    pendingChanges.length > 0
                      ? 'bg-orange-600 text-white hover:bg-orange-700 cursor-pointer'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                  disabled={pendingChanges.length === 0}
                >
                  <i className="ri-upload-cloud-line text-base"></i>
                  发布配置
                  {pendingChanges.length > 0 && (
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {pendingChanges.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Tab切换 */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('field')}
              className={`px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
                activeTab === 'field'
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              字段配置管理
              {activeTab === 'field' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('dictionary')}
              className={`px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
                activeTab === 'dictionary'
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              下拉字典项配置
              {activeTab === 'dictionary' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="px-8 py-6">
        {activeTab === 'field' ? (
          <FieldConfigTab
            pendingChanges={pendingChanges}
            onPendingChangesUpdate={setPendingChanges}
            readOnly={!hasEditPermission}
          />
        ) : (
          <DictionaryItemTab readOnly={!hasEditPermission} />
        )}
      </div>

      {/* 版本历史弹窗 */}
      {showVersionHistory && (
        <VersionHistoryModal onClose={() => setShowVersionHistory(false)} />
      )}

      {/* 发布确认弹窗 */}
      {showPublishConfirm && (
        <PublishConfirmModal
          pendingChanges={pendingChanges}
          onConfirm={handleConfirmPublish}
          onCancel={() => setShowPublishConfirm(false)}
        />
      )}

      {/* 发布成功弹窗 */}
      {showPublishSuccess && publishResult && (
        <PublishSuccessModal
          versionNumber={publishResult.versionNumber}
          changeCount={publishResult.changeCount}
          publishTime={publishResult.publishTime}
          onClose={() => {
            setShowPublishSuccess(false);
            setPublishResult(null);
          }}
        />
      )}

      {/* 发布中动画弹窗 */}
      {isPublishing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-12 py-10 flex flex-col items-center gap-5 shadow-xl">
            {/* 旋转圆环 */}
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 animate-spin" viewBox="0 0 64 64" fill="none">
                <circle
                  cx="32" cy="32" r="26"
                  stroke="#e5e7eb"
                  strokeWidth="6"
                />
                <circle
                  cx="32" cy="32" r="26"
                  stroke="#d97706"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="60 104"
                  strokeDashoffset="0"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="ri-upload-cloud-line text-orange-500 text-xl"></i>
              </div>
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-800">正在发布配置</p>
              <p className="text-sm text-gray-400 mt-1">请稍候，系统正在生成新版本…</p>
            </div>
            {/* 进度点动画 */}
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-orange-400"
                  style={{
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}