"use client";
// app/settled/page.tsx - 정산완료 내역 페이지 (거래처별 엑셀표 + 수정/삭제)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CheckCircle, ChevronDown, ChevronRight, Download, RefreshCcw, Calendar, Edit2, Trash2, X, Save, FileText } from 'lucide-react';
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { getCropIcon, getCropColor } from "@/lib/utils";
import SettlementModal, { ModalCropEntry, SettlementSaveData } from "@/components/SettlementModal";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// 날짜 범위 기본값: 이번달 1일 ~ 오늘
const toLocalDateStr = (d: Date = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getDefaultRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toLocalDateStr(firstDay), to: toLocalDateStr(now) };
};

interface SettledRecord {
    id: string;
    recorded_at: string;
    settled_at: string | null;
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
    const [cropIconMap, setCropIconMap] = useState<Record<string, string>>({});
    const [cropCategoryMap, setCropCategoryMap] = useState<Record<string, string>>({});

    // ────── 데이터 불러오기 ──────
    const fetchData = useCallback(async () => {
        if (!farm?.id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('sales_records')
                .select('*, settled_at, partner:partners(company_name)')
                .eq('farm_id', farm.id)
                .eq('is_settled', true)
                .eq('sale_type', 'b2b')
                .gte('settled_at', range.from)
                .lte('settled_at', range.to)
                .order('settled_at', { ascending: false });

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

    // farm_crops 아이콘 맵 로드
    useEffect(() => {
        if (!farm?.id) return;
        supabase.from('farm_crops').select('crop_name, crop_icon, category').eq('farm_id', farm.id).then(({ data }) => {
            if (data) {
                const iconMap: Record<string, string> = {};
                const catMap: Record<string, string> = {};
                data.forEach((c: { crop_name: string; crop_icon: string | null; category: string }) => {
                    if (c.crop_icon) iconMap[c.crop_name] = c.crop_icon;
                    catMap[c.crop_name] = c.category;
                });
                setCropIconMap(iconMap);
                setCropCategoryMap(catMap);
            }
        });
    }, [farm?.id]);

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

    // ────── 수정 저장 (SettlementModal 콜백) ──────
    const handleSave = async (data: SettlementSaveData) => {
        if (!edit.rec) return;
        setSaving(true);
        try {
            const entry = data.entries[0];
            const priceNum = entry?.totalPrice > 0 ? entry.totalPrice : (edit.price ? Number(edit.price.replace(/,/g, '')) : null);
            const settledNum = data.actualAmount;

            // 10초 안에 응답 없으면 타임아웃 처리
            const updateQuery = supabase
                .from('sales_records')
                .update({
                    price: priceNum,
                    settled_amount: settledNum,
                    payment_method: data.paymentMethod || null,
                    harvest_note: data.deductionReason || null,
                    delivery_note: data.memo || null,
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
    const grandTotal = useMemo(() => {
        const unitTotals: Record<string, number> = {};
        // 품목별 집계 (아이콘 카드용)
        const cropTotals: { cropName: string; qty: number; unit: string; isProcessed: boolean }[] = [];
        const cropMap = new Map<string, { qty: number; unit: string }>();
        records.forEach(r => {
            const u = r.sale_unit || '박스';
            unitTotals[u] = (unitTotals[u] || 0) + (r.quantity || 0);
            const key = r.crop_name || '미분류';
            if (!cropMap.has(key)) cropMap.set(key, { qty: 0, unit: u });
            cropMap.get(key)!.qty += r.quantity || 0;
        });
        cropMap.forEach((v, cropName) => {
            cropTotals.push({ cropName, qty: v.qty, unit: v.unit, isProcessed: cropCategoryMap[cropName] === 'processed' });
        });
        const qtyStr = Object.entries(unitTotals).map(([u, q]) => `${q.toLocaleString()} ${u}`).join(' · ');
        return {
            qty: records.reduce((s, r) => s + (r.quantity || 0), 0),
            qtyStr,
            unitTotals,
            cropTotals,
            expected: records.reduce((s, r) => s + (r.price || 0), 0),
            settled: records.reduce((s, r) => s + (r.settled_amount || 0), 0),
        };
    }, [records, cropCategoryMap]);

    // XLSX 다운로드 (품목명 포함)
    const handleDownloadXLSX = () => {
        const data = records.map(r => {
            const diff = (r.settled_amount ?? 0) - (r.price ?? 0);
            return {
                '거래처': (r.partner as any)?.company_name || '미지정',
                '날짜': r.recorded_at.split('T')[0],
                '품목': r.crop_name || '미지정',
                '등급': r.grade || '',
                '수량': r.quantity,
                '단위': r.sale_unit || '',
                '예상금액': r.price ?? '',
                '정산금액': r.settled_amount ?? '',
                '차액': r.price && r.settled_amount ? diff : '',
                '결제수단': r.payment_method || '',
                '메모': r.delivery_note || '',
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '정산내역');
        
        // 열 너비 조정
        const colWidths = [15, 12, 12, 8, 8, 10, 12, 12, 12, 12, 20];
        ws['!cols'] = colWidths.map(w => ({ wch: w }));

        XLSX.writeFile(wb, `정산완료_${range.from}_${range.to}.xlsx`);
    };

    // 결산 리포트 PDF 다운로드 (농장명 + 거래처별 요약)
    const handleDownloadReport = async () => {
        try {
            // 거래처별 그룹핑
            const grouped = records.reduce((acc, r) => {
                const key = (r.partner as any)?.company_name || '미지정';
                if (!acc[key]) {
                    acc[key] = {
                        partnerName: key,
                        rows: [],
                        totalQty: 0,
                        totalExpected: 0,
                        totalSettled: 0,
                    };
                }
                acc[key].rows.push(r);
                acc[key].totalQty += r.quantity || 0;
                acc[key].totalExpected += r.price || 0;
                acc[key].totalSettled += r.settled_amount || 0;
                return acc;
            }, {} as Record<string, any>);

            // HTML 생성
            const reportHTML = `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h1 style="text-align: center; margin: 20px 0; color: #1f2937;">정산 리포트</h1>
                    <h2 style="text-align: center; font-size: 18px; margin: 10px 0; color: #374151;">${farm?.farm_name || '농장'}</h2>
                    <p style="text-align: center; color: #6b7280; margin-bottom: 20px;">
                        ${range.from} ~ ${range.to}
                    </p>

                    ${Object.values(grouped).map((group: any) => `
                        <div style="page-break-inside: avoid; margin-bottom: 25px;">
                            <h3 style="background: #10b981; color: white; padding: 10px; border-radius: 5px; margin: 0;">
                                ${group.partnerName}
                            </h3>
                            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
                                <tr style="background: #f3f4f6;">
                                    <td style="border: 1px solid #e5e7eb; padding: 8px;">거래건수</td>
                                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${group.rows.length}건</td>
                                    <td style="border: 1px solid #e5e7eb; padding: 8px;">수량합계</td>
                                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${group.totalQty.toLocaleString()}${group.rows[0]?.sale_unit || '박스'}</td>
                                </tr>
                                <tr style="background: #f9fafb;">
                                    <td style="border: 1px solid #e5e7eb; padding: 8px;">예상금액</td>
                                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${group.totalExpected.toLocaleString()}원</td>
                                    <td style="border: 1px solid #e5e7eb; padding: 8px;">정산금액</td>
                                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; color: #10b981; font-weight: bold;">${group.totalSettled.toLocaleString()}원</td>
                                </tr>
                                <tr style="background: #fef2f2;">
                                    <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: bold;">차액</td>
                                    <td colspan="3" style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; color: ${group.totalSettled - group.totalExpected < 0 ? '#ef4444' : '#10b981'}; font-weight: bold;">
                                        ${(group.totalSettled - group.totalExpected).toLocaleString()}원
                                    </td>
                                </tr>
                            </table>
                        </div>
                    `).join('')}

                    <div style="margin-top: 30px; padding: 15px; background: #f0fdf4; border: 2px solid #10b981; border-radius: 5px;">
                        <p style="margin: 5px 0;"><strong>전체 합계</strong></p>
                        <p style="margin: 5px 0; font-size: 14px;">거래건수: ${records.length}건</p>
                        <p style="margin: 5px 0; font-size: 14px;">총 수량: ${grandTotal.qty.toLocaleString()}${records[0]?.sale_unit || '박스'}</p>
                        <p style="margin: 5px 0; font-size: 14px;">예상금액: ${grandTotal.expected.toLocaleString()}원</p>
                        <p style="margin: 5px 0; font-size: 16px; color: #10b981; font-weight: bold;">정산총액: ${grandTotal.settled.toLocaleString()}원</p>
                    </div>

                    <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px;">
                        생성일: ${new Date().toLocaleDateString('ko-KR')} ${new Date().toLocaleTimeString('ko-KR')}
                    </p>
                </div>
            `;

            // 임시 div 생성
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = reportHTML;
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            tempDiv.style.width = '210mm';
            tempDiv.style.background = 'white';
            document.body.appendChild(tempDiv);

            // Canvas로 변환
            const canvas = await html2canvas(tempDiv, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
            });

            // PDF 생성
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= 297;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= 297;
            }

            pdf.save(`${farm?.farm_name || '농장'}_정산리포트_${range.from}_${range.to}.pdf`);

            // 임시 div 제거
            document.body.removeChild(tempDiv);
        } catch (e: any) {
            console.error('PDF 생성 오류:', e);
            alert('리포트 생성에 실패했습니다.');
        }
    };

    const togglePartner = (name: string) => {
        setExpandedPartners(prev =>
            prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
        );
    };

    return (
        <div className="min-h-screen bg-slate-50/40 pb-20">

            {/* ── 수정 모달 (SettlementModal 통합) ── */}
            {edit.open && edit.rec && (() => {
                const rec = edit.rec!;
                const unitPrice = (rec.price && rec.quantity > 0) ? Math.round(rec.price / rec.quantity) : 0;
                const settledEntry: ModalCropEntry = {
                    recordId: rec.id,
                    cropName: rec.crop_name || '미지정',
                    grade: rec.grade || '특/상',
                    quantity: rec.quantity || 0,
                    unit: rec.sale_unit || '박스',
                    isProcessed: rec.grade === '-',
                    unitPrice,
                };
                return (
                    <SettlementModal
                        mode="settled-edit"
                        companyName={(rec.partner as any)?.company_name || '미지정'}
                        deliveryDate={rec.recorded_at.split('T')[0]}
                        cropEntries={[settledEntry]}
                        initialPaymentMethod={rec.payment_method || '계좌이체'}
                        initialDeductionReason={rec.harvest_note || ''}
                        initialMemo={rec.delivery_note || ''}
                        initialActualAmount={rec.settled_amount ?? null}
                        onSave={handleSave}
                        onClose={() => setEdit(emptyEdit)}
                        saving={saving}
                    />
                );
            })()}
            {/* ── 본문 ── */}
            <div className="max-w-4xl mx-auto px-3 py-4 space-y-4">

                {/* 헤더 */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                            {farm?.farm_name || '농장'} 정산완료
                        </h1>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">거래처별 정산 완료 내역 · 행 클릭 후 수정/삭제</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={fetchData} disabled={loading}
                            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 transition-all">
                            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={handleDownloadXLSX} disabled={records.length === 0}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-black shadow-sm disabled:opacity-40 hover:bg-emerald-600 transition-all">
                            <Download className="w-3.5 h-3.5" />
                            XLSX
                        </button>
                        <button onClick={handleDownloadReport} disabled={records.length === 0}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 text-white text-xs font-black shadow-sm disabled:opacity-40 hover:bg-blue-600 transition-all">
                            <FileText className="w-3.5 h-3.5" />
                            결산
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
                <div className="flex flex-col gap-2">
                    {/* 총 수량 - 품목별 카드 그리드 */}
                    <div className="bg-emerald-50 rounded-2xl border-2 border-red-400 shadow-sm px-4 py-3">
                        <p className="text-[9px] font-black text-emerald-600 uppercase mb-2.5">총 수량</p>
                        {grandTotal.cropTotals.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                                {grandTotal.cropTotals.map(({ cropName, qty, unit, isProcessed }) => (
                                    <div key={cropName} className="bg-white border border-emerald-100 rounded-2xl p-2.5 text-center shadow-sm flex flex-col items-center gap-1">
                                        <span className="text-xl leading-none">
                                            {cropIconMap[cropName] || getCropIcon(cropName)}
                                        </span>
                                        <p className="text-[9px] font-black text-slate-600 leading-tight truncate w-full text-center">{cropName}</p>
                                        <p className="text-sm font-black text-emerald-700 leading-none">
                                            {qty.toLocaleString()}{isProcessed ? '개' : ''}
                                        </p>
                                        <p className="text-[9px] font-bold text-emerald-400 leading-none">
                                            {isProcessed ? unit : unit}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-400 text-sm font-bold">-</p>
                        )}
                    </div>
                    {/* 정산 총액 */}
                    <div className="bg-emerald-50 rounded-2xl border-2 border-red-400 shadow-sm px-4 py-3 flex items-center justify-between">
                        <p className="text-[9px] font-black text-emerald-600 uppercase">정산 총액 <span className="text-emerald-400 normal-case font-bold">(실입금)</span></p>
                        <p className="text-base font-black text-emerald-600">{grandTotal.settled.toLocaleString()}원</p>
                    </div>
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

                            {/* 상세 테이블/카드 */}
                            {isExpanded && (
                                <div className="border-t border-slate-100">
                                    {/* PC 테이블 - 숨김@모바일 */}
                                    <div className="hidden md:block overflow-x-auto">
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
                                                    <td className="px-3 py-2.5 text-right font-black text-emerald-700">{(() => { const m: Record<string,number> = {}; group.rows.forEach(r => { const u = r.sale_unit||'박스'; m[u]=(m[u]||0)+(r.quantity||0); }); return Object.entries(m).map(([u,q])=>`${q.toLocaleString()} ${u}`).join(' · '); })()}</td>
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

                                    {/* 모바일 카드 - 표시@모바일만 */}
                                    <div className="md:hidden space-y-1.5 p-2">
                                        {group.rows.map((rec) => {
                                            const rowDiff = (rec.settled_amount !== null && rec.price !== null)
                                                ? rec.settled_amount - rec.price
                                                : null;
                                            const missingSettled = rec.settled_amount === null;
                                            const recordDateStr = new Date(rec.recorded_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' });
                                            const settledDateStr = rec.settled_at 
                                                ? new Date(rec.settled_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' })
                                                : '미완료';
                                            
                                            return (
                                                <div key={rec.id} className={`rounded-lg border transition-all overflow-hidden ${missingSettled ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
                                                    {/* 헤더: 작물명 | 결제수단 | [수정][삭제] */}
                                                    <div className="px-3 py-1.5 bg-gradient-to-r from-slate-50 to-white border-b flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <span className={`text-base shrink-0 ${getCropColor(rec.crop_name)}`}>
                                                                {cropIconMap[rec.crop_name || ''] || getCropIcon(rec.crop_name)}
                                                            </span>
                                                            <span className="font-bold text-slate-700 text-xs truncate">
                                                                {rec.crop_name || '미분류'}
                                                            </span>
                                                            <span className="text-slate-400 font-bold text-xs">|</span>
                                                            <span className="bg-slate-200 text-slate-700 font-black px-1.5 py-0.5 rounded text-[8px] shrink-0">
                                                                {rec.payment_method || '-'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-0.5 shrink-0">
                                                            <button
                                                                onClick={() => openEdit(rec)}
                                                                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-90"
                                                                title="수정">
                                                                <Edit2 className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(rec)}
                                                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-90"
                                                                title="삭제">
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* 판매정보 - 한 줄 (결제수단 제거) */}
                                                    <div className="px-3 py-1 border-b bg-slate-50/50 text-[9px] font-medium text-slate-700 overflow-x-auto whitespace-nowrap">
                                                        <span className="font-black text-slate-600 mr-1.5">📤</span>
                                                        <span>{recordDateStr}</span>
                                                        <span className="text-slate-400 mx-1">|</span>
                                                        <span className="bg-indigo-50 text-indigo-600 font-black px-1 py-0.5 rounded text-[7px] inline-block">{rec.grade || '-'}</span>
                                                        <span className="text-slate-400 mx-1">|</span>
                                                        <span className="font-black">{(rec.quantity || 0).toLocaleString()}{rec.sale_unit || '박'}</span>
                                                        <span className="text-slate-400 mx-1">|</span>
                                                        <span className="font-black text-slate-800">{(rec.price || 0).toLocaleString()}원</span>
                                                    </div>

                                                    {/* 입금정보 - 한 줄 (마지막) */}
                                                    <div className={`px-3 py-1 text-[9px] font-medium overflow-x-auto whitespace-nowrap ${missingSettled ? 'bg-amber-100/30 text-amber-700' : 'bg-emerald-50/50 text-emerald-700'}`}>
                                                        <span className={`font-black mr-1 ${missingSettled ? 'text-amber-600' : 'text-emerald-600'}`}>📥</span>
                                                        <span className={missingSettled ? 'text-amber-600 font-black' : ''}>{settledDateStr}{!missingSettled && ' ✓'}</span>
                                                        <span className="text-slate-400 mx-1">|</span>
                                                        <span className={`font-black ${missingSettled ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                            {rec.settled_amount !== null ? `${rec.settled_amount.toLocaleString()}원` : '미입력'}
                                                        </span>
                                                        <span className="text-slate-400 mx-1">|</span>
                                                        <span className={`font-black ${rowDiff === null ? 'text-slate-400' : rowDiff < 0 ? 'text-rose-600' : rowDiff > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                            {rowDiff !== null ? `${rowDiff > 0 ? '+' : ''}${rowDiff.toLocaleString()}원` : '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* 모바일 소계 */}
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 mt-2">
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="font-black text-emerald-700 text-xs">소계</span>
                                                <div className="flex gap-2 text-right text-[8px]">
                                                    <div>
                                                        <p className="font-bold text-emerald-600 mb-0.5">수량</p>
                                                        <p className="font-black text-emerald-700">{(() => { const m: Record<string,number> = {}; group.rows.forEach(r => { const u = r.sale_unit||'박스'; m[u]=(m[u]||0)+(r.quantity||0); }); return Object.entries(m).map(([u,q])=>`${q.toLocaleString()}${u}`).join(' · '); })()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-600 mb-0.5">예상</p>
                                                        <p className="font-bold text-slate-600">{group.totalExpected.toLocaleString()}원</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-emerald-600 mb-0.5">정산</p>
                                                        <p className="font-black text-emerald-700">{group.totalSettled.toLocaleString()}원</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-600 mb-0.5">차액</p>
                                                        <p className={`font-black ${diff < 0 ? 'text-rose-500' : diff > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                            {diff > 0 ? '+' : ''}{diff.toLocaleString()}원
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
