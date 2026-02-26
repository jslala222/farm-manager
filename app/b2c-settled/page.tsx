"use client";
// app/b2c-settled/page.tsx - 정산완료(택배거래) 페이지
// 택배 B2C 입금 내역을 기간별, 결제수단별로 조회

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Package2,
    RefreshCcw,
    Calendar,
    CreditCard,
    Banknote,
    Building,
    Search,
    TrendingUp,
    BarChart3,
    Phone,
    Box,
    CheckCircle,
    Clock,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

// 날짜 범위 기본값: 이번달 1일 ~ 오늘
const getDefaultRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const toStr = (d: Date) => d.toISOString().split('T')[0];
    return { from: toStr(firstDay), to: toStr(now) };
};

type PeriodPreset = 'this_month' | 'last_month' | 'custom';
// 정산 상태 필터: 전체/완료만/미정산만
type SettleFilter = 'all' | 'settled' | 'pending';

// 결제수단 설정 (courier 페이지에서 실제 저장하는 값 기준: '카드'/'현금'/'계좌')
const PAYMENT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
    '카드': {
        label: '카드',
        icon: <CreditCard className="w-4 h-4" />,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
    },
    '현금': {
        label: '현금',
        icon: <Banknote className="w-4 h-4" />,
        color: 'text-green-600',
        bg: 'bg-green-50',
        border: 'border-green-200',
    },
    '계좌': {
        label: '계좌이체',
        icon: <Building className="w-4 h-4" />,
        color: 'text-purple-600',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
    },
};

interface CourierRecord {
    id: string;
    recorded_at: string;
    quantity: number;
    price: number | null;
    shipping_cost: number | null;
    shipping_fee_type: string | null;
    payment_method: string | null;
    payment_status: string | null;
    is_settled: boolean | null;
    crop_name: string | null;
    sale_unit: string | null;
    customer_name: string | null;
    recipient_name: string | null;
    recipient_phone: string | null;
    delivery_note: string | null;
    customer?: { name: string; contact?: string; is_vip?: boolean } | null;
}

