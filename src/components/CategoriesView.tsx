import React, { useState } from 'react';
import { 
  Tags, 
  Plus, 
  Edit2, 
  Check, 
  X, 
  ArrowUpRight, 
  ArrowDownLeft,
  FolderPlus
} from 'lucide-react';
import { Category } from '../types';
import { toPersianDigits } from '../utils/formatters';

interface CategoriesViewProps {
  categories: Category[];
  onAddCategory: (cat: Partial<Category>) => Promise<void>;
  onUpdateCategory: (id: number, updates: Partial<Category>) => Promise<void>;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  onAddCategory,
  onUpdateCategory,
}) => {
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDirection, setNewDirection] = useState<'expense' | 'income'>('expense');

  const expenseCats = categories.filter((c) => c.direction === 'expense');
  const incomeCats = categories.filter((c) => c.direction === 'income');

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const saveEdit = async (id: number) => {
    if (!editName.trim()) return;
    await onUpdateCategory(id, { name: editName.trim() });
    setEditingId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await onAddCategory({
      name: newName.trim(),
      direction: newDirection,
      is_active: true,
    });
    setShowAddModal(false);
    setNewName('');
  };

  const currentList = activeTab === 'expense' ? expenseCats : incomeCats;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>دسته‌بندی‌های دخل و خرج</span>
            <span className="text-xs font-normal text-slate-400">
              ({toPersianDigits(categories.length)} دسته)
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            دسته‌بندی‌ها برای گزارش‌گیری دقیق مخارج و درآمدهای ماهانه به کار می‌روند.
          </p>
        </div>

        <button
          id="btn-add-category"
          onClick={() => {
            setNewDirection(activeTab);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>دسته‌بندی جدید</span>
        </button>
      </div>

      {/* Tabs for Expense / Income */}
      <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 max-w-xs">
        <button
          onClick={() => setActiveTab('expense')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'expense'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>هزینه‌ها ({toPersianDigits(expenseCats.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('income')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'income'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>درآمدها ({toPersianDigits(incomeCats.length)})</span>
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {currentList.map((cat) => {
          const isEditing = editingId === cat.id;

          return (
            <div
              key={cat.id}
              className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-3.5 flex items-center justify-between hover:border-slate-700 transition-all group min-h-[44px]"
            >
              {isEditing ? (
                <div className="flex items-center gap-1.5 w-full">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none min-h-[34px]"
                  />
                  <button onClick={() => saveEdit(cat.id)} className="p-1.5 bg-emerald-600 rounded text-white min-h-[34px] min-w-[34px] flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-800 rounded text-slate-300 min-h-[34px] min-w-[34px] flex items-center justify-center">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        cat.direction === 'income' ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                    />
                    <span className="text-xs font-medium text-slate-200 truncate">{cat.name}</span>
                  </div>

                  <button
                    onClick={() => startEdit(cat)}
                    className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                    title="ویرایش نام"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">افزودن دسته‌بندی جدید</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">نوع دسته‌بندی:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewDirection('expense')}
                    className={`py-2.5 rounded-xl font-medium border min-h-[40px] ${
                      newDirection === 'expense'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    هزینه (مخارج)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDirection('income')}
                    className={`py-2.5 rounded-xl font-medium border min-h-[40px] ${
                      newDirection === 'income'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    درآمد (واریزی)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">نام دسته‌بندی:</label>
                <input
                  type="text"
                  placeholder="مثلا: اینترنت و شارژ، پزشکی و سلامت..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 min-h-[38px]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl min-h-[40px]"
                >
                  ایجاد دسته‌بندی
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl min-h-[40px]"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
