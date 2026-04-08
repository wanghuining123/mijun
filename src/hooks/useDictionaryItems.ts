import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface DictionaryItem {
  id: string;
  field_code: string;
  name: string;
  code: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface UseDictionaryItemsResult {
  items: DictionaryItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  addItem: (fieldCode: string, name: string) => Promise<{ success: boolean; error?: string }>;
  updateItem: (id: string, name: string) => Promise<{ success: boolean; error?: string }>;
  deleteItem: (id: string) => Promise<{ success: boolean; error?: string }>;
  moveUp: (id: string) => Promise<{ success: boolean; error?: string }>;
  moveDown: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export const useDictionaryItems = (fieldCode: string): UseDictionaryItemsResult => {
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!fieldCode) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('dictionary_items')
        .select('*')
        .eq('field_code', fieldCode)
        .order('sort_order', { ascending: true });
      if (fetchError) throw fetchError;
      setItems(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取字典项失败');
    } finally {
      setLoading(false);
    }
  }, [fieldCode]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const generateCode = (name: string, existingCodes: string[]): string => {
    const base = `item_${Date.now()}`;
    return existingCodes.includes(base) ? `${base}_1` : base;
  };

  const addItem = async (fc: string, name: string) => {
    try {
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) : 0;
      const newCode = generateCode(name, items.map(i => i.code));
      const { error: insertError } = await supabase
        .from('dictionary_items')
        .insert({
          field_code: fc,
          name,
          code: newCode,
          sort_order: maxOrder + 1,
          updated_at: new Date().toISOString(),
        });
      if (insertError) throw insertError;
      await fetchItems();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : '新增失败' };
    }
  };

  const updateItem = async (id: string, name: string) => {
    try {
      const { error: updateError } = await supabase
        .from('dictionary_items')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (updateError) throw updateError;
      await fetchItems();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : '更新失败' };
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('dictionary_items')
        .delete()
        .eq('id', id);
      if (deleteError) throw deleteError;
      await fetchItems();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : '删除失败' };
    }
  };

  const moveUp = async (id: string) => {
    const idx = items.findIndex(i => i.id === id);
    if (idx <= 0) return { success: true };
    const prev = items[idx - 1];
    const curr = items[idx];
    try {
      await supabase.from('dictionary_items').update({ sort_order: curr.sort_order, updated_at: new Date().toISOString() }).eq('id', prev.id);
      await supabase.from('dictionary_items').update({ sort_order: prev.sort_order, updated_at: new Date().toISOString() }).eq('id', curr.id);
      await fetchItems();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : '排序失败' };
    }
  };

  const moveDown = async (id: string) => {
    const idx = items.findIndex(i => i.id === id);
    if (idx < 0 || idx >= items.length - 1) return { success: true };
    const next = items[idx + 1];
    const curr = items[idx];
    try {
      await supabase.from('dictionary_items').update({ sort_order: curr.sort_order, updated_at: new Date().toISOString() }).eq('id', next.id);
      await supabase.from('dictionary_items').update({ sort_order: next.sort_order, updated_at: new Date().toISOString() }).eq('id', curr.id);
      await fetchItems();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : '排序失败' };
    }
  };

  return { items, loading, error, refetch: fetchItems, addItem, updateItem, deleteItem, moveUp, moveDown };
};
