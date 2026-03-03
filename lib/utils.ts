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
/**
 * ============================================
 * 한국 시간대(KST, UTC+9) 관련 유틸리티
 * ============================================
 */

/**
 * UTC 또는 현재 시간을 한국 시간으로 변환
 * @param date - 변환할 Date 객체 (기본값: 현재 시간)
 * @returns 한국 시간 Date 객체
 */
export const toKSTDate = (date: Date = new Date()): Date => {
    return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
};

/**
 * 현재 한국 시간 가져오기
 * @returns 한국 시간 Date 객체
 */
export const getNowKST = (): Date => {
    return toKSTDate();
};

/**
 * 한국 시간을 ISO 문자열로 변환 (날짜 부분만)
 * @param date - 변환할 Date 객체 (기본값: 현재 시간)
 * @returns YYYY-MM-DD 형식
 */
export const toKSTDateString = (date: Date = new Date()): string => {
    const kst = toKSTDate(date);
    return kst.toISOString().split('T')[0];
};

/**
 * 한국 시간을 포맷하여 문자열로 반환
 * @param date - 변환할 Date 객체 (기본값: 현재 시간)
 * @param format - 날짜 형식 (기본값: 'YYYY-MM-DD HH:mm:ss')
 * @returns 포맷된 문자열
 */
export const formatKSTDate = (date: Date = new Date(), format: string = 'YYYY-MM-DD HH:mm:ss'): string => {
    const kst = toKSTDate(date);
    const y = kst.getFullYear();
    const m = String(kst.getMonth() + 1).padStart(2, '0');
    const d = String(kst.getDate()).padStart(2, '0');
    const h = String(kst.getHours()).padStart(2, '0');
    const min = String(kst.getMinutes()).padStart(2, '0');
    const s = String(kst.getSeconds()).padStart(2, '0');
    const ms = String(kst.getMilliseconds()).padStart(3, '0');

    return format
        .replace('YYYY', String(y))
        .replace('MM', m)
        .replace('DD', d)
        .replace('HH', h)
        .replace('mm', min)
        .replace('ss', s)
        .replace('ms', ms);
};

/**
 * 한국식 날짜/시간 포맷 (로컬라이즈)
 * @param date - 변환할 Date 객체 (기본값: 현재 시간)
 * @param options - Intl 포맷 옵션
 * @returns 한국식 포맷된 문자열
 */
export const formatKSTLocale = (
    date: Date = new Date(),
    options?: Intl.DateTimeFormatOptions
): string => {
    const kst = toKSTDate(date);
    return kst.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        ...options,
    });
};

/**
 * 작물명에 따른 이모지 아이콘 반환
 */
export const getCropIcon = (cropName: string | null): string => {
    const iconMap: Record<string, string> = {
        '딸기': '🍓',
        '감자': '🥔',
        '당근': '🥕',
        '양파': '🧅',
        '마늘': '🧄',
        '토마토': '🍅',
        '고추': '🌶️',
        '애호박': '🥒',
        '배추': '🥬',
        '상추': '🥗',
        '오이': '🥒',
        '브로콜리': '🥦',
        '옥수수': '🌽',
        '호박': '🎃',
    };
    return iconMap[cropName ?? ''] ?? '🌾';
};

/**
 * 작물명에 따른 색상 클래스 반환
 */
export const getCropColor = (cropName: string | null): string => {
    const colorMap: Record<string, string> = {
        '딸기': 'text-rose-600',
        '감자': 'text-amber-700',
        '당근': 'text-orange-600',
        '양파': 'text-yellow-600',
        '마늘': 'text-slate-600',
        '토마토': 'text-red-600',
        '고추': 'text-red-700',
        '애호박': 'text-green-600',
        '배추': 'text-green-700',
        '상추': 'text-green-600',
        '오이': 'text-green-600',
        '브로콜리': 'text-green-700',
        '옥수수': 'text-yellow-700',
        '호박': 'text-orange-700',
    };
    return colorMap[cropName ?? ''] ?? 'text-emerald-600';
};