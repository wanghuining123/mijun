
import { useState, useEffect } from 'react';

export interface DashboardConfig {
  visibleIndicators: {
    per_mu_sales_revenue: boolean;
    per_mu_industrial_output: boolean;
    per_mu_added_value: boolean;
    per_mu_profit: boolean;
    per_mu_rd_expenditure: boolean;
    per_mu_employee_count: boolean;
  };
  refreshInterval: number; // 分钟
  abnormalThresholds: {
    per_mu_sales_revenue: number;
    per_mu_industrial_output: number;
    per_mu_added_value: number;
    per_mu_profit: number;
    per_mu_rd_expenditure: number;
    per_mu_employee_count: number;
  };
}

const DEFAULT_CONFIG: DashboardConfig = {
  visibleIndicators: {
    per_mu_sales_revenue: true,
    per_mu_industrial_output: true,
    per_mu_added_value: true,
    per_mu_profit: true,
    per_mu_rd_expenditure: true,
    per_mu_employee_count: true,
  },
  refreshInterval: 30,
  abnormalThresholds: {
    per_mu_sales_revenue: 20,
    per_mu_industrial_output: 20,
    per_mu_added_value: 20,
    per_mu_profit: 20,
    per_mu_rd_expenditure: 20,
    per_mu_employee_count: 20,
  },
};

const INDICATOR_NAMES: Record<string, string> = {
  per_mu_sales_revenue: '米均销售收入',
  per_mu_industrial_output: '米均工业产值',
  per_mu_added_value: '米均增加值',
  per_mu_profit: '米均利润',
  per_mu_rd_expenditure: '米均研发投入',
  per_mu_employee_count: '米均从业人数',
};

const REFRESH_OPTIONS = [
  { value: 5, label: '5分钟' },
  { value: 15, label: '15分钟' },
  { value: 30, label: '30分钟' },
  { value: 60, label: '60分钟' },
  { value: 0, label: '仅手动刷新' },
];

interface DashboardSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: DashboardConfig) => void;
}

export const DashboardSettingsDrawer = ({
  isOpen,
  onClose,
  onSave,
}: DashboardSettingsDrawerProps) => {
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  // 加载配置
  useEffect(() => {
    if (isOpen) {
      const savedConfig = localStorage.getItem('dashboard_config');
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          // 简单校验，防止结构不完整导致运行时错误
          if (parsed && typeof parsed === 'object') {
            setConfig(parsed as DashboardConfig);
          } else {
            setConfig(DEFAULT_CONFIG);
          }
        } catch (err) {
          console.error('加载配置失败:', err);
          setConfig(DEFAULT_CONFIG);
        }
      } else {
        setConfig(DEFAULT_CONFIG);
      }
      setHasChanges(false);
    }
  }, [isOpen]);

  // 切换指标显示
  const toggleIndicator = (key: keyof DashboardConfig['visibleIndicators']) => {
    setConfig(prev => ({
      ...prev,
      visibleIndicators: {
        ...prev.visibleIndicators,
        [key]: !prev.visibleIndicators[key],
      },
    }));
    setHasChanges(true);
  };

  // 更新刷新频率
  const updateRefreshInterval = (value: number) => {
    setConfig(prev => ({ ...prev, refreshInterval: value }));
    setHasChanges(true);
  };

  // 更新异常阈值
  const updateThreshold = (
    key: keyof DashboardConfig['abnormalThresholds'],
    value: number
  ) => {
    setConfig(prev => ({
      ...prev,
      abnormalThresholds: {
        ...prev.abnormalThresholds,
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  // 保存配置
  const handleSave = () => {
    try {
      localStorage.setItem('dashboard_config', JSON.stringify(config));
      onSave(config);
      setHasChanges(false);
    } catch (err) {
      console.error('保存配置失败:', err);
    }
  };

  // 恢复默认
  const handleReset = () => {
    try {
      localStorage.removeItem('dashboard_config');
      setConfig(DEFAULT_CONFIG);
      onSave(DEFAULT_CONFIG);
      setHasChanges(false);
    } catch (err) {
      console.error('恢复默认配置失败:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* 抽屉 */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">看板设置</h2>
            <p className="text-xs text-gray-500 mt-1">
              自定义看板显示内容和行为
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded transition-colors cursor-pointer"
            aria-label="关闭"
          >
            <i className="ri-close-line text-xl text-gray-600"></i>
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 指标展示开关 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <i className="ri-eye-line text-teal-600"></i>
              指标展示设置
            </h3>
            <div className="space-y-2">
              {Object.entries(INDICATOR_NAMES).map(([key, name]) => (
                <label
                  key={key}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <span className="text-sm text-gray-700">{name}</span>
                  <div
                    onClick={() =>
                      toggleIndicator(
                        key as keyof DashboardConfig['visibleIndicators']
                      )
                    }
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                      config.visibleIndicators[
                        key as keyof DashboardConfig['visibleIndicators']
                      ]
                        ? 'bg-teal-600'
                        : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        config.visibleIndicators[
                          key as keyof DashboardConfig['visibleIndicators']
                        ]
                          ? 'translate-x-5'
                          : 'translate-x-0'
                      }`}
                    ></div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* 刷新频率设置 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <i className="ri-refresh-line text-teal-600"></i>
              数据刷新频率
            </h3>
            <div className="space-y-2">
              {REFRESH_OPTIONS.map(option => (
                <label
                  key={option.value}
                  className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <input
                    type="radio"
                    name="refreshInterval"
                    checked={config.refreshInterval === option.value}
                    onChange={() => updateRefreshInterval(option.value)}
                    className="w-4 h-4 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span className="ml-3 text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              <i className="ri-information-line"></i> 自动刷新可确保数据实时性，选择"仅手动刷新"则需点击刷新按钮更新数据
            </p>
          </section>

          {/* 异常阈值设置 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <i className="ri-error-warning-line text-teal-600"></i>
              异常预警阈值
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              当指标同比下降超过设定阈值时，将触发红色预警提示
            </p>
            <div className="space-y-3">
              {Object.entries(INDICATOR_NAMES).map(([key, name]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm text-gray-700">{name}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={
                        config.abnormalThresholds[
                          key as keyof DashboardConfig['abnormalThresholds']
                        ]
                      }
                      onChange={e =>
                        updateThreshold(
                          key as keyof DashboardConfig['abnormalThresholds'],
                          Number(e.target.value)
                        )
                      }
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-600">%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 底部操作栏 */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <i className="ri-restart-line"></i>
            恢复默认
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                hasChanges
                  ? 'bg-teal-600 text-white hover:bg-teal-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <i className="ri-save-line"></i>
              保存配置
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
