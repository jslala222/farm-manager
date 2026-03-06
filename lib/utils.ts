/**
 * bkit 표준 데이터 포맷팅 유틸리티
 */

const CROP_ICON_MAP: Record<string, string> = {
    '딸기': '🍓', '고구마': '🍠', '감자': '🥔', '상추': '🥬', '고추': '🌶️',
    '토마토': '🍅', '참외': '🍈', '멜론': '🍈', '수박': '🍉', '사과': '🍎',
    '포도': '🍇', '샤인머스켓': '🍇', '사인머스켓': '🍇', '옥수수': '🌽', '당근': '🥕',
    '양파': '🧅', '마늘': '🧄', '배추': '🥬', '오이': '🥒',
};
export const getCropIcon = (name: string): string => {
    for (const [key, icon] of Object.entries(CROP_ICON_MAP)) {
        if (name.includes(key)) return icon;
    }
    return '🌱';
};

export const getCropColor = (name: string): string => {
    if (name.includes('딸기')) return 'text-red-500';
    if (name.includes('토마토')) return 'text-red-600';
    if (name.includes('고추')) return 'text-red-700';
    if (name.includes('사과')) return 'text-rose-500';
    if (name.includes('수박')) return 'text-green-600';
    if (name.includes('참외') || name.includes('멜론')) return 'text-yellow-500';
    if (name.includes('포도') || name.includes('샤인머스켓')) return 'text-purple-500';
    if (name.includes('고구마')) return 'text-orange-600';
    if (name.includes('당근')) return 'text-orange-500';
    if (name.includes('옥수수')) return 'text-yellow-400';
    if (name.includes('상추') || name.includes('배추')) return 'text-green-500';
    return 'text-gray-500';
};

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
 * 이미지 파일을 목표 크기(KB) 이하로 자동 압축합니다.
 * Canvas API를 사용하여 품질을 낮추거나 해상도를 줄입니다.
 * @param file 원본 이미지 파일
 * @param targetKB 목표 파일 크기 (기본: 150KB)
 * @returns 압축된 File 객체
 */
export const compressImage = (file: File, targetKB: number = 150): Promise<File> => {
    return new Promise((resolve, reject) => {
        const targetBytes = targetKB * 1024;

        // 이미 목표 크기 이하면 그대로 반환
        if (file.size <= targetBytes) {
            resolve(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                // 최대 해상도 제한 (1200px)
                const MAX_DIM = 1200;
                if (width > MAX_DIM || height > MAX_DIM) {
                    const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, width, height);

                // 품질을 낮춰가며 목표 크기 달성
                let quality = 0.85;
                const tryCompress = () => {
                    canvas.toBlob((blob) => {
                        if (!blob) { reject(new Error('압축 실패')); return; }

                        if (blob.size <= targetBytes || quality <= 0.1) {
                            // 목표 달성 or 최저 품질 도달
                            const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
                            const compressedFile = new File(
                                [blob],
                                file.name.replace(/\.[^.]+$/, `.jpg`),
                                { type: 'image/jpeg' }
                            );
                            resolve(compressedFile);
                        } else {
                            // 품질 낮추고 재시도
                            quality = Math.max(0.1, quality - 0.1);
                            tryCompress();
                        }
                    }, 'image/jpeg', quality);
                };

                tryCompress();
            };
            img.onerror = () => reject(new Error('이미지 로드 실패'));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('파일 읽기 실패'));
        reader.readAsDataURL(file);
    });
};