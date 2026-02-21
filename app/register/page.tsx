"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Sprout, CheckCircle } from "lucide-react";
import AddressSearch from "@/components/AddressSearch";
import { formatPhone, formatBusinessNumber } from "@/lib/utils";

export default function RegisterPage() {
    const [step, setStep] = useState<'form' | 'done'>('form');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [form, setForm] = useState({
        email: "",
        password: "",
        passwordConfirm: "",
        full_name: "",
        farm_name: "",
        phone: "",
        address: "",
        postal_code: "",
        business_number: "",
        notes: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (form.password !== form.passwordConfirm) {
            setError("비밀번호가 일치하지 않습니다.");
            return;
        }
        if (form.password.length < 6) {
            setError("비밀번호는 6자 이상이어야 합니다.");
            return;
        }

        setLoading(true);

        // 1. 계정 생성
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: form.email,
            password: form.password,
            options: { data: { full_name: form.full_name } },
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        // 2. 농장 정보 저장 (is_active = false, 관리자 승인 대기)
        if (authData.user) {
            await supabase.from('farms').insert({
                owner_id: authData.user.id,
                farm_name: form.farm_name,
                phone: form.phone || null,
                address: form.address || null,
                postal_code: form.postal_code || null,
                business_number: form.business_number || null,
                notes: form.notes || null,
                is_active: false, // 무조건 비활성 상태로 시작
            });
        }

        setLoading(false);
        setStep('done');
    };

    if (step === 'done') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-green-50 flex items-center justify-center p-4">
                <div className="w-full max-w-md text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">신청 완료!</h1>
                    <p className="text-gray-500 mb-6">
                        농장 등록 신청이 완료되었습니다.<br />
                        관리자 승인 후 로그인이 가능합니다.
                    </p>
                    <a href="/login" className="inline-block bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors">
                        로그인 페이지로
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-green-50 flex items-center justify-center p-4 py-12">
            <div className="w-full max-w-lg">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-4">
                        <Sprout className="w-8 h-8 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">농장 등록 신청</h1>
                    <p className="text-gray-500 mt-1 text-sm">관리자 승인 후 사용 가능합니다</p>
                </div>

                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* 계정 정보 */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">계정 정보</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                                    <input name="full_name" type="text" value={form.full_name} onChange={handleChange} required
                                        placeholder="홍길동"
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">이메일 *</label>
                                    <input name="email" type="email" value={form.email} onChange={handleChange} required
                                        placeholder="farm@example.com"
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 *</label>
                                        <input name="password" type="password" value={form.password} onChange={handleChange} required
                                            placeholder="6자 이상"
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인 *</label>
                                        <input name="passwordConfirm" type="password" value={form.passwordConfirm} onChange={handleChange} required
                                            placeholder="재입력"
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 농장 정보 */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">농장 정보</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">농장 이름 *</label>
                                    <input name="farm_name" type="text" value={form.farm_name} onChange={handleChange} required
                                        placeholder="예: 행복 딸기농장"
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
                                        <input name="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                                            placeholder="010-0000-0000"
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">사업자번호</label>
                                        <input name="business_number" type="text" value={form.business_number} onChange={(e) => setForm({ ...form, business_number: formatBusinessNumber(e.target.value) })}
                                            placeholder="000-00-00000"
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-12 gap-3 items-end">
                                    <div className="col-span-9">
                                        <AddressSearch
                                            label="농장 주소"
                                            value={form.address}
                                            onChange={(val) => setForm({ ...form, address: val })}
                                            onAddressSelect={(res) => setForm({
                                                ...form,
                                                address: res.address,
                                                postal_code: res.zonecode
                                            })}
                                            placeholder="농장 위치를 검색하거나 입력하세요"
                                        />
                                    </div>
                                    <div className="col-span-3 space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight ml-1">우편번호</label>
                                        <input type="text" value={form.postal_code}
                                            onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-center font-bold text-sm" placeholder="00000" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">특이사항</label>
                                    <textarea name="notes" value={form.notes} onChange={handleChange}
                                        placeholder="기타 전달 사항"
                                        rows={2}
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all resize-none font-medium" />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={loading}
                            className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-base hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50">
                            {loading ? "신청 중..." : "농장 등록 신청하기"}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                        <p className="text-sm text-gray-500">
                            이미 계정이 있으신가요?{" "}
                            <a href="/login" className="text-red-600 font-medium hover:underline">로그인</a>
                        </p>
                    </div>
                </div>
            </div >
        </div >
    );
}
