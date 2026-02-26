"use client";
// app/settled/page.tsx - 정산완료 내역 페이지 (거래처별 엑셀표 + 수정/삭제)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CheckCircle, ChevronDown, ChevronRight, Download, RefreshCcw, Calendar, Edit2, Trash2, X, Save } from 'lucide-react';
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";

// 날짜 범위 기본값: 이번달 1일 ~ 오늘
const getDefaultRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const toStr = (d: Date) => d.toISOString().split('T')[0];
    return { from: toStr(firstDay), to: toStr(now) };
};

interface SettledRecord {
    id: string;
    recorded_at: string;
    quantity: number;
    grade: string | null;
    price: number | null;
    settled_amount: number | null;
    payment_method: string | null;
    crop_name: string | null;
    sale_unit: string | null;
    harvest_note: string | null;
    delivery_note: string | null;
    partner?: { company_name: string } | null;
}

// 수정 모달 상태 초기값
const emptyEdit = {
    open: false,
    rec: null as SettledRecord | null,
    price: '',
    settled_amount: '',
    payment_method: '카드',
    harvest_note: '',
    delivery_note: '',
};

const PAYMENT_METHODS = ['카드', '현금', '계좌이체'];
const DEDUCTION_REASONS = ['조합공제', '운임공제', '품질하락', '시세조정', '선불차감', '기타'];

