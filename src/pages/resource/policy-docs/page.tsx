import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import DraftTab from './components/DraftTab';
import ReviewTab from './components/ReviewTab';
import PublishTab from './components/PublishTab';
import ArchiveTab from './components/ArchiveTab';

const TABS = [
  { key: 'draft', label: '文件起草', icon: 'ri-draft-line', desc: '创建与编辑草稿文件' },
  { key: 'review', label: '审核流程', icon: 'ri-git-branch-line', desc: '初审·复审·终审链' },
  { key: 'publish', label: '文件发布', icon: 'ri-send-plane-line', desc: '审批通过后发布文件' },
  { key: 'archive', label: '归档检索', icon: 'ri-archive-line', desc: '历史文件分类检索' },
];

export default function PolicyDocsPage() {
  const [activeTab, setActiveTab] = useState('draft');
  const { canEdit } = useAuth();
  const hasEditPermission = canEdit('resource_policy_docs');

  const current = TABS.find(t => t.key === activeTab)!;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center bg-teal-50 rounded-lg">
            <i className="ri-file-text-line text-teal-600 text-lg"></i>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">考核政策文件管理</h1>
            <p className="text-sm text-gray-500 mt-0.5">起草 · 审核 · 发布 · 归档 全流程数字化管理</p>
          </div>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors relative whitespace-nowrap cursor-pointer ${
                activeTab === tab.key
                  ? 'text-teal-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className={`${tab.icon} text-base`}></i>
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'draft' && <DraftTab hasEditPermission={hasEditPermission} />}
        {activeTab === 'review' && <ReviewTab hasEditPermission={hasEditPermission} />}
        {activeTab === 'publish' && <PublishTab hasEditPermission={hasEditPermission} />}
        {activeTab === 'archive' && <ArchiveTab />}
      </div>
    </div>
  );
}
