"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuthStore } from "@/store/authStore";
import { supabase, SalesRecord, Partner, FarmCrop } from "@/lib/supabase";
import CalendarComponent from "@/components/Calendar";
import SettlementModal, { ModalCropEntry, SettlementSaveData } from "@/components/SettlementModal";
import { toast } from "sonner";
import { checkStockBeforeSale } from "@/hooks/useInventory";
import InventoryShortageDialog from "@/components/InventoryShortageDialog";

const toLocalDateStr = (d: Date = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function BulkSalesPage() {
    const { farm, initialized, cropIconMap } = useAuthStore();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [history, setHistory] = useState<SalesRecord[]>([]);
    const [saving, setSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(toLocalDateStr());
    const [showCalendar, setShowCalendar] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [farmCrops, setFarmCrops] = useState<FarmCrop[]>([]);
    const [expandedPartners, setExpandedPartners] = useState<string[]>([]);

    // 수정 모달 state
    const [editModal, setEditModal] = useState<{ open: boolean; records: SalesRecord[]; cropGroups: {cropName: string; isProcessed: boolean; unit: string; records: SalesRecord[]}[]; compSalesRecordName: string }>({ open: false, records: [], cropGroups: [], compSalesRecordName: '' });
    const [modalDate, setModalDate] = useState('');
    const [modalQties, setModalQties] = useState<Record<string, string>>({}); // { [cropName:grade]: qty }
    const [modalPaymentMethod, setModalPaymentMethod] = useState('카드');
    const [modalPaymentStatus, setModalPaymentStatus] = useState<'pending' | 'completed'>('pending');
    const [modalPrices, setModalPrices] = useState<Record<string, string>>({}); // { [cropName:grade]: 단가 }
    const [modalSaving, setModalSaving] = useState(false);
    const [compoundSourceIds, setCompoundSourceIds] = useState<string[]>([]); // 구형 복합 레코드 ID

    // B2B State
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    // 다중 품목 장바구니 (category로 원물/가공품 구분)
    const [bulkItems, setBulkItems] = useState<{id: string; cropName: string; cropIcon: string; unit: string; category: string; qty: string; qtySang: string; qtyJung: string; qtyHa: string;}[]>([]);

    // Common State

    // 가공품이면 규격(specs), 아니면 단위(units)
    const getEffectiveUnits = (crop: FarmCrop) => {
        if (crop?.category === 'processed' && crop?.available_specs?.length > 0) return crop.available_specs;
        return crop?.available_units || ['박스'];
    };

    // 장바구니 헬퍼
    const addToBulkCart = (crop: FarmCrop) => {
        setBulkItems(prev => [...prev, {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
            cropName: crop.crop_name, cropIcon: cropIconMap[crop.crop_name] || getCropIcon(crop.crop_name),
            unit: getEffectiveUnits(crop)[0],
            category: crop.category || 'crop',
            qty: '', qtySang: '', qtyJung: '', qtyHa: ''
        }]);
    };
    const removeBulkItem = (id: string) => setBulkItems(prev => prev.filter(i => i.id !== id));
    const updateBulkItem = (id: string, field: string, value: string) =>
        setBulkItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

    // 바로 정산 시트
    const [showSettlementSheet, setShowSettlementSheet] = useState(false);
    const [sheetPaymentMethod, setSheetPaymentMethod] = useState('카드');
    const [sheetUnitPrices, setSheetUnitPrices] = useState<Record<string, string>>({}); // { [grade]: unitPrice }
    const [sheetActualAmount, setSheetActualAmount] = useState('');
    const [sheetDeductionReason, setSheetDeductionReason] = useState('');
    const [sheetMemo, setSheetMemo] = useState('');

    const [shortageOpen, setShortageOpen] = useState(false);
    const [shortageMode, setShortageMode] = useState<"block" | "warn">("block");
    const [shortageRows, setShortageRows] = useState<FarmCrop[]>([]);
    const [pendingAction, setPendingAction] = useState<null | "pending" | "settled">(null);
    const skipStockCheckRef = useRef(false);

    const closeShortageDialog = () => {
        setShortageOpen(false);
        setPendingAction(null);
        skipStockCheckRef.current = false;
    };

    useEffect(() => {
        const fetchFarmCrops = async () => {
            if (!farm?.id) return;
            const { data } = await supabase.from('farm_crops').select('*').eq('farm_id', farm.id).is('is_active', true).order('sort_order');
            if (data) {
                setFarmCrops(data);
                if (data.length > 0) {
                    const strawberry = data.find((c: SalesRecord) => c.crop_name === '딸기');
                    if (strawberry) { setCropName('딸기'); setSaleUnit(strawberry.available_units?.[0] || '박스'); }
                    else { setCropName(data[0].crop_name); setSaleUnit(data[0].available_units?.[0] || '박스'); }
                }
            }
        };
        fetchFarmCrops();
    }, [farm?.id]);

    const fetchInitialData = useCallback(async () => {
        if (!farm?.id) return;
        setLoading(true);
        try {
            const partnersRes = await supabase.from('partners').select('*').eq('farm_id', farm.id).order('compSalesRecord_name');
            if (partnersRes.data) setPartners(partnersRes.data);
            await fetchHistory();
        } finally { setLoading(false); }
    }, [farm?.id]);

    const fetchHistory = async () => {
        if (!farm?.id) return;
        const { data } = await supabase
            .from('sales_records')
            .select(`*, partner:partners(*)`)
            .eq('farm_id', farm.id)
            .neq('delivery_method', 'courier') // B2B(bulk) 만 가져옴
            .eq('is_settled', false) // 미정산 항목만 표시
            .order('recorded_at', { ascending: false })
            .limit(30);
        if (data) setHistory(data);
    };

    useEffect(() => { if (initialized && farm?.id) fetchInitialData(); }, [initialized, farm?.id, fetchInitialData]);

    const handleResetAllStates = () => {
        setEditingRecordId(null); setSelectedClientId(""); setBulkItems([]);
    };

    const buildAllGrades = () => {
        const result: {cropName: string; unit: string; grade: string; qty: number; itemId: string}[] = [];
        for (const item of bulkItems) {
            if (item.category === 'processed') {
                // 가공품: 등급 없이 단순 수량
                const q = Number(item.qty);
                if (q > 0) result.push({cropName: item.cropName, unit: item.unit, grade: '-', qty: q, itemId: item.id});
            } else {
                // 원물: 등급별 수량
                [{grade: '특/상', qty: item.qtySang}, {grade: '중', qty: item.qtyJung}, {grade: '하', qty: item.qtyHa}]
                    .filter(g => Number(g.qty) > 0)
                    .forEach(g => result.push({cropName: item.cropName, unit: item.unit, grade: g.grade, qty: Number(g.qty), itemId: item.id}));
            }
        }
        return result;
    };

    const handleSavePending = async () => {
        if (!farm?.id || saving) return;
        if (!selectedClientId) { toast.error("거래처를 선택해주세요."); return; }
        const allGrades = buildAllGrades();
        if (allGrades.length === 0) { toast.error("품목을 추가하고 수량을 입력해주세요."); return; }

        // 재고 체크
        if (farm.inventory_enabled && !skipStockCheckRef.current) {
            const grouped = Object.values(
                allGrades.reduce((acc: Record<string, { cropName: string; quantity: number; unit?: string }>, g) => {
                    const key = `${g.cropName}::${g.unit}`;
                    if (!acc[key]) acc[key] = { cropName: g.cropName, unit: g.unit, quantity: 0 };
                    acc[key].quantity += g.qty;
                    return acc;
                }, {})
            );
            const check = await checkStockBeforeSale(farm.id, grouped, farm.inventory_warn_only ?? true);
            if (!check.ok) {
                setShortageMode("block");
                setShortageRows(check.rows);
                setShortageOpen(true);
                return;
            }
            if (check.warning) {
                setShortageMode("warn");
                setShortageRows(check.rows);
                setPendingAction("pending");
                setShortageOpen(true);
                return;
            }
        }

        setSaving(true);
        try {
            const nowTs = selectedDate + 'T' + new Date().toTimeString().split(' ')[0];
            for (const g of allGrades) {
                const { error } = await supabase.from('sales_records').insert([{
                    farm_id: farm.id, partner_id: selectedClientId, crop_name: g.cropName, sale_unit: g.unit,
                    quantity: g.qty, grade: g.grade,
                    is_settled: false, payment_status: 'pending',
                    delivery_method: 'direct', sale_type: 'b2b',
                    recorded_at: nowTs
                }]);
                if (error) throw error;
            }
            handleResetAllStates();
            setTimeout(() => fetchHistory(), 200);
            toast.success("✅ 납품 기록이 저장되었습니다! (미정산)");
        } catch (error: SalesRecord) {
            toast.error("저장 실패: " + (error.message || "알 수 없는 오류"));
        } finally { setSaving(false); }
    };

    const handleSaveSettled = async () => {
        if (!farm?.id || saving) return;
        if (!selectedClientId) { toast.error("거래처를 선택해주세요."); setShowSettlementSheet(false); return; }
        const allGrades = buildAllGrades();
        if (allGrades.length === 0) { toast.error("품목을 추가하고 수량을 입력해주세요."); setShowSettlementSheet(false); return; }

        // 재고 체크
        if (farm.inventory_enabled && !skipStockCheckRef.current) {
            const grouped = Object.values(
                allGrades.reduce((acc: Record<string, { cropName: string; quantity: number; unit?: string }>, g) => {
                    const key = `${g.cropName}::${g.unit}`;
                    if (!acc[key]) acc[key] = { cropName: g.cropName, unit: g.unit, quantity: 0 };
                    acc[key].quantity += g.qty;
                    return acc;
                }, {})
            );
            const check = await checkStockBeforeSale(farm.id, grouped, farm.inventory_warn_only ?? true);
            if (!check.ok) {
                setShowSettlementSheet(false);
                setShortageMode("block");
                setShortageRows(check.rows);
                setShortageOpen(true);
                return;
            }
            if (check.warning) {
                setShowSettlementSheet(false);
                setShortageMode("warn");
                setShortageRows(check.rows);
                setPendingAction("settled");
                setShortageOpen(true);
                return;
            }
        }

        setSaving(true);
        try {
            const actualTotal = sheetActualAmount ? Number(sheetActualAmount) : null;
            const totalExpected = allGrades.reduce((sum, g) => {
                const key = `${g.itemId}-${g.grade}`;
                const up = sheetUnitPrices[key] ? Number(sheetUnitPrices[key]) : 0;
                return sum + up * g.qty;
            }, 0);
            const totalQtyForSave = allGrades.reduce((sum, g) => sum + g.qty, 0);
            const nowTs = selectedDate + 'T' + new Date().toTimeString().split(' ')[0];
            for (const g of allGrades) {
                const key = `${g.itemId}-${g.grade}`;
                const up = sheetUnitPrices[key] ? Number(sheetUnitPrices[key]) : null;
                const gradePrice = up ? up * g.qty : null;
                const gradeSettled = actualTotal
                    ? totalExpected > 0 && gradePrice
                        ? Math.round(actualTotal * gradePrice / totalExpected)
                        : totalQtyForSave > 0
                            ? Math.round(actualTotal * g.qty / totalQtyForSave)
                            : actualTotal
                    : null;
                const { error } = await supabase.from('sales_records').insert([{
                    farm_id: farm.id, partner_id: selectedClientId, crop_name: g.cropName, sale_unit: g.unit,
                    quantity: g.qty, grade: g.grade,
                    is_settled: true, payment_status: 'completed', payment_method: sheetPaymentMethod,
                    price: gradePrice,
                    settled_amount: gradeSettled,
                    harvest_note: sheetDeductionReason || null,
                    delivery_note: sheetMemo || null,
                    delivery_method: 'direct', sale_type: 'b2b',
                    recorded_at: nowTs
                }]);
                if (error) throw error;
            }
            setShowSettlementSheet(false);
            setSheetUnitPrices({}); setSheetActualAmount(''); setSheetDeductionReason(''); setSheetMemo('');
            handleResetAllStates();
            setTimeout(() => fetchHistory(), 200);
            toast.success("✅ 납품 기록이 저장되었습니다! (정산 완료)");
        } catch (error: SalesRecord) {
            toast.error("저장 실패: " + (error.message || "알 수 없는 오류"));
        } finally { setSaving(false); }
    };

    const parseGradeString = (gradeStr: string, fallbackQty: number): Record<string, number> => {
        if (!gradeStr) return { '특/상': fallbackQty };
        if (['특/상', '중', '하'].includes(gradeStr)) return { [gradeStr]: fallbackQty };
        const result: Record<string, number> = {};
        let parsed = false;
        for (const part of gradeStr.split(',')) {
            const trimmed = part.trim();
            const colonIdx = trimmed.lastIndexOf(':');
            if (colonIdx > 0) {
                const g = trimmed.substring(0, colonIdx).trim();
                const q = parseInt(trimmed.substring(colonIdx + 1).trim());
                if (!isNaN(q)) { result[g] = (result[g] || 0) + q; parsed = true; }
            }
        }
        return parsed ? result : { [gradeStr]: fallbackQty };
    };

    const handleEditModal = (records: SalesRecord[], compSalesRecordName: string) => {
        const first = records[0];
        setModalDate(first.recorded_at.split('T')[0]);
        setModalPaymentMethod(first?.payment_method || '카드');
        setModalPaymentStatus((first?.payment_status as 'pending' | 'completed') || 'pending');

        const srcIds = new Set<string>();
        // 품목별 그루핑
        const cropMap = new Map<string, SalesRecord[]>();
        records.forEach(rec => {
            const cn = rec.crop_name || '미지정';
            if (!cropMap.has(cn)) cropMap.set(cn, []);
            cropMap.get(cn)!.push(rec);
        });

        const gradeOrder = ['특/상', '중', '하'];
        const cropGroups: {cropName: string; isProcessed: boolean; unit: string; records: SalesRecord[]}[] = [];
        const qties: Record<string, string> = {};

        cropMap.forEach((recs, cropName) => {
            const isProcessed = recs.every((r: SalesRecord) => r.grade === '-');
            const unit = recs[0].sale_unit || '박스';

            if (isProcessed) {
                // 가공품: 단순 수량
                const totalQty = recs.reduce((s: number, r: SalesRecord) => s + (r.quantity || 0), 0);
                qties[`${cropName}:-`] = totalQty.toString();
                cropGroups.push({ cropName, isProcessed: true, unit, records: recs });
            } else {
                // 원물: 등급별 처리
                const gradeQtyMap: Record<string, number> = {};
                const gradeRecordMap: Record<string, SalesRecord> = {};
                recs.forEach((rec: SalesRecord) => {
                    const gradeStr = rec.grade || '';
                    if (gradeOrder.includes(gradeStr)) {
                        gradeQtyMap[gradeStr] = (gradeQtyMap[gradeStr] || 0) + (rec.quantity || 0);
                        gradeRecordMap[gradeStr] = rec;
                    } else {
                        const parsed = parseGradeString(gradeStr, rec.quantity || 0);
                        for (const [g, q] of Object.entries(parsed)) {
                            const qNum = Number(q);
                            gradeQtyMap[g] = (gradeQtyMap[g] || 0) + qNum;
                            if (!gradeRecordMap[g]) {
                                gradeRecordMap[g] = { ...rec, id: null, grade: g, quantity: qNum, _isCompound: true };
                            }
                        }
                        if (rec.id) srcIds.add(rec.id);
                    }
                });
                const fullRecs = gradeOrder.map(grade =>
                    gradeRecordMap[grade] || {
                        id: null, grade, quantity: 0, sale_unit: unit,
                        recorded_at: first.recorded_at, farm_id: first.farm_id,
                        partner_id: first.partner_id, crop_name: cropName,
                    }
                );
                gradeOrder.forEach(grade => { qties[`${cropName}:${grade}`] = (gradeQtyMap[grade] || 0).toString(); });
                cropGroups.push({ cropName, isProcessed: false, unit, records: fullRecs });
            }
        });

        // 기존 단가 복원
        const prices: Record<string, string> = {};
        cropGroups.forEach(cg => {
            if (cg.isProcessed) {
                const p = cg.records[0]?.price;
                const q = cg.records.reduce((s: number, r: SalesRecord) => s + (r.quantity || 0), 0);
                prices[`${cg.cropName}:-`] = p && q ? String(Math.round(p / q)) : '';
            } else {
                cg.records.forEach((rec: SalesRecord) => {
                    const p = rec.price;
                    const q = rec.quantity || 0;
                    prices[`${cg.cropName}:${rec.grade}`] = p && q ? String(Math.round(p / q)) : '';
                });
            }
        });

        setModalQties(qties);
        setModalPrices(prices);
        setCompoundSourceIds(Array.from(srcIds));
        setEditModal({ open: true, records, cropGroups, compSalesRecordName });
    };

    // SettlementModal용 crop entries 계산
    const bulkCropEntries = useMemo((): ModalCropEntry[] => {
        if (!editModal.open) return [];
        const entries: ModalCropEntry[] = [];
        editModal.cropGroups.forEach(cg => {
            if (cg.isProcessed) {
                entries.push({
                    recordId: cg.records[0]?.id ?? null,
                    cropName: cg.cropName,
                    grade: '-',
                    quantity: Number(modalQties[`${cg.cropName}:-`] || '0'),
                    unit: cg.unit,
                    isProcessed: true,
                    unitPrice: Number(modalPrices[`${cg.cropName}:-`] || '0'),
                    cropIcon: cropIconMap[cg.cropName] || undefined,
                });
            } else {
                cg.records.forEach((rec: SalesRecord) => {
                    entries.push({
                        recordId: (rec.id && !rec._isCompound) ? rec.id : null,
                        cropName: cg.cropName,
                        grade: rec.grade,
                        quantity: Number(modalQties[`${cg.cropName}:${rec.grade}`] || '0'),
                        unit: cg.unit,
                        isProcessed: false,
                        unitPrice: Number(modalPrices[`${cg.cropName}:${rec.grade}`] || '0'),
                        cropIcon: cropIconMap[cg.cropName] || undefined,
                    });
                });
            }
        });
        return entries;
    }, [editModal.open, editModal.cropGroups, modalQties, modalPrices, cropIconMap]);

    const handleBulkSave = async (data: SettlementSaveData) => {
        if (!editModal.cropGroups.length || modalSaving || !farm?.id) return;
        setModalSaving(true);
        try {
            const first = editModal.records[0];
            const timeStr = first.recorded_at.split('T')[1] || new Date().toTimeString().split(' ')[0];
            const recordedAt = (data.date || modalDate) + 'T' + timeStr;
            const isSettled = data.paymentStatus === 'completed';

            // 1. 구형 복합 레코드 삭제
            for (const srcId of compoundSourceIds) {
                await supabase.from('sales_records').delete().eq('id', srcId);
            }

            // 2. 각 entry 처리
            for (const entry of data.entries) {
                const qty = entry.quantity;
                const price = isSettled && entry.unitPrice && qty ? entry.unitPrice * qty : null;
                const baseData = {
                    farm_id: farm.id, partner_id: first.partner_id,
                    crop_name: entry.cropName, sale_unit: entry.unit,
                    recorded_at: recordedAt,
                    payment_method: data.paymentMethod, payment_status: data.paymentStatus,
                    is_settled: isSettled,
                    settled_at: isSettled ? data.settleDate : null,
                    settled_amount: isSettled ? (data.actualAmount ?? price) : null,
                    delivery_method: 'direct', sale_type: 'b2b',
                    harvest_note: data.deductionReason || null,
                    delivery_note: data.memo || null,
                };
                if (entry.recordId) {
                    if (qty === 0) {
                        await supabase.from('sales_records').delete().eq('id', entry.recordId);
                    } else {
                        await supabase.from('sales_records').update({
                            recorded_at: recordedAt, quantity: qty,
                            payment_method: data.paymentMethod, payment_status: data.paymentStatus,
                            is_settled: isSettled, price,
                            settled_at: isSettled ? data.settleDate : null,
                            settled_amount: isSettled ? (data.actualAmount ?? price) : null,
                            harvest_note: data.deductionReason || null,
                            delivery_note: data.memo || null,
                        }).eq('id', entry.recordId);
                    }
                } else if (qty > 0) {
                    await supabase.from('sales_records').insert({ ...baseData, quantity: qty, grade: entry.grade, price });
                }
            }

            setEditModal({ open: false, records: [], cropGroups: [], compSalesRecordName: '' });
            setCompoundSourceIds([]);
            fetchHistory();
        } catch (error: SalesRecord) {
            console.error('수정 모달 저장 오류:', error);
            toast.error('저장 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
        } finally {
            setModalSaving(false);
        }
    };

    const handleBulkDelete = () => {
        if (!confirm("정말 삭제하시겠습니까? 삭제하시면 되돌릴 수 없으니, 자세히 확인 후 삭제하기 바랍니다.")) return;
        const allRecs = editModal.records.filter((r: SalesRecord) => r.id);
        Promise.all(allRecs.map((rec: SalesRecord) => supabase.from('sales_records').delete().eq('id', rec.id)))
            .then(() => {
                setEditModal({ open: false, records: [], cropGroups: [], compSalesRecordName: '' });
                setCompoundSourceIds([]);
                fetchHistory();
            })
            .catch((err: SalesRecord) => toast.error("삭제 중 오류가 발생했습니다: " + err.message));
    };


    const groupedHistory = useMemo(() => {
        // partner → date → transaction(recorded_at 기준) → records → cropGroups
        const partnerMap = new Map<string, {
            partnerId: string | null; compSalesRecordName: string; totalAmount: number;
            qtyByUnit: Record<string, number>;
            dailyMap: Map<string, Map<string, SalesRecord[]>>;
        }>();
        history.forEach(rec => {
            const displayName = (rec as SalesRecord).partner?.compSalesRecord_name || rec.customer_name || '미지정';
            const pKey = rec.partner_id || `no-id-${displayName}`;
            if (!partnerMap.has(pKey)) {
                partnerMap.set(pKey, { partnerId: rec.partner_id || null, compSalesRecordName: displayName, totalAmount: 0, qtyByUnit: {}, dailyMap: new Map() });
            }
            const pGroup = partnerMap.get(pKey)!;
            const recUnit = rec.sale_unit || '박스';
            pGroup.qtyByUnit[recUnit] = (pGroup.qtyByUnit[recUnit] || 0) + (rec.quantity || 0);
            pGroup.totalAmount += rec.price || 0;
            const date = rec.recorded_at.split('T')[0];
            if (!pGroup.dailyMap.has(date)) pGroup.dailyMap.set(date, new Map());
            const txKey = rec.recorded_at.slice(0, 16); // 분 단위 그룹화 (YYYY-MM-DDTHH:mm)
            const dayMap = pGroup.dailyMap.get(date)!;
            if (!dayMap.has(txKey)) dayMap.set(txKey, []);
            dayMap.get(txKey)!.push(rec);
        });
        return Array.from(partnerMap.values()).map(p => ({
            partnerId: p.partnerId, compSalesRecordName: p.compSalesRecordName, qtyByUnit: p.qtyByUnit, totalAmount: p.totalAmount,
            dailyGroups: Array.from(p.dailyMap.entries())
                .map(([date, txMap]) => ({
                    date,
                    transactions: Array.from(txMap.values()).map(records => {
                        // 품목별 하위 그룹핑
                        const cropMap = new Map<string, SalesRecord[]>();
                        records.forEach((r: SalesRecord) => {
                            const cn = r.crop_name || '미지정';
                            if (!cropMap.has(cn)) cropMap.set(cn, []);
                            cropMap.get(cn)!.push(r);
                        });
                        const cropGroups = Array.from(cropMap.entries()).map(([cn, recs]) => {
                            const isProcessed = recs.every((r: SalesRecord) => r.grade === '-');
                            const totalQty = recs.reduce((s: number, r: SalesRecord) => s + (r.quantity || 0), 0);
                            const unit = recs[0].sale_unit || '박스';
                            const gradeBreakdown = isProcessed
                                ? `${totalQty}${unit}`
                                : recs.map((r: SalesRecord) => `${r.grade}:${r.quantity}`).join(', ');
                            return { cropName: cn, records: recs, isProcessed, totalQty, unit, gradeBreakdown };
                        });
                        const txQtyByUnit = records.reduce((acc: SalesRecord, r: SalesRecord) => {
                            const u = r.sale_unit || '박스';
                            acc[u] = (acc[u] || 0) + (r.quantity || 0);
                            return acc;
                        }, {});
                        const uniqueCrops = cropGroups.map(cg => cg.cropName);
                        return {
                            txKey: records[0].recorded_at,
                            records,
                            cropGroups,
                            uniqueCrops,
                            qtyByUnit: txQtyByUnit,
                        };
                    })
                }))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }));
    }, [history]);

    const DEDUCTION_REASONS = ['조합공제', '운임공제', '품질하락', '시세조정', '선불차감', '기타'];

    // 바로 정산 시트 계산값 (다중 품목 - 가공품/원물 구분)
    const sheetGradesSummary = bulkItems.flatMap(item => {
        if (item.category === 'processed') {
            const q = Number(item.qty || 0);
            return q > 0 ? [{grade: '-', qty: q, itemId: item.id, cropName: item.cropName, cropIcon: item.cropIcon, unit: item.unit, key: `${item.id}--`}] : [];
        }
        return [{grade: '특/상', qty: Number(item.qtySang || 0)}, {grade: '중', qty: Number(item.qtyJung || 0)}, {grade: '하', qty: Number(item.qtyHa || 0)}]
            .filter(g => g.qty > 0)
            .map(g => ({...g, itemId: item.id, cropName: item.cropName, cropIcon: item.cropIcon, unit: item.unit, key: `${item.id}-${g.grade}`}));
    });
    const sheetExpected = sheetGradesSummary.reduce((sum, g) => {
        const up = sheetUnitPrices[g.key] ? Number(sheetUnitPrices[g.key]) : 0;
        return sum + up * g.qty;
    }, 0);
    const sheetActualNum = sheetActualAmount ? Number(sheetActualAmount) : 0;
    const sheetDeduction = (sheetExpected && sheetActualNum) ? sheetExpected - sheetActualNum : null;
    const closeSheet = () => { setShowSettlementSheet(false); setSheetUnitPrices({}); setSheetActualAmount(''); setSheetDeductionReason(''); setSheetMemo(''); };

    return (
        <div className="min-h-screen pb-20 bg-slate-50/30">
            <InventoryShortageDialog
                open={shortageOpen}
                mode={shortageMode}
                rows={shortageRows}
                onClose={closeShortageDialog}
                onContinue={
                    shortageMode === "warn" && pendingAction
                        ? async () => {
                            // 다음 저장 1회는 재고 체크를 건너뜀
                            skipStockCheckRef.current = true;
                            setShortageOpen(false);

                            if (pendingAction === "pending") {
                                await handleSavePending();
                            } else {
                                await handleSaveSettled();
                            }

                            setPendingAction(null);
                            skipStockCheckRef.current = false;
                        }
                        : undefined
                }
            />

            {/* 바로 정산 바텀시트 */}
            {showSettlementSheet && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
                    onClick={closeSheet}>
                    <div className="bg-white w-full max-w-md rounded-t-[2rem] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
                        onClick={e => e.stopPropagation()}>
                        {/* 드래그 핸들 */}
                        <div className="flex justify-center pt-3 pb-1 shrink-0">
                            <div className="w-10 h-1 rounded-full bg-slate-200" />
                        </div>
                        {/* 헤더 */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">즉시 정산</p>
                                <p className="text-sm font-black text-slate-900">바로 정산</p>
                            </div>
                            <button onClick={closeSheet}
                                className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {/* 스크롤 가능한 폼 */}
                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                            {/* 단가 (등급별) - 납품 요약 제거: 이미 상단에 표시됨 */}
                            <div className="bg-slate-50 rounded-2xl overflow-hidden">
                                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                                    <p className="text-[9px] font-black text-slate-400 uppercase">단가 (품목별)</p>
                                    {partners.find(p => p.id === selectedClientId)?.default_unit_price && (
                                        <span className="text-[9px] font-bold text-indigo-400">기본단가 자동입력됨</span>
                                    )}
                                </div>
                                {sheetGradesSummary.length > 0 ? sheetGradesSummary.map(g => {
                                    const subtotal = sheetUnitPrices[g.key] ? Number(sheetUnitPrices[g.key]) * g.qty : 0;
                                    const isProcessed = g.grade === '-';
                                    return (
                                        <div key={g.key} className="px-4 py-2.5 border-t border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm shrink-0">{g.cropIcon}</span>
                                                {isProcessed
                                                    ? <span className="text-xs font-black text-violet-500 shrink-0">{g.cropName}</span>
                                                    : <span className="text-xs font-black text-indigo-500 w-9 shrink-0">{g.grade}</span>
                                                }
                                                <span className="text-[10px] font-bold text-slate-400 shrink-0">{g.qty}{g.unit}</span>
                                                <div className="flex items-center gap-1 ml-auto">
                                                    <input type="text" inputMode="numeric"
                                                        value={sheetUnitPrices[g.key] ? Number(sheetUnitPrices[g.key]).toLocaleString() : ''}
                                                        onChange={e => setSheetUnitPrices(prev => ({ ...prev, [g.key]: e.target.value.replace(/[^0-9]/g, '') }))}
                                                        placeholder="단가"
                                                        className="w-32 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-right text-sm font-black text-slate-800 outline-none focus:border-indigo-300 transition-all" />
                                                    <span className="text-[10px] font-bold text-slate-400 shrink-0">원</span>
                                                </div>
                                            </div>
                                            {subtotal > 0 && (
                                                <p className="text-right text-[10px] font-black text-emerald-600 mt-1 pr-1">
                                                    = {subtotal.toLocaleString()}원
                                                </p>
                                            )}
                                        </div>
                                    );
                                }) : <p className="px-4 py-3 text-xs text-slate-300 font-bold border-t border-slate-100">품목을 추가하고 수량 입력 후 단가를 입력하세요</p>}
                                {sheetExpected > 0 && (
                                    <div className="flex items-center justify-between px-4 py-3 bg-slate-100 border-t border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-500">예상 총액</span>
                                        <span className="text-sm font-black text-slate-700">{sheetExpected.toLocaleString()}원</span>
                                    </div>
                                )}
                            </div>
                            {/* 결제수단 */}
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">결제수단</p>
                                <div className="flex gap-1.5 p-1.5 bg-slate-100 rounded-2xl">
                                    {['카드', '현금', '계좌이체'].map(m => (
                                        <button key={m} onClick={() => setSheetPaymentMethod(m)}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all
                                        ${sheetPaymentMethod === m ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`}>
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* 실입금액 + 차액 */}
                            <div className="bg-slate-50 rounded-2xl p-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">실입금액</p>
                                <div className="flex items-center gap-2">
                                    <input type="text" inputMode="numeric"
                                        value={sheetActualAmount ? Number(sheetActualAmount).toLocaleString() : ''}
                                        onChange={e => setSheetActualAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                        placeholder="0"
                                        className="flex-1 bg-transparent text-2xl font-black text-slate-800 outline-none text-right" />
                                    <span className="text-sm font-black text-slate-400">원</span>
                                </div>
                                {sheetDeduction !== null && (
                                    <div className={`flex items-center justify-between pt-2 mt-2 border-t ${sheetDeduction < 0 ? 'border-rose-100' : 'border-emerald-100'}`}>
                                        <span className="text-[10px] font-black text-slate-500">차액 (사정액)</span>
                                        <div className="text-right">
                                            <span className={`text-base font-black ${sheetDeduction < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {sheetDeduction > 0 ? '+' : ''}{sheetDeduction.toLocaleString()}원
                                            </span>
                                            {sheetDeduction < 0 && (
                                                <p className="text-[9px] text-rose-400 font-bold">공제 발생 → 사유 선택 권장</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* 차액사유 (선택) */}
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">
                                    차액 사유 <span className="text-slate-300 normal-case font-bold">(선택 · 업체별 집계 가능)</span>
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {DEDUCTION_REASONS.map(r => (
                                        <button key={r}
                                            onClick={() => setSheetDeductionReason(sheetDeductionReason === r ? '' : r)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border
                                        ${sheetDeductionReason === r
                                                    ? 'bg-rose-500 text-white border-rose-500'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-rose-200'}`}>
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* 메모 (선택) */}
                            <div className="bg-slate-50 rounded-2xl p-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">
                                    메모 <span className="text-slate-300 normal-case font-bold">(선택)</span>
                                </p>
                                <input type="text" value={sheetMemo} onChange={e => setSheetMemo(e.target.value)}
                                    placeholder="예: 운임 3,000원 공제 후 입금"
                                    className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-300" />
                            </div>
                        </div>
                        {/* 하단 고정 버튼 */}
                        <div className="flex gap-2 p-5 pt-3 border-t border-slate-100 shrink-0">
                            <button onClick={closeSheet}
                                className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-500 font-black text-sm">
                                취소
                            </button>
                            <button onClick={handleSaveSettled} disabled={saving}
                                className={`flex-[2] py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all
                            ${saving ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'} text-white`}>
                                {saving ? (
                                    <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>저장 중...</>
                                ) : (
                                    <><ShoppingCart className="w-4 h-4" /> 정산 완료로 저장</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 수정 모달 (SettlementModal 통합) */}
            {editModal.open && editModal.cropGroups.length > 0 && (
                <SettlementModal
                    mode="bulk-edit"
                    compSalesRecordName={editModal.compSalesRecordName}
                    deliveryDate={modalDate}
                    cropEntries={bulkCropEntries}
                    initialDate={modalDate}
                    initialPaymentStatus={modalPaymentStatus}
                    initialPaymentMethod={modalPaymentMethod}
                    initialDeductionReason={editModal.records[0]?.harvest_note || ''}
                    initialMemo={editModal.records[0]?.delivery_note || ''}
                    initialActualAmount={editModal.records[0]?.settled_amount ?? null}
                    onSave={handleBulkSave}
                    onDelete={handleBulkDelete}
                    onClose={() => { setEditModal({ open: false, records: [], cropGroups: [], compSalesRecordName: '' }); setCompoundSourceIds([]); }}
                    saving={modalSaving}
                />
            )}
            <div className="max-w-2xl mx-auto p-3 md:p-3 space-y-4">

                <div className="flex items-center justify-between px-1 gap-2">
                    <div className="flex flex-col min-w-0">
                        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                            납품 <Building2 className="w-4 h-4 text-indigo-500" />
                        </h1>
                        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                            <span className="text-[10px] font-black text-white bg-indigo-500 px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                                {new Date(selectedDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                            </span>
                        </div>
                    </div>
                    <button onClick={() => setShowCalendar(!showCalendar)}
                        className={`h-10 px-4 rounded-2xl font-black text-xs flex items-center gap-1.5 transition-all shadow-md border-2 shrink-0
                        ${showCalendar ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50'}`}>
                        <CalendarIcon className="w-4 h-4" /> {showCalendar ? '닫기' : '날짜변경'}
                    </button>
                </div>

                {showCalendar && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                        <CalendarComponent selectedDate={selectedDate} onChange={setSelectedDate} harvestedDates={{}} />
                        <div className="mt-2 flex items-center justify-center p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-sm font-black text-slate-700 outline-none w-full text-center" />
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-[2rem] shadow-xl border border-indigo-100 p-5 space-y-3">
                    {editingRecordId && (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5">
                            <span className="text-sm">✏️</span>
                            <span className="text-xs font-black text-amber-700">
                                수정 중: {partners.find(p => p.id === selectedClientId)?.compSalesRecord_name || '거래처'}
                            </span>
                        </div>
                    )}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-500 uppercase px-1">거래처 선택</label>
                        <div className="relative">
                            <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-black appearance-none outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner">
                                <option value="">거래처를 골라주세요</option>
                                {partners.map(p => <option key={p.id} value={p.id}>{p.compSalesRecord_name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* ② 🛒 품목 장바구니 */}
                <div className="bg-white rounded-[2rem] shadow-xl border border-indigo-100 p-5 space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-indigo-500 uppercase flex items-center gap-1">🛒 품목 담기 ({bulkItems.length})</label>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                        {farmCrops.map((crop) => (
                            <button key={crop.id}
                                onClick={() => addToBulkCart(crop)}
                                className="min-w-[68px] flex flex-col items-center justify-center py-2.5 px-1.5 rounded-2xl border-2 transition-all gap-0.5 shrink-0 bg-white border-slate-100 hover:border-indigo-300 hover:bg-indigo-50 active:scale-95">
                                <span className="text-2xl leading-none">{cropIconMap[crop.crop_name] || getCropIcon(crop.crop_name)}</span>
                                <span className="text-[9px] font-black text-slate-800 whitespace-nowrap truncate max-w-[60px]">{crop.crop_name}</span>
                            </button>
                        ))}
                    </div>
                    {bulkItems.length === 0 && (
                        <div className="text-center py-6 text-slate-300 text-xs font-bold border-2 border-dashed border-slate-100 rounded-2xl">
                            위 품목을 탭하면 자동으로 추가됩니다
                        </div>
                    )}
                    {bulkItems.map((item) => (
                        <div key={item.id} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{item.cropIcon}</span>
                                    <span className="text-sm font-black text-slate-800">{item.cropName}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {(() => { const cr = farmCrops.find(c => c.crop_name === item.cropName); return cr ? getEffectiveUnits(cr) : [item.unit]; })().map((u: string) => (
                                        <button key={u} onClick={() => updateBulkItem(item.id, 'unit', u)}
                                            className={`text-[9px] font-bold px-2 py-1 rounded-lg transition-all ${item.unit === u ? 'bg-indigo-500 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                            {u}
                                        </button>
                                    ))}
                                    <button onClick={() => removeBulkItem(item.id)} className="p-1 text-slate-300 hover:text-red-400 transition-colors ml-0.5"><X className="w-4 h-4" /></button>
                                </div>
                            </div>
                            {item.category === 'processed' ? (
                                /* 가공품: 단순 수량 1칸 */
                                <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                                    <span className="text-[10px] font-black text-violet-500 shrink-0">수량</span>
                                    <input type="text" inputMode="numeric" value={item.qty}
                                        onChange={(e) => updateBulkItem(item.id, 'qty', e.target.value.replace(/[^0-9]/g, ''))}
                                        className="flex-1 bg-transparent text-center text-lg font-black text-slate-800 outline-none" placeholder="0" />
                                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{item.unit}</span>
                                </div>
                            ) : (
                                /* 원물: 등급별 수량 3칸 */
                                <div className="grid grid-cols-3 gap-2">
                                    {[{label: '특/상', field: 'qtySang', val: item.qtySang}, {label: '중', field: 'qtyJung', val: item.qtyJung}, {label: '하', field: 'qtyHa', val: item.qtyHa}].map((g) => (
                                        <div key={g.field} className="bg-white p-2.5 rounded-xl border border-slate-100 flex flex-col items-center">
                                            <span className="text-[9px] font-black text-slate-400 mb-1">{g.label}</span>
                                            <input type="text" inputMode="numeric" value={g.val}
                                                onChange={(e) => updateBulkItem(item.id, g.field, e.target.value.replace(/[^0-9]/g, ''))}
                                                className="w-full bg-transparent text-center text-lg font-black text-slate-800 outline-none" placeholder="0" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* ③ 저장 버튼 */}
                <div className="flex gap-2">
                    <button onClick={handleSavePending} disabled={saving}
                        className="flex-1 py-4 rounded-[1.25rem] text-sm font-black text-amber-700 bg-amber-50 border-2 border-amber-300 shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
                        {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> 미정산 저장</>}
                    </button>
                    <button onClick={() => {
                        const partner = partners.find(p => p.id === selectedClientId);
                        if (partner?.default_unit_price) {
                            const dp = String(partner.default_unit_price);
                            const prices: Record<string, string> = {};
                            bulkItems.forEach(bi => {
                                if (bi.category === 'processed') {
                                    prices[`${bi.id}--`] = dp;
                                } else {
                                    ['특/상', '중', '하'].forEach(g => { prices[`${bi.id}-${g}`] = dp; });
                                }
                            });
                            setSheetUnitPrices(prices);
                        }
                        setShowSettlementSheet(true);
                    }} disabled={saving}
                        className="flex-1 py-4 rounded-[1.25rem] text-sm font-black text-white bg-emerald-500 shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
                        <ShoppingCart className="w-4 h-4" /> 바로 정산
                    </button>
                </div>

                <div className="space-y-3 pb-10">
                    <h2 className="text-sm font-black text-slate-800 flex items-center gap-2 px-1">
                        <History className="w-4 h-4 text-slate-300" /> 미결산 납품 내역
                        <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                            {groupedHistory.reduce((acc, p) => acc + p.dailyGroups.reduce((s, d) => s + d.transactions.length, 0), 0)}건
                        </span>
                    </h2>
                    {groupedHistory.length === 0 ? (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-100 py-10 text-center">
                            <p className="text-xs font-bold text-slate-400">미결산 납품 내역이 없습니다 🎉</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {groupedHistory.map(pGroup => {
                                const pKey = pGroup.partnerId || `no-id-${pGroup.compSalesRecordName}`;
                                const isExpanded = expandedPartners.includes(pKey);
                                return (
                                    <div key={pKey} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                        {/* 거래처 헤더 */}
                                        <button
                                            onClick={() => setExpandedPartners(prev => isExpanded ? prev.filter(k => k !== pKey) : [...prev, pKey])}
                                            className="w-full px-4 py-3 flex items-center justify-between gap-3"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                                                <div className="text-left min-w-0">
                                                    <p className="text-sm font-black text-slate-900 truncate">{pGroup.compSalesRecordName}</p>
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold mt-0.5">
                                                        <span className="text-slate-400">{pGroup.dailyGroups.reduce((s, d) => s + d.transactions.length, 0)}건</span>
                                                        <span className="text-slate-200">|</span>
                                                        <span className="text-amber-500">미결산</span>
                                                        <span className="text-slate-200">|</span>
                                                        <span className="text-slate-500 truncate">{(() => {
                                                            const cropTotals = new Map<string, {qty: number; unit: string}>();
                                                            pGroup.dailyGroups.forEach((dg: SalesRecord) => {
                                                                dg.transactions.forEach((tx: SalesRecord) => {
                                                                    tx.cropGroups.forEach((cg: SalesRecord) => {
                                                                        const key = `${cg.cropName}|${cg.unit}`;
                                                                        const prev = cropTotals.get(key);
                                                                        cropTotals.set(key, { qty: (prev?.qty || 0) + cg.totalQty, unit: cg.unit });
                                                                    });
                                                                });
                                                            });
                                                            return Array.from(cropTotals.entries()).map(([key, v]) => {
                                                                const cropName = key.split('|')[0];
                                                                return `${cropName} ${v.qty.toLocaleString()}${v.unit}`;
                                                            }).join(', ');
                                                        })()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <ChevronDown className={`w-4 h-4 text-slate-300 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* 날짜별 상세 - 수정된 부분 (날짜별 카드 디자인) */}
                                        {isExpanded && (
                                            <div className="border-t border-slate-50">
                                                {pGroup.dailyGroups.map(dGroup => (
                                                    <div key={dGroup.date} className="p-3 border-b border-slate-100 last:border-b-0">
                                                        {/* 날짜별 카드 */}
                                                        <div className="border-4 border-green-500 rounded-xl overflow-hidden">

                                                            {/* 날짜 헤더 + 전표 건수 */}
                                                            <div className="bg-green-50 px-4 py-2 border-b border-green-200 flex items-center gap-2">
                                                                <p className="text-sm font-black text-green-800">
                                                                    {new Date(dGroup.date).toLocaleDateString('ko-KR', {
                                                                        month: 'long',
                                                                        day: 'numeric',
                                                                        weekday: 'short'
                                                                    })}
                                                                </p>
                                                                {dGroup.transactions.length > 1 && (
                                                                    <span className="ml-2 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                                                                        {dGroup.transactions.length}건
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* 판매 물품 목록 - 전표 카드형 */}
                                                            <div className="p-3 bg-white space-y-2.5">
                                                                {dGroup.transactions.map(tx => (
                                                                    <div key={tx.txKey}
                                                                        onClick={() => handleEditModal(tx.records, pGroup.compSalesRecordName)}
                                                                        className="bg-slate-50/70 rounded-xl border border-slate-100 cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/20 transition-all group overflow-hidden">
                                                                        {/* 전표 헤더: 다중품목일 때만 아이콘 + 종류수 표시 */}
                                                                        {tx.cropGroups.length > 1 && (
                                                                            <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 bg-orange-50 border-b border-orange-200">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <div className="flex items-center gap-0.5">
                                                                                        {tx.cropGroups.map((cg: SalesRecord, i: number) => (
                                                                                            <span key={i} className="text-lg leading-none">{cropIconMap[cg.cropName] || getCropIcon(cg.cropName)}</span>
                                                                                        ))}
                                                                                    </div>
                                                                                    <span className="text-[8px] font-black bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full">{tx.cropGroups.length}종류</span>
                                                                                </div>
                                                                                <Edit2 className="w-3 h-3 text-slate-200 group-hover:text-indigo-400 transition-all shrink-0" />
                                                                            </div>
                                                                        )}
                                                                        {/* 품목별 행 */}
                                                                        <div className={`px-3 pb-2 space-y-1 ${tx.cropGroups.length === 1 ? 'pt-2.5' : ''}`}>
                                                                            {tx.cropGroups.map((cg: SalesRecord, i: number) => (
                                                                                <div key={i} className="flex items-center gap-2 text-xs">
                                                                                    <span className="text-sm shrink-0">{cropIconMap[cg.cropName] || getCropIcon(cg.cropName)}</span>
                                                                                    <span className="font-black text-slate-700 shrink-0">{cg.cropName}</span>
                                                                                    {cg.isProcessed ? (
                                                                                        <span className="font-bold text-violet-500">{cg.totalQty}{cg.unit}</span>
                                                                                    ) : (
                                                                                        <span className="font-black text-indigo-500">{cg.gradeBreakdown}</span>
                                                                                    )}
                                                                                    <span className="text-slate-300">|</span>
                                                                                    <span className="font-bold text-slate-400">{cg.totalQty.toLocaleString()}{cg.unit}</span>
                                                                                    {/* 단일 품목일 때 수정 아이콘 */}
                                                                                    {tx.cropGroups.length === 1 && i === 0 && (
                                                                                        <Edit2 className="w-3 h-3 text-slate-200 group-hover:text-indigo-400 transition-all shrink-0 ml-auto" />
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        {/* 전표 품목별 요약 (2종류 이상) */}
                                                                        {tx.cropGroups.length > 1 && (
                                                                            <div className="mx-3 mb-2 pt-2 border-t-2 border-slate-300">
                                                                                <p className="text-right text-[10px] font-bold text-slate-500">
                                                                                    {tx.cropGroups.map((cg: SalesRecord) => `${cg.cropName} ${cg.totalQty.toLocaleString()}${cg.unit}`).join(' · ')}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}

                                                                {/* 날짜별 품목 요약: 2건 이상일 때만 표시 */}
                                                                {dGroup.transactions.length > 1 && (
                                                                    <div className="mt-2 pt-2 text-right text-[10px] font-bold text-slate-500 border-t-2 border-slate-300">
                                                                        {(() => {
                                                                            const cropTotals = new Map<string, {qty: number; unit: string}>();
                                                                            dGroup.transactions.forEach((tx: SalesRecord) => {
                                                                                tx.cropGroups.forEach((cg: SalesRecord) => {
                                                                                    const key = `${cg.cropName}|${cg.unit}`;
                                                                                    const prev = cropTotals.get(key);
                                                                                    cropTotals.set(key, { qty: (prev?.qty || 0) + cg.totalQty, unit: cg.unit });
                                                                                });
                                                                            });
                                                                            return Array.from(cropTotals.entries()).map(([key, v]) => {
                                                                                const cropName = key.split('|')[0];
                                                                                return `${cropName} ${v.qty.toLocaleString()}${v.unit}`;
                                                                            }).join(' · ');
                                                                        })()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}