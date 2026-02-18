"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

export default function SalesPage() {
    const [activeTab, setActiveTab] = useState<'nonghyup' | 'jam' | 'etc'>('nonghyup');
    const [quantity, setQuantity] = useState("");
    const [price, setPrice] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [address, setAddress] = useState("");

    const handleSave = () => {
        // TODO: Supabase integration
        let summary = "";
        if (activeTab === 'nonghyup') {
            summary = `[농협] ${quantity}박스 출하`;
        } else if (activeTab === 'jam') {
            summary = `[잼용] ${quantity}kg 처리`;
        } else {
            summary = `[${customerName}]님께 ${quantity}박스 택배 접수`;
        }
        alert(`[저장 완료]\n${summary} 저장되었습니다.`);

        // Reset
        setQuantity("");
        setPrice("");
        setCustomerName("");
        setAddress("");
    };

    return (
        <main className="min-h-screen bg-gray-50 pb-20">
            <header className="bg-white p-4 shadow-sm flex items-center justify-center sticky top-0 z-10">
                <h1 className="text-xl font-bold text-gray-900">판매/출하 기록</h1>
            </header>

            {/* Tabs */}
            <div className="flex bg-white border-b border-gray-200">
                {[
                    { id: 'nonghyup', label: '농협 출하' },
                    { id: 'jam', label: '잼 가공' },
                    { id: 'etc', label: '택배/기타' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 py-4 text-center font-bold text-lg border-b-2 transition-colors
              ${activeTab === tab.id
                                ? 'border-green-500 text-green-700 bg-green-50'
                                : 'border-transparent text-gray-500 hover:bg-gray-50'}
            `}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="p-6 space-y-6">
                {/* Input Fields based on Tab */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">

                    {/* Common Quantity/Weight Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {activeTab === 'jam' ? '중량 (kg)' : '수량 (박스)'}
                        </label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            placeholder="0"
                            className="w-full text-2xl font-bold p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                        />
                    </div>

                    {/* Conditional Fields */}
                    {activeTab === 'etc' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">주문자 이름</label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    placeholder="홍길동"
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">배송지 주소</label>
                                <textarea
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="상세 주소를 입력하세요"
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none h-24 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">판매 금액 (원)</label>
                                <input
                                    type="number"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="0"
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                                />
                            </div>
                        </>
                    )}

                    {activeTab === 'nonghyup' && (
                        <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-700">
                            💡 농협 정산 금액은 추후 정산서를 보고 입력할 수 있습니다. 지금은 수량만 기록하세요.
                        </div>
                    )}
                </div>

                <button
                    onClick={handleSave}
                    className="w-full bg-green-600 text-white py-5 rounded-2xl text-xl font-bold shadow-lg hover:bg-green-700 active:transform active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Save className="w-6 h-6" />
                    {activeTab === 'etc' ? '주문 접수' : '출하 기록'}
                </button>
            </div>
        </main>
    );
}
