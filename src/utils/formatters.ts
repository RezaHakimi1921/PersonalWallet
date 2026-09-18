import { toJalaali } from 'jalaali-js';

// Convert Rial to Toman (1 Toman = 10 Rials)
export function toToman(rial: number): number {
  return Math.round(rial / 10);
}

export function toRial(toman: number): number {
  return Math.round(toman * 10);
}

// Convert numbers to Persian digits
export function toPersianDigits(n: number | string): string {
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (w) => persian[+w]);
}

// Format number with commas (e.g., 25,920,304 or ۲۵,۹۲۰,۳۰۴)
export function formatMoney(toman: number, usePersianDigits: boolean = true): string {
  const formatted = Math.round(toman).toLocaleString('en-US');
  return usePersianDigits ? toPersianDigits(formatted) : formatted;
}

export function formatRialAsToman(rial: number, usePersianDigits: boolean = true): string {
  return formatMoney(toToman(rial), usePersianDigits);
}

// Format Shamsi Date from ISO string
export function formatShamsi(dateStr: string, includeTime: boolean = true): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const { jy, jm, jd } = toJalaali(d);
    
    const persianMonths = [
      'فروردین', 'اردیبهشت', 'خرداد',
      'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر',
      'دی', 'بهمن', 'اسفند'
    ];

    const monthName = persianMonths[jm - 1];
    const dateFormatted = `${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;

    if (includeTime) {
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const timeFormatted = `${toPersianDigits(hours)}:${toPersianDigits(minutes)}`;
      return `${dateFormatted} - ${timeFormatted}`;
    }
    return dateFormatted;
  } catch {
    return dateStr;
  }
}

export function getRelativePersianTime(dateStr: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMin = Math.round((now - then) / 60000);

    if (diffMin < 1) return 'همین الان';
    if (diffMin < 60) return `${toPersianDigits(diffMin)} دقیقه پیش`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${toPersianDigits(diffHours)} ساعت پیش`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays === 1) return 'دیروز';
    if (diffDays < 7) return `${toPersianDigits(diffDays)} روز پیش`;
    return formatShamsi(dateStr, false);
  } catch {
    return dateStr;
  }
}

// Bank styling helper
export interface BankMeta {
  name: string;
  gradient: string;
  border: string;
  bgLight: string;
  textColor: string;
  chipBg: string;
}

export function getBankMeta(bankCode: string): BankMeta {
  const code = bankCode.toLowerCase();
  switch (code) {
    case 'blu':
      return {
        name: 'بلو بانک',
        gradient: 'from-blue-600 to-indigo-700',
        border: 'border-blue-500/30',
        bgLight: 'bg-blue-500/10',
        textColor: 'text-blue-400',
        chipBg: 'bg-blue-600/20 text-blue-300'
      };
    case 'rasalat':
      return {
        name: 'بانک رسالت',
        gradient: 'from-emerald-600 to-teal-800',
        border: 'border-emerald-500/30',
        bgLight: 'bg-emerald-500/10',
        textColor: 'text-emerald-400',
        chipBg: 'bg-emerald-600/20 text-emerald-300'
      };
    case 'pasargad':
      return {
        name: 'بانک پاسارگاد',
        gradient: 'from-amber-600 to-yellow-800',
        border: 'border-amber-500/30',
        bgLight: 'bg-amber-500/10',
        textColor: 'text-amber-400',
        chipBg: 'bg-amber-600/20 text-amber-300'
      };
    case 'mellat':
      return {
        name: 'بانک ملت',
        gradient: 'from-red-600 to-rose-800',
        border: 'border-red-500/30',
        bgLight: 'bg-red-500/10',
        textColor: 'text-red-400',
        chipBg: 'bg-red-600/20 text-red-300'
      };
    case 'melli':
      return {
        name: 'بانک ملی',
        gradient: 'from-sky-700 to-cyan-900',
        border: 'border-sky-500/30',
        bgLight: 'bg-sky-500/10',
        textColor: 'text-sky-400',
        chipBg: 'bg-sky-600/20 text-sky-300'
      };
    case 'saman':
      return {
        name: 'بانک سامان',
        gradient: 'from-cyan-600 to-blue-800',
        border: 'border-cyan-500/30',
        bgLight: 'bg-cyan-500/10',
        textColor: 'text-cyan-400',
        chipBg: 'bg-cyan-600/20 text-cyan-300'
      };
    default:
      return {
        name: bankCode,
        gradient: 'from-slate-700 to-slate-900',
        border: 'border-slate-700',
        bgLight: 'bg-slate-800/40',
        textColor: 'text-slate-300',
        chipBg: 'bg-slate-700 text-slate-200'
      };
  }
}
