/**
 * bkit ?쒖? ?곗씠???щ㎎???좏떥由ы떚
 */

const CROP_ICON_MAP: Record<string, string> = {
    '?멸린': '?뜐', '怨좉뎄留?: '?뜝', '媛먯옄': '?쪛', '?곸텛': '??', '怨좎텛': '?뙳截?,
    '?좊쭏??: '?뛿', '李몄쇅': '?뜄', '硫쒕줎': '?뜄', '?섎컯': '?뜆', '?ш낵': '?뜋',
    '?щ룄': '?뜃', '?ㅼ씤癒몄뒪耳?: '?뜃', '?ъ씤癒몄뒪耳?: '?뜃', '?μ닔??: '?뙺', '?밴렐': '?쪜',
    '?묓뙆': '?쭋', '留덈뒛': '?쭊', '諛곗텛': '??', '?ㅼ씠': '?쪙',
};
export const getCropIcon = (name: string): string => {
    for (const [key, icon] of Object.entries(CROP_ICON_MAP)) {
        if (name.includes(key)) return icon;
    }
    return '?뙮';
};

export const getCropColor = (name: string): string => {
    if (name.includes('?멸린')) return 'text-red-500';
    if (name.includes('?좊쭏??)) return 'text-red-600';
    if (name.includes('怨좎텛')) return 'text-red-700';
    if (name.includes('?ш낵')) return 'text-rose-500';
    if (name.includes('?섎컯')) return 'text-green-600';
    if (name.includes('李몄쇅') || name.includes('硫쒕줎')) return 'text-yellow-500';
    if (name.includes('?щ룄') || name.includes('?ㅼ씤癒몄뒪耳?)) return 'text-purple-500';
    if (name.includes('怨좉뎄留?)) return 'text-orange-600';
    if (name.includes('?밴렐')) return 'text-orange-500';
    if (name.includes('?μ닔??)) return 'text-yellow-400';
    if (name.includes('?곸텛') || name.includes('諛곗텛')) return 'text-green-500';
    return 'text-gray-500';
};

/**
 * ?꾪솕踰덊샇瑜?000-0000-0000 ?뺤떇?쇰줈 蹂?섑빀?덈떎.
 */
/**
 * 吏?ν삎 ?꾪솕踰덊샇 ?щ㎎??(?쒖슱 02, 吏??쾲??諛??대????꾨꼍 ???
 */
export const formatPhone = (value: string): string => {
    const digits = value.replace(/[^\d]/g, "");
    if (digits.length <= 2) return digits;

    // ?쒖슱(02) 泥댄겕
    if (digits.startsWith("02")) {
        if (digits.length <= 2) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
        if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
        return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
    }

    // ?쇰컲 吏??쾲???대???(010, 031, 041, 070 ??
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
};

/**
 * ?ъ뾽?먮벑濡앸쾲???щ㎎??(000-00-00000)
 */
export const formatBusinessNumber = (value: string): string => {
    const digits = value.replace(/[^\d]/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 10)}`;
};

/**
 * ?レ옄瑜?泥??⑥쐞 肄ㅻ쭏? '?? ?묐??ш? 遺숈? ?뺤떇?쇰줈 蹂?섑빀?덈떎.
 */
export const formatCurrency = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === "") return "0??;
    const num = typeof value === "string" ? parseInt(value.replace(/[^\d]/g, ""), 10) : value;
    if (isNaN(num)) return "0??;
    return `${num.toLocaleString()}??;
};

/**
 * ?レ옄留?異붿텧?섏뿬 臾몄옄?대줈 諛섑솚 (?낅젰媛??뺤젣??
 */
export const stripNonDigits = (value: string): string => {
    return value.replace(/[^\d]/g, "");
};
/**
 * ============================================
 * ?쒓뎅 ?쒓컙?(KST, UTC+9) 愿???좏떥由ы떚
 * ============================================
 */

/**
 * UTC ?먮뒗 ?꾩옱 ?쒓컙???쒓뎅 ?쒓컙?쇰줈 蹂??
 * @param date - 蹂?섑븷 Date 媛앹껜 (湲곕낯媛? ?꾩옱 ?쒓컙)
 * @returns ?쒓뎅 ?쒓컙 Date 媛앹껜
 */
export const toKSTDate = (date: Date = new Date()): Date => {
    return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
};

/**
 * ?꾩옱 ?쒓뎅 ?쒓컙 媛?몄삤湲?
 * @returns ?쒓뎅 ?쒓컙 Date 媛앹껜
 */
export const getNowKST = (): Date => {
    return toKSTDate();
};

/**
 * ?쒓뎅 ?쒓컙??ISO 臾몄옄?대줈 蹂??(?좎쭨 遺遺꾨쭔)
 * @param date - 蹂?섑븷 Date 媛앹껜 (湲곕낯媛? ?꾩옱 ?쒓컙)
 * @returns YYYY-MM-DD ?뺤떇
 */
export const toKSTDateString = (date: Date = new Date()): string => {
    const kst = toKSTDate(date);
    return kst.toISOString().split('T')[0];
};

/**
 * ?쒓뎅 ?쒓컙???щ㎎?섏뿬 臾몄옄?대줈 諛섑솚
 * @param date - 蹂?섑븷 Date 媛앹껜 (湲곕낯媛? ?꾩옱 ?쒓컙)
 * @param format - ?좎쭨 ?뺤떇 (湲곕낯媛? 'YYYY-MM-DD HH:mm:ss')
 * @returns ?щ㎎??臾몄옄??
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
 * ?쒓뎅???좎쭨/?쒓컙 ?щ㎎ (濡쒖뺄?쇱씠利?
 * @param date - 蹂?섑븷 Date 媛앹껜 (湲곕낯媛? ?꾩옱 ?쒓컙)
 * @param options - Intl ?щ㎎ ?듭뀡
 * @returns ?쒓뎅???щ㎎??臾몄옄??
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
 * ?대?吏 ?뚯씪??紐⑺몴 ?ш린(KB) ?댄븯濡??먮룞 ?뺤뒿?⑸땲??
 * browser-image-compression ?쇱씠釉뚮윭由??ъ슜 (Web Worker, 紐⑤컮??理쒖쟻??
 * @param file ?먮낯 ?대?吏 ?뚯씪
 * @param targetKB 紐⑺몴 ?뚯씪 ?ш린 (湲곕낯: 150KB)
 * @returns ?뺤뒿??File 媛앹껜
 */
export const compressImage = async (file: File, targetKB: number = 150): Promise<File> => {
    const imageCompression = (await import('browser-image-compression')).default;
    const compressed = await imageCompression(file, {
        maxSizeMB: targetKB / 1024,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: 'image/jpeg',
    });
    return new File([compressed], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
};


export function generateId(): string {
  // Secure Context에서는 crypto.randomUUID 사용
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Non-Secure Context 폴백: timestamp + random
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
