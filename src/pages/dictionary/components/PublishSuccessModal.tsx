import React from 'react';

interface PublishSuccessModalProps {
  onClose: () => void;
  versionNumber: string;
  changeCount: number;
  publishTime: string;
}

export default function PublishSuccessModal({
  onClose,
  versionNumber,
  changeCount,
  publishTime,
}: PublishSuccessModalProps) {
  const safeOnClose = React.useCallback(() => {
    if (typeof onClose === 'function') {
      try {
        onClose();
      } catch (err) {
        console.error('PublishSuccessModal: onClose callback threw an error', err);
      }
    } else {
      console.warn('PublishSuccessModal: onClose prop is not a function');
    }
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg">
        <div className="p-6">
          {/* 成功图标 */}
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-checkbox-circle-fill text-4xl text-emerald-600"></i>
          </div>

          {/* 标题 */}
          <h3 className="text-xl font-semibold text-gray-900 text-center mb-6">
            发布成功
          </h3>

          {/* 发布信息 */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <span className="text-sm text-gray-600">新版本号</span>
              <span className="text-sm font-medium text-emerald-600">
                {versionNumber}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <span className="text-sm text-gray-600">变更字段数量</span>
              <span className="text-sm font-medium text-gray-900">
                {changeCount} 个
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <span className="text-sm text-gray-600">发布时间</span>
              <span className="text-sm font-medium text-gray-900">
                {publishTime}
              </span>
            </div>
          </div>

          {/* 提示信息 */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
            <div className="flex items-start gap-2">
              <i className="ri-information-line text-blue-600 text-base mt-0.5"></i>
              <div className="text-sm text-blue-800 leading-relaxed space-y-1">
                <p>本次发布的字段配置已立即在企业数据填报模块中生效。如需修改，请重新编辑后再次发布。</p>
                <p className="flex items-center gap-1 text-orange-700 font-medium">
                  <i className="ri-file-download-line text-base"></i>
                  批量导入模板已同步更新，请前往企业数据页面重新下载最新模板后再进行导入。
                </p>
              </div>
            </div>
          </div>

          {/* 确认按钮 */}
          <button
            onClick={safeOnClose}
            className="w-full px-5 py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors whitespace-nowrap"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}