export default function B2CSettledPage() {
    const { farm, initialized } = useAuthStore();
    const [records, setRecords] = useState<CourierRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState<PeriodPreset>('this_month');
    const [range, setRange] = useState(getDefaultRange);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
    const [settleFilter, setSettleFilter] = useState<SettleFilter>('all');

    // 기간 프리셋 변경 시 날짜 범위 자동 계산
    useEffect(() => {
        const now = new Date();
        if (period === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const toStr = (d: Date) => d.toISOString().split('T')[0];
            setRange({ from: toStr(firstDay), to: toStr(now) });
        } else if (period === 'last_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
            const toStr = (d: Date) => d.toISOString().split('T')[0];
            setRange({ from: toStr(firstDay), to: toStr(lastDay) });
        }
    }, [period]);

    // 데이터 불러오기 - delivery_method='courier' 조건으로 택배 거래만 조회
    const fetchData = useCallback(async () => {
        if (!farm?.id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('sales_records')
                .select('*, customer:customer_id(name, contact, is_vip)')
                .eq('farm_id', farm.id)
                .eq('delivery_method', 'courier')
                .gte('recorded_at', range.from)
                .lte('recorded_at', range.to + 'T23:59:59')
                .order('recorded_at', { ascending: false });

            if (error) throw error;
            setRecords((data as CourierRecord[]) || []);
        } catch (e: any) {
            console.error('B2C 택배 데이터 불러오기 실패:', e.message);
            alert('데이터 로드 실패: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, [farm?.id, range]);

    useEffect(() => {
        if (initialized && farm?.id) fetchData();
    }, [fetchData, initialized, farm?.id]);

    // 필터 처리 (검색 + 결제수단 + 정산상태)
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const name = r.customer_name || r.customer?.name || r.recipient_name || '';
            const phone = r.recipient_phone || '';
            const searchMatch = !searchQuery || name.includes(searchQuery) || phone.includes(searchQuery);
            const paymentMatch = !selectedPayment || r.payment_method === selectedPayment;
            const settleMatch =
                settleFilter === 'all' ||
                (settleFilter === 'settled' && r.is_settled) ||
                (settleFilter === 'pending' && !r.is_settled);
            return searchMatch && paymentMatch && settleMatch;
        });
    }, [records, searchQuery, selectedPayment, settleFilter]);

    // 결제수단별 집계 (전체 레코드 기준)
    const paymentStats = useMemo(() => {
        const stats: Record<string, { count: number; total: number }> = {
            '카드': { count: 0, total: 0 },
            '현금': { count: 0, total: 0 },
            '계좌': { count: 0, total: 0 },
            '기타': { count: 0, total: 0 },
        };
        // 정산 완료 건만 합산
        records.filter(r => r.is_settled).forEach(r => {
            const method = r.payment_method || '기타';
            const amount = r.price ?? 0;
            if (stats[method] !== undefined) {
                stats[method].count++;
                stats[method].total += amount;
            } else {
                stats['기타'].count++;
                stats['기타'].total += amount;
            }
        });
        return stats;
    }, [records]);

    // 정산 완료 합계
    const settledTotal = useMemo(() =>
        records.filter(r => r.is_settled).reduce((sum, r) => sum + (r.price ?? 0), 0),
        [records]
    );
    const pendingTotal = useMemo(() =>
        records.filter(r => !r.is_settled).reduce((sum, r) => sum + (r.price ?? 0), 0),
        [records]
    );
    const settledCount = records.filter(r => r.is_settled).length;
    const pendingCount = records.filter(r => !r.is_settled).length;

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    const periodLabel = period === 'this_month'
        ? `${new Date().getMonth() + 1}월`
        : period === 'last_month'
            ? `${new Date().getMonth() === 0 ? 12 : new Date().getMonth()}월`
            : `${range.from} ~ ${range.to}`;

    return (
        <div className="p-4 md:p-3 pb-28 md:pb-6 max-w-2xl mx-auto space-y-4">

            {/* 헤더 */}
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        정산완료
                        <span className="text-base font-black text-purple-600">(택배거래)</span>
                        <Package2 className="w-5 h-5 text-purple-500 shrink-0" />
                    </h1>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                        B2C 택배 입금 현황 · {periodLabel}
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-all"
                >
                    <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* 기간 선택 */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-3 space-y-3">
                <div className="flex bg-gray-50 p-1 rounded-2xl gap-1">
                    {([
                        { key: 'this_month', label: '이번 달' },
                        { key: 'last_month', label: '지난 달' },
                        { key: 'custom', label: '직접 입력' },
                    ] as { key: PeriodPreset; label: string }[]).map(p => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${period === p.key ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {period === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1 ml-1">시작일</label>
                            <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
                                className="w-full p-3 border-2 border-gray-100 rounded-2xl text-sm font-bold focus:border-purple-400 outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1 ml-1">종료일</label>
                            <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
                                className="w-full p-3 border-2 border-gray-100 rounded-2xl text-sm font-bold focus:border-purple-400 outline-none" />
                        </div>
                        <button onClick={fetchData}
                            className="col-span-2 py-3 bg-purple-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-purple-100 hover:bg-purple-700 transition-all">
                            조회하기
                        </button>
                    </div>
                )}
            </div>

            {/* 총합 카드 */}
            <div className="bg-gray-900 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500 opacity-20 rounded-full -mr-20 -mt-20 blur-3xl" />
                <div className="relative z-10">
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">기간 내 총 입금액</p>
                    <h2 className="text-3xl font-black tracking-tighter text-purple-300 mb-3">{formatCurrency(settledTotal)}</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 rounded-2xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[10px] text-gray-400 font-bold">정산 완료</span>
                            </div>
                            <p className="text-base font-black text-white">{formatCurrency(settledTotal)}</p>
                            <p className="text-[10px] text-gray-500 font-bold">{settledCount}건</p>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-[10px] text-gray-400 font-bold">미정산 (외상)</span>
                            </div>
                            <p className="text-base font-black text-amber-300">{formatCurrency(pendingTotal)}</p>
                            <p className="text-[10px] text-gray-500 font-bold">{pendingCount}건</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 결제수단별 집계 (정산 완료 건 기준) */}
            <section className="space-y-2">
                <h3 className="text-sm font-black text-gray-700 flex items-center gap-1.5 px-1">
                    <BarChart3 className="w-4 h-4 text-gray-400" /> 결제수단별 입금 현황
                    <span className="text-[10px] text-gray-300 font-bold">(정산 완료 기준)</span>
                </h3>
                <div className="grid grid-cols-3 gap-2">
                    {(['카드', '현금', '계좌'] as const).map(method => {
                        const cfg = PAYMENT_CONFIG[method];
                        const stat = paymentStats[method];
                        const isActive = selectedPayment === method;
                        return (
                            <button key={method}
                                onClick={() => setSelectedPayment(isActive ? null : method)}
                                className={`p-3 rounded-[24px] border-2 text-left transition-all active:scale-95
                                    ${isActive ? `${cfg.bg} ${cfg.border} shadow-md` : 'bg-white border-gray-100 hover:border-gray-200'}`}
                            >
                                <div className={`flex items-center gap-1 mb-2 ${isActive ? cfg.color : 'text-gray-400'}`}>
                                    {cfg.icon}
                                    <span className="text-[10px] font-black">{cfg.label}</span>
                                </div>
                                <div className={`text-sm font-black truncate ${stat.total > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                                    {stat.total > 0 ? (stat.total / 10000).toFixed(0) + '만' : '없음'}
                                </div>
                                <div className="text-[10px] text-gray-400 font-bold mt-0.5">{stat.count}건</div>
                            </button>
                        );
                    })}
                </div>
                {selectedPayment && (
                    <div className="flex justify-end">
                        <button onClick={() => setSelectedPayment(null)} className="text-[10px] font-black text-purple-500 underline underline-offset-2">
                            필터 해제
                        </button>
                    </div>
                )}
            </section>

            {/* 정산 상태 필터 */}
            <div className="flex bg-gray-100 p-1 rounded-2xl gap-1">
                {([
                    { key: 'all', label: `전체 (${records.length}건)` },
                    { key: 'settled', label: `정산완료 (${settledCount})` },
                    { key: 'pending', label: `미정산 (${pendingCount})` },
                ] as { key: SettleFilter; label: string }[]).map(s => (
                    <button key={s.key} onClick={() => setSettleFilter(s.key)}
                        className={`flex-1 py-2 rounded-xl text-[11px] font-black transition-all whitespace-nowrap ${settleFilter === s.key ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'}`}>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* 검색 */}
            <div className="relative">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-300" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="주문자명 또는 연락처 검색"
                    className="w-full pl-11 pr-4 py-3 bg-white border-2 border-gray-100 rounded-2xl text-sm font-bold focus:border-purple-400 outline-none transition-all" />
            </div>

            {/* 거래 목록 */}
            <section className="space-y-2">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-black text-gray-700">
                        거래 내역
                        <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-bold">{filteredRecords.length}건</span>
                    </h3>
                    <span className="text-xs font-black text-purple-600">
                        {formatCurrency(filteredRecords.filter(r => r.is_settled).reduce((s, r) => s + (r.price ?? 0), 0))}
                    </span>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <RefreshCcw className="w-8 h-8 text-gray-200 animate-spin" />
                        <p className="text-xs text-gray-300 font-bold">데이터 불러오는 중...</p>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="text-center py-16 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                        <Package2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                        <p className="text-sm text-gray-400 font-bold">해당 기간에 택배 거래가 없습니다.</p>
                        <p className="text-[10px] text-gray-300 font-bold mt-1">택배(B2C) 메뉴에서 먼저 기록하세요.</p>
                    </div>
                ) : (
                    filteredRecords.map(rec => {
                        const amount = rec.price ?? 0;
                        const name = rec.customer_name || rec.customer?.name || '이름없음';
                        const phone = rec.recipient_phone || '';
                        const method = rec.payment_method || '기타';
                        const methodCfg = PAYMENT_CONFIG[method] ?? PAYMENT_CONFIG['카드'];
                        const isSettled = rec.is_settled;

                        return (
                            <div key={rec.id}
                                className={`bg-white rounded-3xl border p-4 shadow-sm hover:shadow-lg transition-all
                                    ${isSettled ? 'border-gray-100' : 'border-amber-200 bg-amber-50/20'}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    {/* 아이콘 + 정보 */}
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isSettled ? methodCfg.bg : 'bg-amber-50'}`}>
                                            {isSettled
                                                ? <span className={methodCfg.color}>{methodCfg.icon}</span>
                                                : <Clock className="w-4 h-4 text-amber-500" />
                                            }
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                <span className="font-black text-gray-900 text-sm">{name}</span>
                                                {rec.customer?.is_vip && (
                                                    <span className="text-[9px] bg-yellow-50 text-yellow-600 border border-yellow-200 px-1.5 py-0.5 rounded-full font-black">VIP</span>
                                                )}
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${isSettled ? `${methodCfg.bg} ${methodCfg.color}` : 'bg-amber-100 text-amber-600'}`}>
                                                    {isSettled ? '완료' : '미정산'}
                                                </span>
                                                <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">
                                                    {method}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-400 font-bold">
                                                {phone && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="w-3 h-3" />{phone}
                                                    </span>
                                                )}
                                                {rec.crop_name && (
                                                    <span className="flex items-center gap-1">
                                                        <Box className="w-3 h-3" />{rec.crop_name} {rec.quantity}{rec.sale_unit || '박스'}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />{formatDate(rec.recorded_at)}
                                                </span>
                                                {rec.shipping_cost && rec.shipping_cost > 0 && (
                                                    <span className="text-red-400">
                                                        택배비 -{formatCurrency(rec.shipping_cost)}
                                                        {rec.shipping_fee_type === '착불' ? '(착불)' : ''}
                                                    </span>
                                                )}
                                            </div>
                                            {rec.delivery_note && (
                                                <p className="text-[10px] text-gray-300 mt-1 truncate">{rec.delivery_note}</p>
                                            )}
                                        </div>
                                    </div>
                                    {/* 금액 */}
                                    <div className="text-right shrink-0">
                                        <p className={`text-lg font-black tracking-tight ${isSettled ? 'text-gray-900' : 'text-amber-500'}`}>
                                            {formatCurrency(amount)}
                                        </p>
                                        {rec.shipping_cost && rec.shipping_cost > 0 && rec.shipping_fee_type !== '착불' && (
                                            <p className="text-[10px] text-gray-400 font-bold">
                                                실수령 {formatCurrency(amount - rec.shipping_cost)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </section>

            {/* 하단 고정 요약바 */}
            {filteredRecords.length > 0 && (
                <div className="sticky bottom-20 md:bottom-6 bg-white border-2 border-purple-100 rounded-3xl p-4 shadow-2xl shadow-purple-100/50">
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">정산 완료</p>
                            <p className="text-base font-black text-purple-600">
                                {formatCurrency(filteredRecords.filter(r => r.is_settled).reduce((s, r) => s + (r.price ?? 0), 0))}
                            </p>
                        </div>
                        <div className="border-x border-gray-100">
                            <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">미정산</p>
                            <p className="text-base font-black text-amber-500">
                                {formatCurrency(filteredRecords.filter(r => !r.is_settled).reduce((s, r) => s + (r.price ?? 0), 0))}
                            </p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">건수</p>
                            <p className="text-base font-black text-gray-900">{filteredRecords.length}건</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
