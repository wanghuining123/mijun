import { useState, useEffect } from 'react';

interface TemplateLoadModalProps {
  onClose: () => void;
  onLoad: (templateData: any) => void;
}

interface SavedTemplate {
  key: string;
  template_name: string;
  created_at: string;
  rules: any[];
}

export default function TemplateLoadModal({ onClose, onLoad }: TemplateLoadModalProps) {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    const allKeys = Object.keys(localStorage);
    const templateKeys = allKeys.filter(key => key.startsWith('classification_template_'));
    
    const loadedTemplates: SavedTemplate[] = templateKeys.map(key => {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          key,
          ...parsed
        };
      }
      return null;
    }).filter(Boolean) as SavedTemplate[];

    setTemplates(loadedTemplates);
  };

  const handleLoad = () => {
    if (!selectedTemplate) {
      alert('请选择要加载的模板');
      return;
    }

    const template = templates.find(t => t.key === selectedTemplate);
    if (template) {
      onLoad(template);
    }
  };

  const handleDelete = (key: string) => {
    if (!confirm('确定要删除该模板吗？')) return;
    localStorage.removeItem(key);
    loadTemplates();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">加载模板</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="px-6 py-6 max-h-96 overflow-auto">
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <i className="ri-inbox-line text-5xl text-gray-300"></i>
              <p className="text-gray-500 mt-4">暂无保存的模板</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map(template => (
                <div
                  key={template.key}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedTemplate === template.key
                      ? 'border-teal-600 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedTemplate(template.key)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={selectedTemplate === template.key}
                          onChange={() => setSelectedTemplate(template.key)}
                          className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                        />
                        <h4 className="font-medium text-gray-900">{template.template_name}</h4>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-6">
                        创建时间：{new Date(template.created_at).toLocaleString('zh-CN')}
                      </p>
                      <p className="text-xs text-gray-500 ml-6">
                        包含 {template.rules.length} 条规则
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(template.key);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
          >
            取消
          </button>
          <button
            onClick={handleLoad}
            disabled={!selectedTemplate}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
          >
            加载模板
          </button>
        </div>
      </div>
    </div>
  );
}