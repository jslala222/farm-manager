"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Receipt, Calendar, CreditCard, Tag } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, Expenditure } from "@/lib/supabase";

export default function ExpensesPage() {
    const { farm } = useAuthStore();
    const [expenses, setExpenses] = useState<Expenditure[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    // New Expense State
    const [category, setCategory] = useState("자재/비료");
    const [amount, setAmount] = useState("");
    const [notes, setNotes] = useState("");
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

    const categories = ["자재/비료", "인건비", "공과금(전기/물)", "유류비", "기타"];

    useEffect(() => {
        if (farm) fetchExpenses();
    }, [farm]);

    const fetchExpenses = async () => {
        if (!farm?.id) return;
        setLoading(true);
        const { data } = await supabase.from('expenditures').select('*')
            .eq('farm_id', farm.id).order('expense_date', { ascending: false });
        setExpenses(data ?? []);
        setLoading(false);
    };

    const handleAddExpense = async () => {
        if (!amount || !farm?.id) return;
        const { error } = await supabase.from('expenditures').insert({
            farm_id: farm.id,
            category,
            amount: parseInt(amount),
            notes,
            expense_date: expenseDate
        });
        if (error) alert(`저장 실패: ${error.message}`);
        else {
            setAmount("");
            setNotes("");
            setIsAdding(false);
            fetchExpenses();
        }
    };

    const deleteExpense = async (id: string) => {
        if (!confirm("이 지출 기록을 삭제하시겠습니까?")) return;
        await supabase.from('expenditures').delete().eq('id', id);
        fetchExpenses();
    };

    return (
        <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">지출 기록</h1>
                <button onClick={() => setIsAdding(!isAdding)}
                    className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1 hover:bg-red-700 transition-all shadow-sm">
                    <Plus className="w-4 h-4" /> {isAdding ? '취소' : '기록하기'}
                </button>
            </div>

            {isAdding && (
                <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5 space-y-4 animate-in fade-in zoom-in duration-300">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">날짜</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                            <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)}
                                className="w-full p-3 pl-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">카테고리</label>
                        <div className="flex flex-wrap gap-2">
                            {categories.map(c => (
                                <button key={c} onClick={() => setCategory(c)}
                                    className={`px-3 py-2 rounded-xl border text-sm font-bold transition-all
                    ${category === c ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">금액</label>
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                            <input type="text" value={amount ? `${Number(amount).toLocaleString()}원` : ""}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^\d]/g, '');
                                    setAmount(val);
                                }}
                                placeholder="0원"
                                className="w-full p-3 pl-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-bold" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">내용 (메모)</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                            placeholder="예: 영양제 구매"
                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none h-20 resize-none" />
                    </div>
                    <button onClick={handleAddExpense}
                        className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 active:scale-95 transition-all">
                        저장하기
                    </button>
                </div>
            )}

            <div className="space-y-3">
                {loading ? <p className="text-center py-10 text-gray-400">불러오는 중...</p> :
                    expenses.map(exp => (
                        <div key={exp.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                                    <Tag className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-gray-900">{exp.amount.toLocaleString()}원</p>
                                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-bold">{exp.category}</span>
                                    </div>
                                    <p className="text-sm text-gray-500">{exp.notes || '메모 없음'}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">{exp.expense_date}</p>
                                </div>
                            </div>
                            <button onClick={() => deleteExpense(exp.id)} className="p-2 text-gray-300 hover:text-red-500 rounded-lg transition-colors">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                {!loading && expenses.length === 0 && (
                    <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400">지출 내역이 없습니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
