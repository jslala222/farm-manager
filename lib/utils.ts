/**
 * bkit 표준 데이터 포맷팅 유틸리티
 */

/**
 * 전화번호를 000-0000-0000 형식으로 변환합니다.
 */
/**
 * 지능형 전화번호 포맷터 (서울 02, 지역번호 및 휴대폰 완벽 대응)
 */
export const formatPhone = (value: string): string => {
    const digits = value.replace(/[^\d]/g, "");
    if (digits.length <= 2) return digits;

    // 서울(02) 체크
    if (digits.startsWith("02")) {
        if (digits.length <= 2) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
        if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
        return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
    }

    // 일반 지역번호/휴대폰 (010, 031, 041, 070 등)
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
};

/**
 * 사업자등록번호 포맷터 (000-00-00000)
 */
export const formatBusinessNumber = (value: string): string => {
    const digits = value.replace(/[^\d]/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 10)}`;
};

/**
 * 숫자를 천 단위 콤마와 '원' 접미사가 붙은 형식으로 변환합니다.
 */
export const formatCurrency = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === "") return "0원";
    const num = typeof value === "string" ? parseInt(value.replace(/[^\d]/g, ""), 10) : value;
    if (isNaN(num)) return "0원";
    return `${num.toLocaleString()}원`;
};

/**
 * 숫자만 추출하여 문자열로 반환 (입력값 정제용)
 */
export const stripNonDigits = (value: string): string => {
    return value.replace(/[^\d]/g, "");
};
