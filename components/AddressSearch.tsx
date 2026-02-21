"use client";

import React, { useState } from 'react';
import DaumPostcode, { Address } from 'react-daum-postcode';
import { MapPin, Search, X } from 'lucide-react';

interface AddressResult {
    zonecode: string;
    address: string;
    buildingName: string;
    latitude?: number | null;
    longitude?: number | null;
}

interface AddressSearchProps {
    label: string;
    value: string;
    onChange: (address: string) => void;
    onAddressSelect?: (result: AddressResult) => void; // 상세 정보(우편번호 등) 전달용
    placeholder?: string;
    className?: string;
}

/**
 * [bkit 표준 주소 검색 모듈] 🍓
 * 시나리오 C(지능형 자산형)를 지원하는 범용 컴포넌트입니다.
 * 우편번호와 건물명을 포함한 정밀 데이터를 반환하며, 향후 위도/경도 확장이 용이한 구조입니다.
 */
const AddressSearch: React.FC<AddressSearchProps> = ({
    label,
    value,
    onChange,
    onAddressSelect,
    placeholder = "주소를 입력하거나 검색하세요",
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleComplete = (data: Address) => {
        let fullAddress = data.address;
        let extraAddress = '';

        if (data.addressType === 'R') {
            if (data.bname !== '') {
                extraAddress += data.bname;
            }
            if (data.buildingName !== '') {
                extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
            }
            fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
        }

        // 1. 기본 주소 필드 업데이트
        onChange(fullAddress);

        // 2. 우편번호 등 상세 메타데이터 전달 (시나리오 C의 핵심)
        if (onAddressSelect) {
            onAddressSelect({
                zonecode: data.zonecode,
                address: fullAddress,
                buildingName: data.buildingName
            });
        }

        setIsOpen(false);
    };

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex justify-between items-end ml-1">
                <label className="text-xs font-black text-gray-400 uppercase tracking-tight flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> {label}
                </label>
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-1.5 text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-all border border-indigo-100 shadow-sm"
                >
                    <Search className="w-3 h-3" /> 주소 검색
                </button>
            </div>

            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={2}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 shadow-sm rounded-2xl text-sm font-black focus:bg-white focus:border-indigo-600 outline-none transition-all placeholder:text-gray-300 resize-none min-h-[4.5rem] leading-relaxed"
            />

            {/* 카카오 주소 검색 모달 */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                            <h3 className="text-lg font-black text-gray-900">정확한 주소 찾기</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-all"
                            >
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>
                        <div className="h-[450px]">
                            <DaumPostcode
                                onComplete={handleComplete}
                                style={{ height: '100%', width: '100%' }}
                            />
                        </div>
                        <div className="p-4 bg-gray-50 text-[10px] text-center text-gray-400 font-bold uppercase tracking-widest">
                            Kakao Postcode Service Connected
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddressSearch;
