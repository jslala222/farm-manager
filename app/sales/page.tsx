"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Package, Search, Plus, Calendar, Filter, ArrowRight, User, Phone, MapPin, Building2, CreditCard, DollarSign, Edit2, Trash2, History, TrendingUp, CheckCircle, Clock, ChevronRight, RotateCcw, UserPlus, Lock, Unlock, Star, MoreVertical, ShoppingCart, AlertTriangle, RefreshCcw, X, AlignLeft, Zap, Save, Utensils, UserSquare, Calculator, Settings, Check } from 'lucide-react';
import { useAuthStore } from "@/store/authStore";
import { supabase, SalesRecord, Partner, Customer } from "@/lib/supabase";
import { settlementService } from '@/lib/settlementService';
import { formatPhone, formatCurrency, stripNonDigits } from "@/lib/utils";
import AddressSearch from "@/components/AddressSearch";
import { getRecentAddressSets, AddressSet } from '@/lib/deliveryService';

export default function SalesPage() {
    const { farm, initialized } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'bulk' | 'courier'>('bulk');
    const [partners, setPartners] = useState<Partner[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [history, setHistory] = useState<SalesRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [showUnsettledOnly, setShowUnsettledOnly] = useState(false);
    const [dbError, setDbError] = useState<string | null>(null);

    // B2B State (품질 등급별 일괄 입력)
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [bulkQtySang, setBulkQtySang] = useState(""); // 특/상
    const [bulkQtyJung, setBulkQtyJung] = useState(""); // 중
    const [bulkQtyHa, setBulkQtyHa] = useState("");   // 하
    const [bulkPrice, setBulkPrice] = useState("");

    // B2C State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResult, setSearchResult] = useState<Customer[]>([]);
    const [selectedSearchResult, setSelectedSearchResult] = useState<Customer | null>(null);
    const [newClientName, setNewClientName] = useState("");
    const [newClientPhone, setNewClientPhone] = useState("");
    const [newClientAddress, setNewClientAddress] = useState("");
    const [newClientPostalCode, setNewClientPostalCode] = useState("");
    const [newClientLatitude, setNewClientLatitude] = useState<number | null>(null);
    const [newClientLongitude, setNewClientLongitude] = useState<number | null>(null);
    const [newClientDetailAddress, setNewClientDetailAddress] = useState(""); // 상세 주소 (동/호수)
    const [deliveryNote, setDeliveryNote] = useState(""); // 배송 특이사항 (메모)
    const [isNewClientMode, setIsNewClientMode] = useState(false);

    const [courierBoxCount, setCourierBoxCount] = useState("");
    const [courierTotalPrice, setCourierTotalPrice] = useState(""); // 총 판매금액
    const [isSettled, setIsSettled] = useState(false); // 정산 완료 여부
    const [isSearchOpen, setIsSearchOpen] = useState(false); // 검색 드롭다운 상태
    const [isOrdererLocked, setIsOrdererLocked] = useState(false); // 주문자 정보 고정 여부
    const [recipientName, setRecipientName] = useState(""); // 수령인 (사람/업체/부서)
    const [recipientPhone, setRecipientPhone] = useState(""); // 수령인 연락처
    const [isAddressManualMode, setIsAddressManualMode] = useState(false); // 다른 주소 배송 모드
    const [recentAddresses, setRecentAddresses] = useState<AddressSet[]>([]); // 최근 배송지 세트 리스트
    const [customerStats, setCustomerStats] = useState<{ count: number, total_qty: number, total_price: number } | null>(null); // 고객별 누적 통계

    // Payment & Shipping Configuration
    const [shippingPaymentType, setShippingPaymentType] = useState<'prepaid' | 'cod'>('prepaid');

    // Cost Configuration (Unit Costs)
    const [unitShippingCost, setUnitShippingCost] = useState(settlementService.getDefaultB2CCosts().unitShipping.toString()); // 박스당 택배비
    const [unitMaterialCost, setUnitMaterialCost] = useState(settlementService.getDefaultB2CCosts().unitMaterial.toString()); // 박스당 자재비

    // Calculated Total Costs (Editable)
    const [totalShippingCost, setTotalShippingCost] = useState("");
    const [totalMaterialCost, setTotalMaterialCost] = useState("");

    const [showCostDetails, setShowCostDetails] = useState(false); // 상세 설정 토글

    // Auto-calculate totals when box count or unit costs change
    // But ONLY if we are NOT editing an existing record that might have custom values
    // Actually, even when editing, if user changes box count, we should probably recalculate?
    // Let's stick to simple logic: change in Quantity/UnitCost -> Recalculate Total.
    useEffect(() => {
        const count = parseFloat(courierBoxCount) || 0;
        const shippingUnit = parseInt(unitShippingCost.replace(/[^\d]/g, '')) || 0;
        const materialUnit = parseInt(unitMaterialCost.replace(/[^\d]/g, '')) || 0;

        // If we are editing, we might want to preserve the loaded totals initially.
        // But if user changes box count, we must update.
        // We can check if totals are empty to initialize?

        // Simple heuristic: always calc unless user manually typed in totals (which we can't easily track without more state).
        // For now, let's just calc. User can override totals again if needed.
        // BETTER: when loading, set totals directly. This effect might run after state update? 
    }, [courierBoxCount, unitShippingCost, unitMaterialCost]);

    // Refined Effect for Auto-calc
    useEffect(() => {
        // We only want to auto-calc if the USER changes these inputs, not when we programmatically set them during Edit Load.
        // But we can't easily distinguish.
        // A workaround: Check if the current total matches the formula. If not (meaning manual override), maybe don't touch it?
        // Too complex. Let's just calculate.
        const count = parseFloat(courierBoxCount) || 0;
        const shippingUnit = parseInt(unitShippingCost.replace(/[^\d]/g, '')) || 0;
        const materialUnit = parseInt(unitMaterialCost.replace(/[^\d]/g, '')) || 0;

        if (count > 0) {
            // We set it, but we strictly don't want to overwrite if we just loaded an edit form
            // simple check: do nothing here.
            // Wait, we need this for new entries.
            setTotalShippingCost((shippingUnit * count).toString());
            setTotalMaterialCost((materialUnit * count).toString());
        } else {
            setTotalShippingCost("");
            setTotalMaterialCost("");
        }
    }, [courierBoxCount, unitShippingCost, unitMaterialCost]);

    const fetchInitialData = useCallback(async () => {
        if (!farm?.id) return;
        setLoading(true);
        await Promise.all([
            fetchClients(),
            fetchHistory()
        ]);
        setLoading(false);
    }, [farm]);

    useEffect(() => {
        if (initialized && farm?.id) {
            fetchInitialData();
        }
    }, [farm, initialized, fetchInitialData]);

    // [bkit] 실시간 동기화 엔진 (사장님의 "실시간 반영" 요구사항 반영)
    useEffect(() => {
        const channel = supabase
            .channel('sales_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_records' }, () => {
                fetchInitialData(); // 변경 감지 시 즉시 재조회
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchInitialData]);

    // 탭 전환 시 모든 상태 초기화 (메모리 누수 차단 및 사장님 요청사항)
    useEffect(() => {
        handleResetAllStates();
        if (activeTab === 'bulk') setIsSettled(false); // B2B는 기본 미정산
        else setIsSettled(true); // B2C는 기본 정산 완료
    }, [activeTab]);

    const handleResetAllStates = () => {
        // [1] 배송 목적지 및 이번 거래 전용 정보 - 무조건 초기화
        setCourierBoxCount("");
        setCourierTotalPrice("");
        setTotalShippingCost("");
        setTotalMaterialCost("");
        setRecipientName("");
        setRecipientPhone("");
        setNewClientAddress("");
        setNewClientPostalCode("");
        setNewClientDetailAddress("");
        setDeliveryNote("");
        setIsAddressManualMode(false);
        setNewClientLatitude(null);
        setNewClientLongitude(null);
        setIsSettled(activeTab === 'courier'); // 택배는 기본 완료, 납품은 기본 미정산

        // [2] 주문자(결제자) 정보 - 고정 모드가 아닐 때만 초기화
        if (!isOrdererLocked) {
            // B2B 폼 초기화
            setSelectedClientId("");
            setBulkQtySang("");
            setBulkQtyJung("");
            setBulkQtyHa("");
            setBulkPrice("");

            // B2C 폼 초기화
            setSearchTerm("");
            setSearchResult([]);
            setIsSearchOpen(false);
            setSelectedSearchResult(null);
            setNewClientName("");
            setNewClientPhone("");
            setIsNewClientMode(false);
            setCustomerStats(null);
            setRecentAddresses([]);
        } else {
            // 고정 모드일 때는 검색 관련 상태만 비워줌
            setSearchTerm("");
            setSearchResult([]);
            setIsSearchOpen(false);
        }
    };

    useEffect(() => {
        // B2C 검색 로직 (Customers 테이블 기반)
        if (searchTerm.length > 0) {
            const results = customers.filter(c =>
                c.name.includes(searchTerm) || (c.contact && c.contact.includes(searchTerm))
            );
            setSearchResult(results);
        } else if (isSearchOpen && searchTerm.length === 0) {
            // 검색 버튼이나 인풋을 클릭했을 때만 VIP(단골) 목록 노출
            const vips = customers.filter(c => c.is_vip);
            setSearchResult(vips);
        } else {
            setSearchResult([]);
        }
    }, [searchTerm, customers, isSearchOpen]);

    // 외부 클릭 시 검색 드롭다운 닫기
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.search-container')) {
                setIsSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const fetchClients = async () => {
        if (!farm?.id) return;
        const [partnersRes, customersRes] = await Promise.all([
            supabase.from('partners').select('*').eq('farm_id', farm.id).order('company_name'),
            supabase.from('customers').select('*').eq('farm_id', farm.id).order('name')
        ]);
        if (partnersRes.data) setPartners(partnersRes.data);
        if (customersRes.data) setCustomers(customersRes.data);
    };

    const fetchHistory = async (unsettledOnly: boolean = showUnsettledOnly) => {
        if (!farm?.id) return;
        setLoading(true);

        let query = supabase
            .from('sales_records')
            .select(`
                *,
                partner: partners(id, company_name, manager_contact),
                customer: customers(id, name, contact, address, is_vip)
            `)
            .eq('farm_id', farm.id)
            .order('recorded_at', { ascending: false });

        // [bkit 전역 동기화] 미정산 필터 시 20건 제한 해제 (통합 결산과 숫자 일치 유도)
        if (unsettledOnly) {
            query = query.eq('is_settled', false);
        } else {
            query = query.limit(20);
        }

        const { data, error } = await query;
        if (error) console.error("Fetch History Error:", error);

        setHistory(data ?? []);
        setDbError(null);
        setLoading(false);
    };

    const handleAutoFix = async () => {
        if (!confirm("데이터베이스 구조를 자동으로 정비하시겠습니까?\n(배송 특이사항, 상세 주소 등 누락된 모든 필드가 즉시 생성됩니다.)")) return;

        setLoading(true);
        const fullSql = `
--1. 기존 필드 체크 및 추가
            ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS harvest_note TEXT;
            ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT FALSE;
            ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS recipient_name TEXT;
            ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS recipient_phone TEXT;
            ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS postal_code TEXT;
            ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
            ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

--2. 상세 주소 및 배송 메모 필드(사장님 긴급 요청사항)
            ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS detail_address TEXT;
            ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS delivery_note TEXT;
            ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS grade TEXT DEFAULT '미지정';
            ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS detail_address TEXT;

--3. 기타 운영 필드
            ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS default_daily_wage INTEGER DEFAULT 0;
            ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS actual_wage INTEGER;
            ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS memo TEXT;

--4. 권한 부여(혹시 모를 권한 문제 방지)
            GRANT ALL ON TABLE public.sales_records TO authenticated;
            GRANT ALL ON TABLE public.customers TO authenticated;
`;

        const { error } = await supabase.rpc('exec_sql', { sql_query: fullSql });

        if (error) {
            console.error("AutoFix Error:", error);
            alert("자동 복구 도중 오류가 발생했습니다.\n\n[원인]: " + (error.message || "권한 부족") + "\n\n사장님, 죄송하지만 Supabase SQL Editor에서 제가 드린 코드를 한 번만 직접 실행해 주세요. (가장 확실한 방법입니다.)");
        } else {
            alert("DB 구조가 성공적으로 복구되었습니다! 🍓\n\n이제 상세 주소와 배송 특이사항을 마음껏 기록하실 수 있습니다. 장부를 다시 불러옵니다.");
            fetchHistory();
        }
        setLoading(false);
    };

    const handleSelectClient = async (customer: Customer) => {
        setSelectedSearchResult(customer);
        setNewClientName(customer.name);
        setNewClientPhone(customer.contact || "");
        setNewClientAddress(customer.address || "");
        setNewClientPostalCode(customer.postal_code || "");
        setNewClientDetailAddress(customer.detail_address || "");
        setNewClientLatitude(customer.latitude || null);
        setNewClientLongitude(customer.longitude || null);
        setSearchTerm("");
        setSearchResult([]);
        setIsSearchOpen(false);
        setIsNewClientMode(false);

        // 구매 인사이트 연동 (Standardization 8번 준수: 모든 과거 내역 데이터화)
        try {
            const { data, error } = await supabase
                .from('sales_records')
                .select('quantity, price')
                .eq('customer_id', customer.id);

            if (data) {
                const stats = data.reduce((acc, curr) => ({
                    count: acc.count + 1,
                    total_qty: acc.total_qty + (curr.quantity || 0),
                    total_price: acc.total_price + (curr.price || 0)
                }), { count: 0, total_qty: 0, total_price: 0 });
                setCustomerStats(stats);
            }
        } catch (e: any) {
            console.warn("인사이트 로드 실패:", e.message || e);
        }
    };

    // 고객 선택 시 최근 배송지 불러오기
    useEffect(() => {
        const loadRecentAddresses = async () => {
            if (activeTab === 'courier' && selectedSearchResult?.id) {
                // 수동 모드거나 수정 중일 때는 자동 로드를 건너뜁니다 (사장님의 의도적 변경 보호)
                if (editingRecordId || isAddressManualMode) return;

                const sets = await getRecentAddressSets(selectedSearchResult.id);
                setRecentAddresses(sets);

                // 기본적으로 가장 최근 배송지가 있으면 채워줌 (사장님 편의)
                if (sets.length > 0) {
                    const latest = sets[0];
                    setRecipientName(latest.recipient_name || "");
                    setRecipientPhone(latest.recipient_phone || "");
                    setNewClientAddress(latest.address || "");
                    setNewClientPostalCode(latest.postal_code || "");
                    setNewClientDetailAddress(latest.detail_address || "");
                    setDeliveryNote(latest.delivery_note || "");
                } else {
                    // 기록이 없으면 고객 본인 정보를 기본으로
                    setRecipientName(selectedSearchResult.name || "");
                    setRecipientPhone(selectedSearchResult.contact || "");
                    setNewClientAddress(selectedSearchResult?.address || "");
                    setNewClientPostalCode(selectedSearchResult?.postal_code || "");
                    setNewClientDetailAddress(selectedSearchResult.detail_address || "");
                    setDeliveryNote("");
                }
            }
        };
        loadRecentAddresses();
    }, [selectedSearchResult?.id, activeTab, editingRecordId, isAddressManualMode]); // id와 탭이 바뀔 때만 실행하여 입력 중 '되돌아감' 방지

    const handleResetClient = () => {
        setSelectedSearchResult(null);
        setNewClientName("");
        setNewClientPhone("");
        setNewClientAddress("");
        setNewClientPostalCode("");
        setNewClientLatitude(null);
        setNewClientLongitude(null);
        setSearchTerm("");
        setSearchResult([]);
        setIsSearchOpen(false);
        setIsNewClientMode(false);
        setRecipientName("");
        setRecipientPhone("");
        setIsAddressManualMode(false);
        setRecentAddresses([]);
    };

    const calculateProfit = () => {
        if (activeTab === 'bulk') {
            const price = parseInt(stripNonDigits(bulkPrice)) || 0;
            // B2B는 현재 단순 매출로 표시 (추후 자재비 연동 가능)
            return price;
        } else {
            const price = parseInt(stripNonDigits(courierTotalPrice)) || 0;
            const shipping = parseInt(stripNonDigits(totalShippingCost)) || 0;
            const material = parseInt(stripNonDigits(totalMaterialCost)) || 0;

            if (shippingPaymentType === 'cod') {
                return (price - material);
            } else {
                return (price - (shipping + material));
            }
        }
    };

    // EDIT FUNCTIONALITY
    const handleEdit = (record: SalesRecord) => {
        setEditingRecordId(record.id);
        const recordDate = new Date(record.recorded_at).toISOString().split('T')[0];
        setSelectedDate(recordDate);

        // [bkit 정밀 수술] 기록의 정체(sale_type)를 최우선으로 하여 해당 탭으로 강제 소환
        if (settlementService.isB2B(record)) {
            setActiveTab('bulk');
            setSelectedClientId(record.partner_id || "");
            // 수정 시 해당 등급에 맞는 칸에 수량 배치
            setBulkQtySang("");
            setBulkQtyJung("");
            setBulkQtyHa("");
            if (record.grade === '특/상' || record.grade === '특') setBulkQtySang(record.quantity.toString());
            else if (record.grade === '중' || record.grade === '보통') setBulkQtyJung(record.quantity.toString());
            else if (record.grade === '하') setBulkQtyHa(record.quantity.toString());
            else setBulkQtySang(record.quantity.toString()); // 기본값

            setBulkPrice(record.price ? record.price.toString() : "");
            setIsSettled(record.is_settled || false);
        } else {
            setActiveTab('courier');
            // Restore Customer Info
            if (record.customer) {
                handleSelectClient(record.customer as unknown as Customer);
            } else {
                setNewClientName(record.customer_name || "");
                setIsNewClientMode(true);
            }

            setCourierBoxCount(record.quantity.toString());
            setCourierTotalPrice(record.price ? record.price.toString() : "");

            setTotalShippingCost((record.shipping_cost ?? 0).toString());
            setTotalMaterialCost((record.packaging_cost ?? 0).toString());

            if (record.quantity > 0) {
                setUnitShippingCost(Math.round((record.shipping_cost ?? 0) / record.quantity).toString());
                setUnitMaterialCost(Math.round((record.packaging_cost ?? 0) / record.quantity).toString());
            }

            if (record.shipping_cost === 0 && record.delivery_method === 'courier') {
                setShippingPaymentType('cod');
            } else {
                setShippingPaymentType('prepaid');
            }

            setRecipientName(record.recipient_name || "");
            setRecipientPhone(record.recipient_phone || "");
            setNewClientAddress(record.address || "");
            setNewClientPostalCode(record.postal_code || "");
            setNewClientLatitude(record.latitude || null);
            setNewClientLongitude(record.longitude || null);
            setIsSettled(record.is_settled || false);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        handleResetAllStates();
        setEditingRecordId(null);
    };

    const handleSave = async () => {
        if (!farm?.id) return;
        setSaving(true);

        try {
            const now = new Date();
            const timeString = now.toTimeString().split(' ')[0];
            const recordedAt = `${selectedDate}T${timeString} `;

            let recordData: any = {
                farm_id: farm.id,
                recorded_at: new Date(recordedAt).toISOString(),
            };

            if (activeTab === 'bulk') {
                if (!selectedClientId) { alert("거래처를 선택해주세요."); setSaving(false); return; }

                const entries = [
                    { grade: '특/상', qty: Number(bulkQtySang) || 0 },
                    { grade: '중', qty: Number(bulkQtyJung) || 0 },
                    { grade: '하', qty: Number(bulkQtyHa) || 0 }
                ].filter(e => e.qty > 0);

                if (entries.length === 0) { alert("최소 하나 이상의 등급 수량을 입력해주세요."); setSaving(false); return; }

                if (editingRecordId) {
                    // [수정 모드] B2B 단일 기록 수정
                    const targetEntry = entries[0]; // 수정 시에는 어차피 한 칸만 채워져 있거나 합산된 값이 들어옴
                    const updateData = {
                        ...recordData,
                        partner_id: selectedClientId,
                        sale_type: 'nonghyup',
                        delivery_method: 'nonghyup',
                        quantity: targetEntry.qty,
                        grade: targetEntry.grade,
                        // [bkit 데이터 결벽증] 단가 필드에는 (수량 * 입력단가) 합계를 저장하여 결산 정합성 확보
                        price: bulkPrice ? (targetEntry.qty * Number(stripNonDigits(bulkPrice))) : null,
                        is_settled: isSettled,
                    };
                    const { error } = await supabase.from('sales_records').update(updateData).eq('id', editingRecordId);
                    if (error) throw error;
                    alert("✅ 납품 기록이 수정되었습니다.");
                } else {
                    // [신규 모드] 등급별 일괄 저장
                    const records = entries.map(entry => ({
                        ...recordData,
                        partner_id: selectedClientId,
                        sale_type: 'nonghyup',
                        delivery_method: 'nonghyup',
                        quantity: entry.qty,
                        grade: entry.grade,
                        // [bkit 데이터 결벽증] 일괄 저장 시에도 각 내역별로 (수량 * 단가)를 정확히 계산하여 저장
                        price: bulkPrice ? (entry.qty * Number(stripNonDigits(bulkPrice))) : null,
                        shipping_cost: 0,
                        packaging_cost: 0,
                        is_settled: isSettled,
                    }));
                    const { error } = await supabase.from('sales_records').insert(records);
                    if (error) throw error;
                    alert(`✅ ${partners.find(p => p.id === selectedClientId)?.company_name} 납품 기록 ${records.length}건이 저장되었습니다.`);
                }

                handleCancelEdit();
                fetchHistory();
                setSaving(false);
                return; // B2B는 여기서 끝냄
            } else {
                // Courier Tab (B2C)
                if (!courierBoxCount) { alert("박스 수량을 입력해주세요."); setSaving(false); return; }

                let finalCustomerId = selectedSearchResult?.id;

                // 신규 고객이면 먼저 등록
                if (!finalCustomerId) {
                    if (!newClientName) { alert("고객 이름을 입력해주세요."); setSaving(false); return; }

                    const { data: newCustomer, error: clientError } = await supabase
                        .from('customers')
                        .insert({
                            farm_id: farm.id,
                            name: newClientName,
                            contact: newClientPhone,
                            address: newClientAddress,
                            postal_code: newClientPostalCode,
                            latitude: newClientLatitude,
                            longitude: newClientLongitude,
                            is_vip: false
                        })
                        .select()
                        .single();

                    if (clientError) throw clientError;
                    finalCustomerId = newCustomer.id;
                    fetchClients();
                }

                // [완벽 보강] 모든 숫자 값 정밀 정제 (NaN 및 소수점 문제 해결)
                const count = Math.max(0, Number(courierBoxCount) || 0);
                const shipping = Math.max(0, Number(stripNonDigits(totalShippingCost)) || 0);
                const material = Math.max(0, Number(stripNonDigits(totalMaterialCost)) || 0);
                const totalPrice = courierTotalPrice ? Math.max(0, Number(stripNonDigits(courierTotalPrice))) : null;
                const finalShippingCost = shippingPaymentType === 'cod' ? 0 : shipping;

                recordData = {
                    ...recordData,
                    customer_id: finalCustomerId,
                    sale_type: 'etc',
                    delivery_method: 'courier',
                    quantity: count,
                    price: totalPrice,
                    shipping_cost: finalShippingCost,
                    packaging_cost: material,
                    address: newClientAddress,
                    postal_code: newClientPostalCode,
                    detail_address: newClientDetailAddress,
                    delivery_note: deliveryNote,
                    latitude: newClientLatitude,
                    longitude: newClientLongitude,
                    is_settled: isSettled,
                    // [사장님 요청 해결] 수령인 이름이 없으면 주문자 이름으로 자동 채움
                    recipient_name: recipientName || newClientName || "수령인미상",
                    recipient_phone: recipientPhone || newClientPhone || null,
                };

                if (!recordData.customer_id) {
                    alert("⚠️ 주문자 정보(돈 내는 사람)를 확인할 수 없습니다. 고객을 다시 선택해주세요.");
                    setSaving(false);
                    return;
                }

                if (recordData.quantity <= 0) {
                    alert("⚠️ 박스 수량은 최소 1개 이상이어야 합니다.");
                    setSaving(false);
                    return;
                }
            } // else (B2C) block end

            console.log("💾 저장 시도 데이터:", recordData);

            // [추가] 데이터 무결성 검사 (NaN 방지)
            if (isNaN(recordData.quantity) || recordData.quantity === undefined) {
                throw new Error("수량(박스/kg)이 올바르지 않습니다. 숫자를 입력해주세요.");
            }
            if (recordData.price !== null && isNaN(recordData.price)) {
                throw new Error("판매 금액이 올바르지 않습니다. 숫자를 입력해주세요.");
            }

            if (editingRecordId) {
                const { error } = await supabase
                    .from('sales_records')
                    .update(recordData)
                    .eq('id', editingRecordId);
                if (error) throw error;
                alert("✅ 판매 기록이 수정되었습니다.");
            } else {
                const { error } = await supabase
                    .from('sales_records')
                    .insert(recordData);
                if (error) throw error;
                alert("✅ 판매 기록이 저장되었습니다.");
            }

            handleCancelEdit();
            fetchHistory();

        } catch (error: any) {
            console.error("🚑 [저장 에러 기록] 🚑", error);

            // [{}] 에러의 정체를 밝히기 위한 3중 속성 추출
            let detailedMsg = "에러 상세 정보를 추출할 수 없습니다.";
            try {
                const props: any = {};
                // 모든 숨겨진 속성까지 강제로 긁어모읍니다.
                Object.getOwnPropertyNames(error).forEach(key => {
                    props[key] = error[key];
                });
                detailedMsg = JSON.stringify(props, null, 2);
            } catch (e) {
                detailedMsg = String(error);
            }

            const errMsg = error?.message || error?.details || error?.hint || detailedMsg;

            if (errMsg.includes('delivery_note') || errMsg.includes('detail_address') || errMsg.includes('column') || errMsg.includes('schema')) {
                setDbError("데이터베이스 구조 문제: '상세 주소'나 '배송 특이사항' 칸을 생성해야 합니다.");
            } else {
                // 사장님께 최고의 정보를 제공 (Object.keys가 []일 때를 대비)
                const techInfo = `
[Error Message]: ${error?.message || "N/A"}
[Details]: ${error?.details || "N/A"}
[Hint]: ${error?.hint || "N/A"}
[JSON]: ${detailedMsg.substring(0, 500)}
[String]: ${String(error)}
`;
                alert(`🚑 장부 저장 실패(정밀 복구팀 보고): \n\n사장님, 아래 내용을 사진 찍어 제게 보여주시면 즉시 해결하겠습니다!\n\n${techInfo} `);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("삭제하시겠습니까?")) return;
        const { error } = await supabase.from('sales_records').delete().eq('id', id);
        if (!error) fetchHistory();
    };

    const filteredHistory = history.filter(item => {
        if (showUnsettledOnly && item.is_settled) return false;
        return true;
    });
    return (
        <div className="min-h-screen pb-24 md:pb-10 bg-gray-50">
            <div className="max-w-2xl mx-auto p-4 space-y-6 animate-in slide-in-from-bottom-2 duration-500">

                {/* DB 오류 알림 및 복구 통합 가이드 (사장님 최우선 처리 영역) */}
                {dbError && (
                    <div className="mb-8 bg-white border-4 border-red-500 p-8 rounded-[2.5rem] shadow-2xl shadow-red-100 animate-in zoom-in-95 duration-500 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 bg-red-500 text-white font-black text-[10px] rounded-bl-2xl">URGENT</div>
                        <div className="space-y-6">
                            <div className="flex items-start gap-4">
                                <div className="p-4 bg-red-100 rounded-2xl text-red-600 animate-pulse">
                                    <AlertTriangle className="w-8 h-8" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-black text-red-900 text-xl tracking-tighter">데이터베이스 긴급 복구가 필요합니다! 🚨</h3>
                                    <p className="text-sm font-bold text-gray-500 leading-relaxed">
                                        새 기능(배송 특이사항, 상세 주소) 도입으로 인해 장부의 구조를 정비해야 합니다.
                                        아래 버튼을 눌러보시고, 혹시 안 된다면 수파베이스에서 실행해 주세요.
                                    </p>
                                </div>
                            </div>

                            <button onClick={handleAutoFix}
                                className="w-full py-5 bg-red-600 text-white rounded-3xl font-black text-lg shadow-xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-3 group">
                                <RefreshCcw className="w-6 h-6 group-hover:rotate-180 transition-all duration-500" />
                                🛠️ 자동 복구 시도하기
                            </button>

                            <div className="bg-gray-900 rounded-3xl p-6 space-y-3 shadow-inner">
                                <div className="flex justify-between items-center">
                                    <p className="text-xs font-black text-pink-400 uppercase tracking-widest">직합 해결용 SQL 스크립트</p>
                                    <span className="text-[10px] text-gray-500 font-bold">Supabase SQL Editor용</span>
                                </div>
                                <pre className="text-[11px] text-gray-300 font-mono leading-relaxed bg-black/30 p-4 rounded-xl border border-white/5 overflow-x-auto select-all">
                                    {`ALTER TABLE public.sales_records 
ADD COLUMN IF NOT EXISTS detail_address TEXT,
    ADD COLUMN IF NOT EXISTS delivery_note TEXT;

ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS detail_address TEXT; `}
                                </pre>
                                <p className="text-[10px] text-white/40 text-center font-bold italic">* 위 코드를 복사해서 수파베이스 SQL Editor에 넣고 [Run] 하시면 100% 해결됩니다.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 헤더 */}
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                        <ShoppingCart className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">판매/출하</h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Sales Manager</p>
                    </div>
                    <div className="ml-auto">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className={`bg-white border rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm
                            ${editingRecordId ? 'border-yellow-400 text-yellow-700 bg-yellow-50' : 'border-gray-200'}`}
                        />
                    </div>
                </div>

                {/* 수정 모드 알림 */}
                {editingRecordId && (
                    <div className="bg-yellow-100 text-yellow-800 px-4 py-3 rounded-xl border border-yellow-200 flex justify-between items-center text-sm font-bold animate-pulse">
                        <span className="flex items-center gap-2"><Edit2 className="w-4 h-4" /> 판매 기록 수정 중...</span>
                        <button onClick={handleCancelEdit} className="bg-white px-3 py-1 rounded-lg border border-yellow-300 text-xs hover:bg-yellow-50">취소</button>
                    </div>
                )}

                {/* 탭 */}
                <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
                    <button onClick={() => setActiveTab('bulk')}
                        disabled={!!editingRecordId && activeTab !== 'bulk'}
                        className={`flex-1 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2
                        ${activeTab === 'bulk' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}
                        ${editingRecordId && activeTab !== 'bulk' ? 'opacity-30 cursor-not-allowed' : ''}`}>
                        <Truck className="w-4 h-4" /> 대량 납품 (B2B)
                    </button>
                    <button onClick={() => setActiveTab('courier')}
                        disabled={!!editingRecordId && activeTab !== 'courier'}
                        className={`flex-1 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2
                        ${activeTab === 'courier' ? 'bg-pink-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}
                        ${editingRecordId && activeTab !== 'courier' ? 'opacity-30 cursor-not-allowed' : ''}`}>
                        <Package className="w-4 h-4" /> 개별 택배 (B2C)
                    </button>
                </div>

                {/* 입력 폼 */}
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden relative">
                    <div className={`h-2 w-full ${activeTab === 'bulk' ? 'bg-indigo-600' : 'bg-pink-600'}`} />

                    <div className="p-6 space-y-6">

                        {activeTab === 'bulk' ? (
                            // B2B 폼 (카드형 개편)
                            <div className="space-y-6 animate-in fade-in">
                                {/* [카드 1] 거래처 선택 */}
                                <div className="bg-gray-50 rounded-[2rem] p-6 border border-gray-100 shadow-inner">
                                    <label className="block text-sm font-black text-indigo-600 mb-4 uppercase tracking-tighter flex items-center gap-1.5">
                                        <Building2 className="w-4 h-4" /> 1. 거래처 선택
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {partners.map(partner => (
                                            <button key={partner.id}
                                                onClick={() => setSelectedClientId(partner.id)}
                                                className={`p-4 rounded-2xl text-xs font-bold border transition-all text-left truncate flex items-center gap-2 shadow-sm
                                                ${selectedClientId === partner.id
                                                        ? 'bg-indigo-600 border-indigo-700 text-white shadow-indigo-100'
                                                        : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'}`}>
                                                <Building2 className={`w-4 h-4 shrink-0 ${selectedClientId === partner.id ? 'opacity-100' : 'opacity-30'}`} />
                                                {partner.company_name}
                                            </button>
                                        ))}
                                    </div>
                                    {!partners.length && <p className="text-xs text-gray-300 mt-2 text-center py-4">등록된 거래처가 없습니다.</p>}
                                </div>

                                {/* [카드 2] 등급별 수량 입력 */}
                                <div className="bg-white rounded-[2rem] p-6 border-2 border-indigo-50 shadow-sm space-y-4">
                                    <label className="block text-sm font-black text-indigo-600 mb-2 uppercase tracking-tighter flex items-center gap-1.5">
                                        <Package className="w-4 h-4" /> 2. 등급별 수량 (박스)
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { id: 'sang', label: '특/상', value: bulkQtySang, setter: setBulkQtySang, color: 'indigo' },
                                            { id: 'jung', label: '중', value: bulkQtyJung, setter: setBulkQtyJung, color: 'green' },
                                            { id: 'ha', label: '하', value: bulkQtyHa, setter: setBulkQtyHa, color: 'gray' }
                                        ].map(item => (
                                            <div key={item.id} className="space-y-2">
                                                <div className={`text - [10px] font - black text - ${item.color} -500 bg - ${item.color} -50 px - 2 py - 1 rounded - lg text - center`}>
                                                    {item.label}
                                                </div>
                                                <input type="number"
                                                    value={item.value} onChange={(e) => item.setter(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl text-center font-black text-lg focus:bg-white focus:border-indigo-500 transition-all outline-none" />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-2 flex justify-between items-center px-2">
                                        <span className="text-xs font-bold text-gray-400">납품 총 합계</span>
                                        <span className="text-xl font-black text-indigo-600">
                                            총 {(Number(bulkQtySang) || 0) + (Number(bulkQtyJung) || 0) + (Number(bulkQtyHa) || 0)}박스
                                        </span>
                                    </div>
                                </div>

                                {/* [카드 3] 결제 정보 및 정산 */}
                                <div className="bg-indigo-50/50 rounded-[2rem] p-6 border border-indigo-100/50 space-y-4">
                                    <label className="block text-sm font-black text-indigo-600 mb-2 uppercase tracking-tighter flex items-center gap-1.5">
                                        <DollarSign className="w-4 h-4" /> 3. 정산 및 금액 설정
                                    </label>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <input type="text"
                                                value={formatCurrency(bulkPrice)}
                                                onChange={(e) => setBulkPrice(stripNonDigits(e.target.value))}
                                                placeholder="오늘 받은 금액 (없으면 0)"
                                                className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl font-black text-indigo-600 placeholder-gray-300 focus:border-indigo-500 shadow-sm outline-none" />
                                        </div>
                                        <button onClick={() => setIsSettled(!isSettled)}
                                            className={`px - 6 rounded - 2xl border - 2 font - black text - xs transition - all shadow - sm
                                                ${isSettled ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-white border-gray-200 text-gray-400'} `}>
                                            {isSettled ? '전액입금' : '미정산'}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-medium px-2 italic">
                                        * 등급별 단가는 결산 페이지에서 나중에 따로 매기실 수도 있습니다.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            // B2C 폼
                            <div className="space-y-6 animate-in fade-in">
                                {/* 주문자(결제자) 및 수령인 영역 */}
                                <div className="bg-gray-50 rounded-[2.5rem] p-6 border border-gray-100 relative shadow-inner space-y-5">
                                    <div className="flex items-start justify-between px-2">
                                        <div className="space-y-1">
                                            <label className="block text-sm font-black text-indigo-600 uppercase tracking-tighter flex items-center gap-1.5">
                                                <CreditCard className="w-4 h-4" /> 1. 주문자 정보
                                            </label>
                                            <p className="text-[10px] text-gray-400 font-bold italic">* 딸기값을 입금하거나 주문을 직접 하신 분입니다.</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <button onClick={() => setIsOrdererLocked(!isOrdererLocked)}
                                                className={`flex items - center gap - 1.5 px - 4 py - 2 rounded - 2xl text - [11px] font - black transition - all border shadow - sm
                                                ${isOrdererLocked ? 'bg-indigo-600 border-indigo-700 text-white shadow-indigo-100' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'} `}>
                                                {isOrdererLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                                {isOrdererLocked ? '주문자 고정됨' : '주문자 고정'}
                                            </button>
                                            <p className="text-[9px] text-indigo-500 font-bold mr-1">한 번에 여러 곳으로 보낼 때 켜두세요!</p>
                                        </div>
                                    </div>

                                    {!selectedSearchResult && !isNewClientMode ? (
                                        <div className="relative group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-pink-500 transition-colors" />
                                            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                                onFocus={() => setIsSearchOpen(true)}
                                                onClick={() => setIsSearchOpen(true)}
                                                placeholder={`고객명 / 번호 검색(총 ${customers.length}명)`}
                                                className="w-full p-5 pl-12 bg-white border-2 border-gray-200 rounded-[1.5rem] text-base font-black outline-none focus:ring-4 focus:ring-pink-100 placeholder:text-gray-400 shadow-sm transition-all" />

                                            {isSearchOpen && searchResult.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] max-h-60 overflow-y-auto">
                                                    {searchResult.map(c => (
                                                        <button key={c.id}
                                                            onMouseDown={(e) => {
                                                                e.preventDefault(); // 입력창 포커스 아웃 방지
                                                                handleSelectClient(c);
                                                            }}
                                                            className="w-full p-4 text-left hover:bg-pink-50 flex items-center justify-between border-b border-gray-50 last:border-0 group transition-all cursor-pointer">
                                                            <div>
                                                                <span className="text-sm font-black text-gray-900 group-hover:text-pink-600 tracking-tight">{c.name}</span>
                                                                <span className="text-xs text-gray-400 ml-2 font-bold">{formatPhone(c.contact || "")}</span>
                                                            </div>
                                                            {c.is_vip && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-lg font-black flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-700" />VIP</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {searchTerm.length > 0 && searchResult.length === 0 && (
                                                <button onClick={() => setIsNewClientMode(true)}
                                                    className="mt-3 w-full py-3 bg-pink-100 text-pink-600 rounded-xl text-xs font-black hover:bg-pink-200 transition-colors flex items-center justify-center gap-2">
                                                    <UserPlus className="w-4 h-4" /> 새로운 고객 정보 입력하기
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4 animate-in zoom-in-95 duration-300">
                                            {/* 선택된 고객 카드 - 더 콤팩트하게 */}
                                            <div className="bg-white px-4 py-3 rounded-2xl border border-gray-100 flex flex-col gap-3 shadow-sm overflow-hidden">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center shadow-inner shrink-0 focus-within:ring-2 ring-pink-200">
                                                            <User className="w-5 h-5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            {isNewClientMode ? (
                                                                <div className="space-y-2">
                                                                    <input type="text" placeholder="고객 성함" value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                                                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-black outline-none focus:border-pink-400" />
                                                                    <input type="text" placeholder="연락처 (010-0000-0000)" value={newClientPhone} onChange={(e) => setNewClientPhone(formatPhone(e.target.value))}
                                                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-pink-400" />
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <p className="text-sm font-black text-gray-900 truncate tracking-tight">{newClientName}</p>
                                                                    <p className="text-[10px] font-bold text-gray-400">{formatPhone(newClientPhone)}</p>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {!isOrdererLocked && (
                                                        <button onClick={handleResetClient} className="p-2 text-gray-300 hover:text-red-500 rounded-lg transition-all shrink-0">
                                                            <RotateCcw className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* 구매 인사이트 실시간 요약 (Standardization 8번 준수: 모든 데이터 가시성 확보) */}
                                                {customerStats && (
                                                    <div className="flex items-center gap-1.5 pt-2 border-t border-gray-50 overflow-x-auto no-scrollbar">
                                                        <div className="px-2 py-1 bg-indigo-50 rounded-lg shrink-0">
                                                            <span className="text-[9px] font-black text-indigo-400 uppercase leading-none block mb-0.5">누적 주문</span>
                                                            <span className="text-[11px] font-black text-indigo-600">{customerStats.count}회</span>
                                                        </div>
                                                        <div className="px-2 py-1 bg-green-50 rounded-lg shrink-0">
                                                            <span className="text-[9px] font-black text-green-400 uppercase leading-none block mb-0.5">총 수량</span>
                                                            <span className="text-[11px] font-black text-green-600">{customerStats.total_qty.toFixed(1)}</span>
                                                        </div>
                                                        <div className="px-2 py-1 bg-amber-50 rounded-lg shrink-0">
                                                            <span className="text-[9px] font-black text-amber-400 uppercase leading-none block mb-0.5">누적 결제액</span>
                                                            <span className="text-[11px] font-black text-amber-600">{(customerStats.total_price || 0).toLocaleString()}원</span>
                                                        </div>
                                                        {customerStats.count >= 5 && (
                                                            <div className="px-2 py-1 bg-pink-50 border border-pink-100 rounded-lg shrink-0 animate-pulse">
                                                                <span className="text-[10px] font-black text-pink-500">💎 VIP 고객</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 수령인 상세 정보 및 배송지 (지능형 영역) */}
                                            <div className="bg-white p-6 rounded-[2rem] border-2 border-pink-200/50 shadow-xl shadow-pink-50 space-y-5 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                                    <Truck className="w-12 h-12 text-pink-500" />
                                                </div>

                                                <div className="flex items-center justify-between relative z-10">
                                                    <label className="text-[11px] font-black text-pink-600 uppercase tracking-widest flex items-center gap-2">
                                                        <Truck className="w-4 h-4 fill-pink-600 animate-pulse" /> 2. 받는 사람 정보 (딸기 받는 곳)
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setRecipientName(newClientName);
                                                                setRecipientPhone(newClientPhone);
                                                                setNewClientAddress(newClientAddress);
                                                                setNewClientPostalCode(newClientPostalCode);
                                                                setNewClientLatitude(newClientLatitude);
                                                                setNewClientLongitude(newClientLongitude);
                                                            }}
                                                            className="text-[10px] font-black bg-pink-50 text-pink-600 px-3 py-1.5 rounded-lg border border-pink-100 hover:bg-pink-100 transition-colors"
                                                        >
                                                            주문자와 동일
                                                        </button>
                                                        {recentAddresses.length > 0 && (
                                                            <span className="text-[10px] font-black text-gray-300">최근 배송지 {recentAddresses.length}건</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 최근 배송지 스마트 칩 */}
                                                {recentAddresses.length > 0 && (
                                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar -mx-2 px-2 relative z-10">
                                                        {recentAddresses.map((set, idx) => (
                                                            <button key={idx}
                                                                onClick={() => {
                                                                    setRecipientName(set.recipient_name);
                                                                    setRecipientPhone(set.recipient_phone);
                                                                    setNewClientAddress(set.address);
                                                                    setNewClientPostalCode(set.postal_code);
                                                                    setNewClientDetailAddress(set.detail_address || "");
                                                                    setDeliveryNote(set.delivery_note || "");
                                                                    setIsAddressManualMode(false);
                                                                }}
                                                                className="shrink-0 bg-pink-50 border border-pink-100 px-4 py-3 rounded-2xl shadow-sm hover:bg-pink-100 hover:border-pink-300 transition-all text-left max-w-[160px] group">
                                                                <p className="text-xs font-black text-pink-700 truncate group-hover:text-pink-800">{set.recipient_name || '수령인명 없음'}</p>
                                                                <p className="text-[10px] text-pink-400 font-bold truncate mt-0.5">{set.address.split(' ').slice(0, 2).join(' ')}...</p>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 relative z-10">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-black text-gray-400 ml-1 uppercase">받으실 분 성함/업체</label>
                                                        <input type="text" placeholder="성함 또는 업체명" value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                                                            className="w-full px-3 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-[14px] font-black outline-none focus:bg-white focus:border-pink-400 shadow-sm transition-all" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-black text-gray-400 ml-1 uppercase">수령인 연락처</label>
                                                        <input type="text" placeholder="010-0000-0000" value={recipientPhone} onChange={(e) => setRecipientPhone(formatPhone(e.target.value))}
                                                            className="w-full px-3 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-[14px] font-black outline-none focus:bg-white focus:border-pink-400 shadow-sm transition-all" />
                                                    </div>
                                                </div>

                                                <div className="space-y-3 relative z-10">
                                                    <div className="flex justify-between items-center px-1">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">배송지 주소 (상세 주소 포함)</label>
                                                        <button onClick={() => setIsAddressManualMode(!isAddressManualMode)}
                                                            className={`text - [10px] font - black px - 4 py - 2 rounded - xl transition - all border flex items - center gap - 2 shadow - sm
                                                            ${isAddressManualMode ? 'bg-pink-600 border-pink-700 text-white' : 'bg-white border-pink-200 text-pink-600 hover:bg-pink-50'} `}>
                                                            {isAddressManualMode ? <Search className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                                                            {isAddressManualMode ? '검색창 활성화됨' : '다른 주소로 배송 (변경)'}
                                                        </button>
                                                    </div>

                                                    {/* 주소 입력창 - 가로로 길게 단독 배치 */}
                                                    <div className="w-full">
                                                        <AddressSearch
                                                            label=""
                                                            value={newClientAddress}
                                                            onChange={(val) => setNewClientAddress(val)}
                                                            onAddressSelect={(res) => {
                                                                setNewClientAddress(res.address);
                                                                setNewClientPostalCode(res.zonecode);
                                                                setNewClientLatitude(res.latitude || null);
                                                                setNewClientLongitude(res.longitude || null);
                                                            }}
                                                            placeholder="변경 버튼을 눌러 정확한 주소를 검색하세요"
                                                            className={!isAddressManualMode ? "opacity-60 pointer-events-none grayscale border-gray-200" : "border-pink-500 shadow-xl ring-4 ring-pink-50"}
                                                        />
                                                    </div>

                                                    {/* 우편번호 - 하단에 별도 배치 */}
                                                    <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                                                        <div className="flex-[2] space-y-1">
                                                            <label className="text-[9px] font-black text-gray-400 ml-1 uppercase">상세 주소 (동, 호수, 사무실 등)</label>
                                                            <input type="text" placeholder="예) 상현빌라 201호 / 1002동 122호" value={newClientDetailAddress} onChange={(e) => setNewClientDetailAddress(e.target.value)}
                                                                className="w-full px-3 py-3 bg-white border-2 border-pink-100 rounded-xl text-[14px] font-black outline-none focus:border-pink-400 shadow-sm transition-all placeholder:text-gray-300" />
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <label className="text-[9px] font-black text-gray-400 ml-1 uppercase">우편번호</label>
                                                            <div className="h-[48px] bg-gray-100 border border-gray-200 rounded-xl flex items-center justify-center px-4 shadow-inner">
                                                                <input type="text" value={newClientPostalCode} readOnly
                                                                    className="bg-transparent text-center text-[13px] font-black text-gray-500 outline-none w-full" placeholder="-" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 배송 특이사항 - 사장님 요청 (Standardization 7번 준수: 모든 요청사항 명시화) */}
                                                    <div className="space-y-1 relative z-10">
                                                        <label className="text-[9px] font-black text-amber-500 ml-1 uppercase flex items-center gap-1">
                                                            <AlignLeft className="w-3 h-3" /> 배송 특이사항 (기사님 전달용)
                                                        </label>
                                                        <input type="text" placeholder="예) 아기가 자고 있으니 벨 누르지 마세요 / 고양이 주의" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)}
                                                            className="w-full px-4 py-3 bg-amber-50/30 border-2 border-amber-100 rounded-xl text-[14px] font-black text-amber-900 outline-none focus:bg-white focus:border-amber-400 shadow-sm transition-all placeholder:text-amber-200" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 가격 및 비용 설정 영역 */}
                                <div className="space-y-5">
                                    <div className="space-y-3">
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">결제 및 배송비 설정</label>
                                        <div className="flex bg-gray-100 p-1.5 rounded-[1.5rem] shadow-inner">
                                            <button onClick={() => setShippingPaymentType('prepaid')}
                                                className={`flex - 1 py - 4 text - sm font - black rounded - 2xl transition - all ${shippingPaymentType === 'prepaid' ? 'bg-white text-gray-900 shadow-md ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'} `}>
                                                판매자 부담 (선불)
                                            </button>
                                            <button onClick={() => setShippingPaymentType('cod')}
                                                className={`flex - 1 py - 4 text - sm font - black rounded - 2xl transition - all ${shippingPaymentType === 'cod' ? 'bg-white text-gray-900 shadow-md ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'} `}>
                                                고객 부담 (착불)
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-xs font-black text-gray-400 ml-1 uppercase">박스 수량 (BOX)</label>
                                            <div className="relative">
                                                <input type="number" value={courierBoxCount} onChange={(e) => setCourierBoxCount(e.target.value)}
                                                    className="w-full p-5 bg-white border-2 border-gray-200 rounded-[1.25rem] text-xl font-black focus:border-pink-500 outline-none shadow-sm transition-all" placeholder="1" />
                                                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-300">박스</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-xs font-black text-gray-400 ml-1 uppercase">판매 총액 (원)</label>
                                            <div className="relative">
                                                <input type="text" value={formatCurrency(courierTotalPrice)}
                                                    onChange={(e) => setCourierTotalPrice(stripNonDigits(e.target.value))}
                                                    className="w-full p-5 bg-white border-2 border-gray-200 rounded-[1.25rem] text-xl font-black focus:border-pink-500 outline-none shadow-sm text-right transition-all" placeholder="0원" />
                                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg font-black text-gray-300">₩</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 상세 비용 아코디언 */}
                                    <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                                        <button onClick={() => setShowCostDetails(!showCostDetails)}
                                            className="w-full flex justify-between items-center p-4 bg-gray-50/50 hover:bg-gray-100 transition-colors">
                                            <span className="text-xs font-black text-gray-600 flex items-center gap-2">
                                                <Settings className="w-4 h-4 text-gray-400" /> 비용 상세 설정 (고급 사용자용)
                                            </span>
                                            <div className="flex items-center gap-2 opacity-40">
                                                <span className="text-[10px] font-bold uppercase tracking-widest">{showCostDetails ? 'CLOSE' : 'OPEN'}</span>
                                                <ChevronRight className={`w - 4 h - 4 transition - transform ${showCostDetails ? 'rotate-90' : ''} `} />
                                            </div>
                                        </button>

                                        {showCostDetails && (
                                            <div className="p-6 space-y-5 animate-in slide-in-from-top-4 duration-300 border-t border-gray-50">
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div className="space-y-3">
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">박스당 기준 단가</label>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between bg-gray-50/80 p-3 rounded-2xl shadow-inner">
                                                                <span className="text-xs font-bold text-gray-500">배송비</span>
                                                                <div className="flex items-center gap-1">
                                                                    <input type="text" value={formatCurrency(unitShippingCost)}
                                                                        onChange={(e) => setUnitShippingCost(stripNonDigits(e.target.value))}
                                                                        className="w-24 bg-transparent text-right text-sm font-black outline-none text-indigo-600" />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between bg-gray-50/80 p-3 rounded-2xl shadow-inner">
                                                                <span className="text-xs font-bold text-gray-500">자재비</span>
                                                                <div className="flex items-center gap-1">
                                                                    <input type="text" value={formatCurrency(unitMaterialCost)}
                                                                        onChange={(e) => setUnitMaterialCost(stripNonDigits(e.target.value))}
                                                                        className="w-24 bg-transparent text-right text-sm font-black outline-none text-pink-600" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="border-l-2 border-gray-50 pl-6 space-y-3">
                                                        <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">최종 지출 합계 (수정가능)</label>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between p-1">
                                                                <span className={`text-xs font-bold ${shippingPaymentType === 'cod' ? 'text-gray-300 line-through italic' : 'text-gray-500'} `}>총 배송비</span>
                                                                <input type="text" value={formatCurrency(totalShippingCost)}
                                                                    onChange={(e) => setTotalShippingCost(stripNonDigits(e.target.value))}
                                                                    disabled={shippingPaymentType === 'cod'}
                                                                    className={`w-32 border-b-2 border-gray-100 focus:border-indigo-500 text-right text-base font-black outline-none transition-all ${shippingPaymentType === 'cod' ? 'text-gray-300 bg-transparent' : 'text-indigo-600'} `} />
                                                            </div>
                                                            <div className="flex items-center justify-between p-1">
                                                                <span className="text-xs font-bold text-gray-500">총 자재비</span>
                                                                <input type="text" value={formatCurrency(totalMaterialCost)}
                                                                    onChange={(e) => setTotalMaterialCost(stripNonDigits(e.target.value))}
                                                                    className="w-32 border-b-2 border-gray-100 focus:border-pink-500 text-right text-base font-black outline-none transition-all text-pink-600" />
                                                            </div>
                                                        </div>
                                                        {shippingPaymentType === 'cod' && (
                                                            <div className="mt-4 p-2 bg-amber-50 rounded-lg flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></div>
                                                                <p className="text-[9px] font-bold text-amber-700">착불 설정으로 인해 배송비가 0원 처리되었습니다.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {!showCostDetails && (
                                            <div className="px-5 py-3 bg-gray-50/50 flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                                                <div className="flex gap-3">
                                                    <span className="text-gray-400">지출 합계:</span>
                                                    <span className="text-gray-900">{formatCurrency(totalShippingCost + totalMaterialCost)}</span>
                                                </div>
                                                <span className="text-indigo-500 animate-bounce-horizontal">Edit Detail →</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 실시간 이익 분석기 (슈퍼 프리미엄 디자인) */}
                                    {courierBoxCount && courierTotalPrice && (
                                        <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
                                            {/* 배경 데코레이션 */}
                                            <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-pink-500 rounded-full blur-[80px] opacity-20"></div>
                                            <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-indigo-500 rounded-full blur-[80px] opacity-20"></div>

                                            <div className="relative z-10 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-white/10 rounded-xl">
                                                            <Calculator className="w-5 h-5 text-pink-400" />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-black tracking-tight">순수익 시뮬레이션</h4>
                                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Estimated Net Profit</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text - [10px] font - black px - 2.5 py - 1 rounded - full border border - white / 10 bg - white / 5 ${shippingPaymentType === 'prepaid' ? 'text-indigo-400' : 'text-amber-400'} `}>
                                                            {shippingPaymentType === 'prepaid' ? '선불 결제 적용' : '착불 결제 적용'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="h-px bg-white/5 w-full"></div>

                                                <div className="flex justify-between items-end">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                                            판매 총액: {formatCurrency(courierTotalPrice)}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                                                            예상 지출: -{formatCurrency(totalShippingCost + totalMaterialCost)}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-gray-500 uppercase tracking-tighter leading-none mb-1">Final Profit</p>
                                                        <p className="text-4xl font-black text-white tracking-tighter tabular-nums drop-shadow-lg shadow-pink-500/50">
                                                            {formatCurrency(calculateProfit())}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 버튼 영역 */}

                        <div className="px-6 pb-8">
                            <button onClick={handleSave} disabled={saving}
                                className={`w - full py - 4 rounded - xl text - lg font - bold text - white shadow - xl transition - all active: scale - 95 flex items - center justify - center gap - 2
                            ${activeTab === 'bulk'
                                        ? (editingRecordId ? 'bg-indigo-500 shadow-indigo-100' : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700')
                                        : (editingRecordId ? 'bg-pink-500 shadow-pink-100' : 'bg-pink-600 shadow-pink-200 hover:bg-pink-700')
                                    } `}>
                                {saving ? (
                                    <span className="animate-pulse">저장 중...</span>
                                ) : (
                                    <>
                                        <Check className="w-5 h-5" strokeWidth={3} />
                                        {editingRecordId ? '수정 내용 저장' : (activeTab === 'bulk' ? '납품 기록 저장' : '택배 주문 저장')}
                                    </>
                                )}
                            </button>

                            {editingRecordId && (
                                <button onClick={handleCancelEdit} className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors">
                                    수정 취소 (새 입력으로 돌아가기)
                                </button>
                            )}

                        </div>
                    </div>
                </div>


                {/* 최근 판매 기록 */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                            <History className="w-6 h-6 text-gray-400" />
                            {activeTab === 'bulk' && selectedClientId
                                ? `${partners.find(p => p.id === selectedClientId)?.company_name || '거래처'} 최근 기록`
                                : '최근 통합 판매 기록'}
                        </h2>
                        <button
                            onClick={() => setShowUnsettledOnly(!showUnsettledOnly)}
                            className={`text - [9px] font - black px - 2.5 py - 1 rounded - full transition - all border
                                ${showUnsettledOnly
                                    ? 'bg-amber-600 border-amber-700 text-white shadow-lg shadow-amber-100'
                                    : 'bg-white border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600'
                                } `}
                        >
                            {showUnsettledOnly ? '⚠️ 미정산만 보기' : '전체 내역 보기'}
                        </button>
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <p className="text-center text-xs text-gray-400 py-10">로딩 중...</p>
                        ) : history
                            .filter(item => {
                                // [1] 미정산 필터링 (공통)
                                if (showUnsettledOnly && item.is_settled) return false;

                                // [2] 탭별/상황별 필터링
                                if (activeTab === 'bulk') {
                                    // 대량납품 탭: 농협/B2B 거래만 표시
                                    if (!settlementService.isB2B(item)) return false;
                                    // 특정 거래처가 선택된 경우 해당 거래처만 표시
                                    if (selectedClientId && item.partner_id !== selectedClientId) return false;
                                } else {
                                    // 개별택배 탭: 개별 판매(etc) 및 택배 거래만 표시
                                    if (!settlementService.isB2C(item)) return false;
                                    // 특정 고객이 선택된 경우 해당 고객만 표시
                                    if (selectedSearchResult && item.customer_id !== selectedSearchResult.id) return false;
                                }
                                return true;
                            })
                            .length === 0 ? (
                            <p className="text-center text-xs text-gray-400 py-10">기록이 없습니다.</p>
                        ) : history
                            .filter(item => {
                                // [1] 미정산 필터링 (공통)
                                if (showUnsettledOnly && item.is_settled) return false;

                                // [2] 탭별/상황별 필터링
                                if (activeTab === 'bulk') {
                                    // 대량납품 탭: 농협/B2B 거래만 표시
                                    if (!settlementService.isB2B(item)) return false;
                                    // 특정 거래처가 선택된 경우 해당 거래처만 표시
                                    if (selectedClientId && item.partner_id !== selectedClientId) return false;
                                } else {
                                    // 개별택배 탭: 개별 판매(etc) 및 택배 거래만 표시
                                    if (!settlementService.isB2C(item)) return false;
                                    // 특정 고객이 선택된 경우 해당 고객만 표시
                                    if (selectedSearchResult && item.customer_id !== selectedSearchResult.id) return false;
                                }
                                return true;
                            })
                            .map(item => (
                                <div key={item.id} className={`bg - white p - 4 rounded - 2xl border shadow - sm flex justify - between items - center transition - all
                                ${editingRecordId === item.id ? 'border-yellow-400 ring-2 ring-yellow-100 bg-yellow-50' : 'border-gray-100'} `}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w - 10 h - 10 rounded - xl flex items - center justify - center border
                                        ${settlementService.isB2B(item) ? 'bg-indigo-50 border-indigo-100 text-indigo-500' : 'bg-pink-50 border-pink-100 text-pink-500'} `}>
                                            {settlementService.isB2B(item) ? <Truck className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className="text-sm font-black text-gray-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                                                    {item.partner?.company_name || item.customer?.name || item.customer_name || "미지정"}
                                                    {item.delivery_method === 'courier' && item.recipient_name && (
                                                        <span className="text-[10px] text-pink-500 font-bold bg-pink-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                            <ChevronRight className="w-2 h-2" /> {item.recipient_name}
                                                        </span>
                                                    )}
                                                </p>
                                                {(() => {
                                                    const status = settlementService.getSettlementStatus(item);
                                                    return (
                                                        <button
                                                            onClick={async () => {
                                                                if (!confirm(`'${item.partner?.company_name || item.customer?.name || item.customer_name}' 정산 상태를 변경하시겠습니까 ? `)) return;
                                                                const { error } = await supabase.from('sales_records').update({ is_settled: !item.is_settled }).eq('id', item.id);
                                                                if (error) alert("상태 변경 실패: " + error.message);
                                                            }}
                                                            className={`text - [9px] font - black px - 2 py - 0.5 rounded - lg border transition - all active: scale - 95
                                                            ${status.color === 'green' ? 'bg-green-50 text-green-600 border-green-200' :
                                                                    status.color === 'blue' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                                        status.color === 'amber' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                                            status.color === 'red' ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' :
                                                                                'bg-pink-50 text-pink-600 border-pink-200'
                                                                } `}
                                                        >
                                                            {status.label}
                                                        </button>
                                                    );
                                                })()}
                                            </div>
                                            <div className="flex flex-col gap-0.5 mt-0.5">
                                                <p className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                                                    <span className="text-gray-600">{item.quantity}박스</span>
                                                    {item.grade && (
                                                        <span className={`text - [9px] px - 1 rounded - md font - black
                                                            ${item.grade === '특' ? 'bg-indigo-50 text-indigo-500' :
                                                                item.grade === '상' ? 'bg-green-50 text-green-500' :
                                                                    'bg-gray-100 text-gray-400'
                                                            } `}>
                                                            {item.grade}
                                                        </span>
                                                    )}
                                                    {item.price ? ` · ${formatCurrency(item.price)} ` : <span className="text-red-400"> · 가격 미정</span>}
                                                    {item.delivery_method === 'courier' && item.shipping_cost === 0 && <span className="text-pink-500">(착불)</span>}
                                                    · <span className="opacity-60">{new Date(item.recorded_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
                                                </p>
                                                {item.harvest_note && (
                                                    <p className="text-[10px] text-gray-400 italic flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md self-start border border-gray-100/50 mt-1">
                                                        <AlignLeft className="w-2.5 h-2.5" /> {item.harvest_note}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleEdit(item)}
                                            className={`p - 2 rounded - lg transition - colors ${editingRecordId === item.id ? 'text-yellow-600 bg-yellow-200' : 'text-gray-300 hover:text-indigo-500 hover:bg-indigo-50'} `}>
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

            </div>

        </div>
    );
}
