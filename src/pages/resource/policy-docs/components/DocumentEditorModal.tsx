import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';

interface Template {
  id: string;
  name: string;
  doc_type: string;
  number_format: string;
  default_issuer: string;
  content_template: string;
}

interface DocData {
  id?: string;
  title?: string;
  doc_number?: string;
  doc_type?: string;
  issuer?: string;
  issue_date?: string;
  department?: string;
  content?: string;
  keywords?: string[];
  template_id?: string;
}

interface DocumentEditorModalProps {
  doc: DocData | null;
  onClose: () => void;
  onSaved: () => void;
}

const DOC_TYPES = ['通知', '意见', '方案', '办法', '规定', '决定'];

export default function DocumentEditorModal({ doc, onClose, onSaved }: DocumentEditorModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [step, setStep] = useState<'template' | 'edit'>(doc ? 'edit' : 'template');
  const [saving, setSaving] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');

  const [form, setForm] = useState({
    title: doc?.title || '',
    doc_number: doc?.doc_number || '',
    doc_type: doc?.doc_type || '通知',
    issuer: doc?.issuer || '',
    issue_date: doc?.issue_date || new Date().toISOString().split('T')[0],
    department: doc?.department || '',
    content: doc?.content || '',
    keywords: doc?.keywords || [] as string[],
    template_id: doc?.template_id || '',
  });

  useEffect(() => {
    supabase.from('policy_doc_templates').select('*').eq('is_active', true).then(({ data }) => {
      setTemplates(data || []);
    });
  }, []);

  const applyTemplate = (tpl: Template) => {
    const year = new Date().getFullYear();
    const docNumber = tpl.number_format
      .replace('{year}', String(year))
      .replace('{seq}', 'XX');
    const content = tpl.content_template
      .replace(/{year}/g, String(year))
      .replace(/{date}/g, new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }));
    setForm(f => ({
      ...f,
      doc_type: tpl.doc_type,
      doc_number: docNumber,
      issuer: tpl.default_issuer,
      content,
      template_id: tpl.id,
    }));
    setStep('edit');
  };

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !form.keywords.includes(kw)) {
      setForm(f => ({ ...f, keywords: [...f.keywords, kw] }));
    }
    setKeywordInput('');
  };

  const removeKeyword = (kw: string) => {
    setForm(f => ({ ...f, keywords: f.keywords.filter(k => k !== kw) }));
  };

  const handleSave = async (submitForReview = false) => {
    if (!form.title.trim()) return;
    try {
      setSaving(true);
      const payload = {
        ...form,
        status: 'draft',
        updated_at: new Date().toISOString(),
      };
      let targetId = doc?.id;
      if (doc?.id) {
        await supabase.from('policy_documents').update(payload).eq('id', doc.id);
      } else {
        const { data: newDoc } = await supabase.from('policy_documents')
          .insert([{ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id }])
          .select('id').maybeSingle();
        targetId = newDoc?.id;
      }
      if (submitForReview && targetId) {
        // 清理旧审核记录再重新提交
        await supabase.from('policy_doc_reviews').delete().eq('document_id', targetId);
        await supabase.from('policy_documents')
          .update({ status: 'reviewing', current_review_level: 1, reject_reason: '' })
          .eq('id', targetId);
        await supabase.from('policy_doc_reviews').insert({
          document_id: targetId,
          review_level: 1,
          status: 'pending',
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {doc ? '编辑文件' : step === 'template' ? '选择模板' : '起草文件'}
            </h2>
            {step === 'edit' && !doc && (
              <button onClick={() => setStep('template')}
                className="text-xs text-teal-600 hover:text-teal-700 cursor-pointer whitespace-nowrap">
                <i className="ri-arrow-left-line mr-1"></i>重新选择模板
              </button>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* 模板选择步骤 */}
          {step === 'template' && (
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-5">选择模板可自动填充文号、签发人和正文格式，也可跳过直接起草</p>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {templates.map(tpl => (
                  <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                    className="text-left p-4 border border-gray-200 rounded-xl hover:border-teal-400 hover:bg-teal-50 transition-all cursor-pointer group">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 flex items-center justify-center bg-teal-100 rounded-lg group-hover:bg-teal-200 transition-colors flex-shrink-0">
                        <i className="ri-file-text-line text-teal-600"></i>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{tpl.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{tpl.doc_type}</div>
                        <div className="text-xs text-gray-400 mt-1 truncate">{tpl.number_format}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex justify-center">
                <button onClick={() => setStep('edit')}
                  className="px-5 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                  跳过，直接起草
                </button>
              </div>
            </div>
          )}

          {/* 编辑表单 */}
          {step === 'edit' && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">文件标题 <span className="text-red-500">*</span></label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="请输入文件标题"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">文号</label>
                  <input value={form.doc_number} onChange={e => setForm(f => ({ ...f, doc_number: e.target.value }))}
                    placeholder="如：历下信用〔2024〕XX号"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">文件类型</label>
                  <select value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">签发人</label>
                  <input value={form.issuer} onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))}
                    placeholder="请输入签发人或机构"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">成文日期</label>
                  <input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">起草部门</label>
                  <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    placeholder="如：信用办、政策研究室"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">正文内容</label>
                  <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    rows={12} maxLength={5000}
                    placeholder="请输入文件正文内容..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none font-mono leading-relaxed" />
                  <div className="text-xs text-gray-400 text-right mt-1">{form.content.length}/5000</div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">关键词</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {form.keywords.map(kw => (
                      <span key={kw} className="flex items-center gap-1 px-2 py-1 text-xs bg-teal-50 text-teal-700 rounded-full">
                        {kw}
                        <button onClick={() => removeKeyword(kw)} className="cursor-pointer text-teal-400 hover:text-teal-600">
                          <i className="ri-close-line"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={keywordInput} onChange={e => setKeywordInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addKeyword()}
                      placeholder="输入关键词后按回车添加"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    <button onClick={addKeyword}
                      className="px-3 py-2 text-sm text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 cursor-pointer whitespace-nowrap">
                      添加
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        {step === 'edit' && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap">
              取消
            </button>
            <div className="flex gap-3">
              <button onClick={() => handleSave(false)} disabled={saving || !form.title.trim()}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap disabled:opacity-50">
                <i className="ri-save-line mr-2"></i>保存草稿
              </button>
              <button onClick={() => handleSave(true)} disabled={saving || !form.title.trim()}
                className="px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 cursor-pointer whitespace-nowrap disabled:opacity-50">
                {saving ? <i className="ri-loader-4-line animate-spin mr-2"></i> : <i className="ri-send-plane-line mr-2"></i>}
                提交审核
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