export default function SettledPage() {
    const { farm, initialized } = useAuthStore();
    const [records, setRecords] = useState<SettledRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [range, setRange] = useState(getDefaultRange);
    const [expandedPartners, setExpandedPartners] = useState<string[]>([]);
    const [edit, setEdit] = useState(emptyEdit);

    // ────── 데이터 불러오기 ──────
    const fetchData = useCallback(async () => {
        if (!farm?.id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('sales_records')
                .select('*, partner:partners(company_name)')
                .eq('farm_id', farm.id)
                .eq('is_settled', true)
                .eq('sale_type', 'b2b')
                .gte('recorded_at', range.from + 'T00:00:00')
                .lte('recorded_at', range.to + 'T23:59:59')
                .order('recorded_at', { ascending: false });

            if (error) throw error;
            setRecords(data || []);
        } catch (e: any) {
            console.error('정산완료 데이터 조회 오류:', e);
        } finally {
            setLoading(false);
        }
    }, [farm?.id, range]);

    useEffect(() => {
        if (initialized && farm?.id) fetchData();
    }, [initialized, farm?.id, fetchData]);

    // ────── 수정 모달 열기 ──────
    const openEdit = (rec: SettledRecord) => {
        setEdit({
            open: true,
            rec,
            price: rec.price ? rec.price.toLocaleString() : '',
            settled_amount: rec.settled_amount ? rec.settled_amount.toLocaleString() : '',
            payment_method: rec.payment_method || '계좌이체',
            harvest_note: rec.harvest_note || '',
            delivery_note: rec.delivery_note || '',
        });
    };

    // ────── 수정 저장 ──────
    const handleSave = async () => {
        if (!edit.rec) return;
        setSaving(true);
        try {
            const priceNum = edit.price ? Number(edit.price.replace(/,/g, '')) : null;
            const settledNum = edit.settled_amount ? Number(edit.settled_amount.replace(/,/g, '')) : null;

            // 10초 안에 응답 없으면 타임아웃 처리
            const updateQuery = supabase
                .from('sales_records')
                .update({
                    price: priceNum,
                    settled_amount: settledNum,
                    payment_method: edit.payment_method || null,
                    harvest_note: edit.harvest_note || null,
                    delivery_note: edit.delivery_note || null,
                })
                .eq('id', edit.rec.id)
                .select();

            const timeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('저장 시간 초과 (10초). 네트워크를 확인해주세요.')), 10000)
            );

            const { error } = await Promise.race([updateQuery, timeout]) as any;

            if (error) {
                console.error('Supabase update error:', error);
                throw new Error(error.message || JSON.stringify(error));
            }

            setEdit(emptyEdit);
            fetchData();
        } catch (e: any) {
            console.error('handleSave 에러:', e);
            alert('저장 실패: ' + (e?.message || '알 수 없는 오류'));
        } finally {
            setSaving(false);
        }
    };

    // ────── 삭제 ──────
    const handleDelete = async (rec: SettledRecord) => {
        const partnerName = (rec.partner as any)?.company_name || '미지정';
        const dateStr = new Date(rec.recorded_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
        if (!confirm(`[${partnerName}] ${dateStr} ${rec.grade || ''} ${rec.quantity}${rec.sale_unit || '박스'} 항목을 삭제하시겠습니까?`)) return;

        const { error } = await supabase.from('sales_records').delete().eq('id', rec.id);
        if (!error) {
            fetchData();
        } else {
            alert('삭제 실패: ' + error.message);
        }
    };

    // ────── 거래처별 그룹화 ──────
    const grouped = useMemo(() => {
        const map = new Map<string, {
            partnerName: string;
            rows: SettledRecord[];
            totalQty: number;
            totalExpected: number;
            totalSettled: number;
        }>();

        records.forEach(rec => {
            const name = (rec.partner as any)?.company_name || '미지정';
            if (!map.has(name)) {
                map.set(name, { partnerName: name, rows: [], totalQty: 0, totalExpected: 0, totalSettled: 0 });
            }
            const g = map.get(name)!;
            g.rows.push(rec);
            g.totalQty += rec.quantity || 0;
            g.totalExpected += rec.price || 0;
            g.totalSettled += rec.settled_amount || 0;
        });

        return Array.from(map.values());
    }, [records]);

    // 전체 합계
    const grandTotal = useMemo(() => ({
        qty: records.reduce((s, r) => s + (r.quantity || 0), 0),
        expected: records.reduce((s, r) => s + (r.price || 0), 0),
        settled: records.reduce((s, r) => s + (r.settled_amount || 0), 0),
    }), [records]);

    // CSV 다운로드
    const handleDownloadCSV = () => {
        const header = ['거래처', '날짜', '등급', '수량', '단위', '예상금액', '정산금액', '차액', '차액사유', '결제수단', '메모'];
        const rows = records.map(r => {
            const diff = (r.settled_amount ?? 0) - (r.price ?? 0);
            return [
                (r.partner as any)?.company_name || '미지정',
                r.recorded_at.split('T')[0],
                r.grade || '',
                r.quantity,
                r.sale_unit || '',
                r.price ?? '',
                r.settled_amount ?? '',
                r.price && r.settled_amount ? diff : '',
                r.harvest_note || '',
                r.payment_method || '',
                r.delivery_note || '',
            ];
        });
        const csvContent = [header, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `정산완료_${range.from}_${range.to}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const togglePartner = (name: string) => {
        setExpandedPartners(prev =>
            prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
        );
    };

    return (
        <div className="min-h-screen bg-slate-50/40 pb-20">

            {/* ── 수정 모달 ── */}
            {edit.open && edit.rec && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
                    onClick={() => setEdit(emptyEdit)}>
                    <div className="bg-white w-full max-w-md rounded-t-[2rem] shadow-2xl flex flex-col max-h-[90vh]"
                        onClick={e => e.stopPropagation()}>

                        {/* 헤더 */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">정산 내역 수정</p>
                                <p className="text-sm font-black text-slate-900">
                                    {(edit.rec.partner as any)?.company_name || '미지정'} ·{' '}
                                    {new Date(edit.rec.recorded_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ·{' '}
                                    {edit.rec.grade} {edit.rec.quantity}{edit.rec.sale_unit}
                                </p>
                            </div>
                            <button onClick={() => setEdit(emptyEdit)}
                                className="p-2 rounded-xl bg-slate-100 text-slate-400">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* 폼 */}
                        <div className="p-5 space-y-4 overflow-y-auto flex-1">

                            {/* 예상금액 입력 */}
                            <div className="bg-slate-50 rounded-2xl p-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">예상금액 <span className="normal-case font-bold text-slate-300">(단가×수량)</span></p>
                                <div className="flex items-center gap-2">
                                    <input type="text" inputMode="numeric"
                                        value={edit.price}
                                        onChange={e => setEdit(prev => ({
                                            ...prev,
                                            price: e.target.value.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                                        }))}
                                        placeholder="0"
                                        className="flex-1 bg-transparent text-xl font-black text-slate-600 outline-none text-right" />
                                    <span className="text-sm font-black text-slate-400">원</span>
                                </div>
                            </div>

                            {/* 정산금액 입력 */}
                            <div className="bg-slate-50 rounded-2xl p-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">정산금액 <span className="normal-case font-bold text-slate-300">(실제 받은 금액)</span></p>
                                <div className="flex items-center gap-2">
                                    <input type="text" inputMode="numeric"
                                        value={edit.settled_amount}
                                        onChange={e => setEdit(prev => ({
                                            ...prev,
                                            settled_amount: e.target.value.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                                        }))}
                                        placeholder="0"
                                        className="flex-1 bg-transparent text-2xl font-black text-slate-800 outline-none text-right" />
                                    <span className="text-sm font-black text-slate-400">원</span>
                                </div>
                                {/* 차액 미리보기 */}
                                {edit.price && edit.settled_amount && (() => {
                                    const priceNum = Number(edit.price.replace(/,/g, ''));
                                    const settledNum = Number(edit.settled_amount.replace(/,/g, ''));
                                    const diff = settledNum - priceNum;
                                    return (
                                        <p className={`text-right text-xs font-black mt-1 ${diff < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                            차액 {diff > 0 ? '+' : ''}{diff.toLocaleString()}원
                                        </p>
                                    );
                                })()}
                            </div>

                            {/* 결제수단 */}
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">결제수단</p>
                                <div className="flex gap-1.5 p-1.5 bg-slate-100 rounded-2xl">
                                    {PAYMENT_METHODS.map(m => (
                                        <button key={m} onClick={() => setEdit(prev => ({ ...prev, payment_method: m }))}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all
                                            ${edit.payment_method === m ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`}>
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 차액 사유 */}
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">차액 사유 <span className="normal-case font-bold text-slate-300">(선택)</span></p>
                                <div className="flex flex-wrap gap-1.5">
                                    {DEDUCTION_REASONS.map(r => (
                                        <button key={r}
                                            onClick={() => setEdit(prev => ({ ...prev, harvest_note: prev.harvest_note === r ? '' : r }))}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all
                                            ${edit.harvest_note === r
                                                    ? 'bg-rose-500 text-white border-rose-500'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-rose-200'}`}>
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 메모 */}
                            <div className="bg-slate-50 rounded-2xl p-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">메모 <span className="normal-case font-bold text-slate-300">(선택)</span></p>
                                <input type="text" value={edit.delivery_note}
                                    onChange={e => setEdit(prev => ({ ...prev, delivery_note: e.target.value }))}
                                    placeholder="예: 운임 공제 후 입금"
                                    className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-300" />
                            </div>
                        </div>

                        {/* 하단 저장 버튼 */}
                        <div className="flex gap-2 p-5 pt-3 border-t border-slate-100 shrink-0">
                            <button onClick={() => setEdit(emptyEdit)}
                                className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-500 font-black text-sm">
                                취소
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className={`flex-[2] py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all
                                ${saving ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'} text-white`}>
                                {saving
                                    ? <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />저장 중...</>
                                    : <><Save className="w-4 h-4" />저장</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 본문 ── */}
            <div className="max-w-4xl mx-auto px-3 py-4 space-y-4">

                {/* 헤더 */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                            정산완료
                        </h1>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">거래처별 정산 완료 내역 · 행 클릭 후 수정/삭제</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={fetchData} disabled={loading}
                            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 transition-all">
                            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={handleDownloadCSV} disabled={records.length === 0}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-black shadow-sm disabled:opacity-40">
                            <Download className="w-3.5 h-3.5" />
                            CSV
                        </button>
                    </div>
                </div>

                {/* 날짜 범위 */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex items-center gap-2 flex-wrap">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <input type="date" value={range.from}
                        onChange={e => setRange(prev => ({ ...prev, from: e.target.value }))}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400 transition-all" />
                    <span className="text-slate-400 font-bold text-sm">~</span>
                    <input type="date" value={range.to}
                        onChange={e => setRange(prev => ({ ...prev, to: e.target.value }))}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400 transition-all" />
                    <button onClick={fetchData}
                        className="ml-auto px-4 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-black shadow-sm">
                        조회
                    </button>
                </div>

                {/* 전체 요약 카드 */}
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { label: '총 수량', value: grandTotal.qty.toLocaleString() + '박스', color: 'text-slate-800' },
                        { label: '예상 총액', value: grandTotal.expected.toLocaleString() + '원', color: 'text-indigo-600' },
                        { label: '정산 총액', value: grandTotal.settled.toLocaleString() + '원', color: 'text-emerald-600' },
                    ].map(item => (
                        <div key={item.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{item.label}</p>
                            <p className={`text-sm font-black ${item.color} break-all`}>{item.value}</p>
                        </div>
                    ))}
                </div>

                {/* 로딩 */}
                {loading && (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                    </div>
                )}

                {/* 빈 상태 */}
                {!loading && grouped.length === 0 && (
                    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-100 py-16 text-center">
                        <CheckCircle className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-400">해당 기간 정산완료 내역이 없습니다</p>
                    </div>
                )}

                {/* 거래처별 아코디언 테이블 */}
                {!loading && grouped.map(group => {
                    const isExpanded = expandedPartners.includes(group.partnerName);
                    const diff = group.totalSettled - group.totalExpected;
                    return (
                        <div key={group.partnerName} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                            {/* 거래처 헤더 */}
                            <button onClick={() => togglePartner(group.partnerName)}
                                className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-all text-left">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-slate-900 truncate">{group.partnerName}</p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-[10px] font-bold text-slate-400">{group.rows.length}건</span>
                                        <span className="text-[10px] text-slate-300">|</span>
                                        <span className="text-[10px] font-bold text-indigo-500">예상 {group.totalExpected.toLocaleString()}원</span>
                                        <span className="text-[10px] text-slate-300">|</span>
                                        <span className="text-[10px] font-bold text-emerald-600">정산 {group.totalSettled.toLocaleString()}원</span>
                                        {diff !== 0 && (
                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg ${diff < 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {diff > 0 ? '+' : ''}{diff.toLocaleString()}원
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {isExpanded
                                    ? <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />
                                    : <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                                }
                            </button>

                            {/* 상세 테이블 */}
                            {isExpanded && (
                                <div className="border-t border-slate-100 overflow-x-auto">
                                    <table className="w-full text-xs min-w-[620px]">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                {['날짜', '등급', '수량', '예상금액', '정산금액', '차액', '결제', '사유', ''].map((h, i) => (
                                                    <th key={i} className="px-3 py-2.5 text-[10px] font-black text-slate-400 text-right first:text-left last:text-center">
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.rows.map((rec, idx) => {
                                                const rowDiff = (rec.settled_amount !== null && rec.price !== null)
                                                    ? rec.settled_amount - rec.price
                                                    : null;
                                                const missingSettled = rec.settled_amount === null;
                                                return (
                                                    <tr key={rec.id}
                                                        className={`border-b border-slate-50 transition-all ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}
                                                        ${missingSettled ? 'bg-amber-50/60' : ''}`}>
                                                        {/* 날짜 */}
                                                        <td className="px-3 py-2.5 font-bold text-slate-600 whitespace-nowrap">
                                                            {new Date(rec.recorded_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' })}
                                                        </td>
                                                        {/* 등급 */}
                                                        <td className="px-3 py-2.5 text-right">
                                                            <span className="font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-lg">
                                                                {rec.grade || '-'}
                                                            </span>
                                                        </td>
                                                        {/* 수량 */}
                                                        <td className="px-3 py-2.5 text-right font-black text-slate-800">
                                                            {(rec.quantity || 0).toLocaleString()}{rec.sale_unit || '박스'}
                                                        </td>
                                                        {/* 예상금액 */}
                                                        <td className="px-3 py-2.5 text-right font-bold text-slate-600">
                                                            {rec.price ? rec.price.toLocaleString() + '원' : '-'}
                                                        </td>
                                                        {/* 정산금액 — 없으면 주황 강조 */}
                                                        <td className="px-3 py-2.5 text-right font-black">
                                                            {rec.settled_amount != null
                                                                ? <span className="text-emerald-600">{rec.settled_amount.toLocaleString()}원</span>
                                                                : <span className="text-amber-500 text-[10px] font-black bg-amber-100 px-1.5 py-0.5 rounded-lg">미입력</span>
                                                            }
                                                        </td>
                                                        {/* 차액 */}
                                                        <td className="px-3 py-2.5 text-right font-black">
                                                            {rowDiff !== null
                                                                ? <span className={rowDiff < 0 ? 'text-rose-500' : rowDiff > 0 ? 'text-emerald-500' : 'text-slate-400'}>
                                                                    {rowDiff > 0 ? '+' : ''}{rowDiff.toLocaleString()}원
                                                                </span>
                                                                : <span className="text-slate-300">-</span>
                                                            }
                                                        </td>
                                                        {/* 결제수단 */}
                                                        <td className="px-3 py-2.5 text-right">
                                                            <span className="font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-lg text-[10px]">
                                                                {rec.payment_method || '-'}
                                                            </span>
                                                        </td>
                                                        {/* 차액사유 */}
                                                        <td className="px-3 py-2.5 text-right font-medium text-slate-400 text-[10px]">
                                                            {rec.harvest_note || '-'}
                                                        </td>
                                                        {/* 수정/삭제 버튼 */}
                                                        <td className="px-2 py-2.5 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => openEdit(rec)}
                                                                    className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all"
                                                                    title="수정">
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(rec)}
                                                                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                                                                    title="삭제">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        {/* 소계 행 */}
                                        <tfoot>
                                            <tr className="bg-emerald-50 border-t-2 border-emerald-100">
                                                <td colSpan={2} className="px-3 py-2.5 font-black text-emerald-700 text-[11px]">소계</td>
                                                <td className="px-3 py-2.5 text-right font-black text-emerald-700">{group.totalQty.toLocaleString()}박스</td>
                                                <td className="px-3 py-2.5 text-right font-black text-slate-600">{group.totalExpected.toLocaleString()}원</td>
                                                <td className="px-3 py-2.5 text-right font-black text-emerald-700">{group.totalSettled.toLocaleString()}원</td>
                                                <td className="px-3 py-2.5 text-right font-black">
                                                    <span className={diff < 0 ? 'text-rose-500' : diff > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                                                        {diff > 0 ? '+' : ''}{diff.toLocaleString()}원
                                                    </span>
                                                </td>
                                                <td colSpan={3} />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
