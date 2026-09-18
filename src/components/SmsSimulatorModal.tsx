import React, { useState, useEffect } from 'react';
import { 
  X, 
  MessageSquareCode, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Smartphone, 
  Copy, 
  Check, 
  Terminal 
} from 'lucide-react';
import { Account } from '../types';
import { formatRialAsToman, toPersianDigits, getBankMeta } from '../utils/formatters';

interface SmsSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onTriggerWebhook: (bank: string, text: string) => Promise<{ ok: boolean; parsed: boolean; transaction_id: number }>;
}

export const SmsSimulatorModal: React.FC<SmsSimulatorModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onTriggerWebhook,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'simulator' | 'shortcuts'>('simulator');
  const [selectedBank, setSelectedBank] = useState<string>('blu');
  const [smsText, setSmsText] = useState<string>('');
  const [parseResult, setParseResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const presets = [
    {
      bank: 'blu',
      label: 'بلو بانک (برداشت - خرید)',
      text: 'خرید از اسنپ فود - مبلغ: ۱,۲۵۰,۰۰۰ ریال از حساب بلو پرید. موجودی: ۲,۶۰۹,۲۱۲',
    },
    {
      bank: 'blu',
      label: 'بلو بانک (واریز)',
      text: 'واریز به حساب بلو - مبلغ: ۲۰,۰۰۰,۰۰۰ ریال به حساب نشست. موجودی: ۲۲,۶۰۹,۲۱۲',
    },
    {
      bank: 'rasalat',
      label: 'بانک رسالت (برداشت - قسط وام)',
      text: '-۲۵,۰۰۰,۰۰۰ مانده: ۲۳۴,۲۰۳,۰۴۱ انتقال پایا رسالت',
    },
    {
      bank: 'rasalat',
      label: 'بانک رسالت (واریز حقوق/کارت)',
      text: '+۱۵۰,۰۰۰,۰۰۰ مانده: ۳۸۴,۲۰۳,۰۴۱ واریز حقوق شهریور',
    },
    {
      bank: 'pasargad',
      label: 'پاسارگاد (برداشت)',
      text: '-۳,۵۰۰,۰۰۰ مانده: ۲,۸۲۶,۳۶۶ خرید پایانه فروشگاهی پاسارگاد',
    },
  ];

  // Live test SMS parsing via backend test endpoint
  useEffect(() => {
    if (!smsText.trim()) {
      setParseResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsTesting(true);
      try {
        const res = await fetch('/api/sms-parser/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bank_code: selectedBank, text: smsText }),
        });
        const data = await res.json();
        setParseResult(data.parsed);
      } catch (err) {
        console.error('Test parse failed', err);
      } finally {
        setIsTesting(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [smsText, selectedBank]);

  const handleSendWebhook = async () => {
    if (!smsText.trim()) return;
    setIsSending(true);
    setSuccessMsg(null);
    try {
      const res = await onTriggerWebhook(selectedBank, smsText);
      if (res.ok) {
        setSuccessMsg(
          res.parsed
            ? 'پیامک با موفقیت پردازش شد و به لیست در انتظار اضافه گردید!'
            : 'پیامک ذخیره شد، اما الگوی آن نیازمند بررسی دستی است.'
        );
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } finally {
      setIsSending(false);
    }
  };

  const copyWebhookUrl = () => {
    const url = `${window.location.origin}/api/webhook/sms`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-xl w-full shadow-2xl space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <MessageSquareCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">شبیه‌ساز و تستر پیامک بانک</h3>
              <p className="text-[11px] text-slate-400">تست دقیق پارسر بانک‌ها و شبیه‌سازی وب‌هوک آیفون</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'simulator' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            تست و ارسال پیامک نمونه
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'shortcuts' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            راهنمای Shortcuts آیفون
          </button>
        </div>

        {activeTab === 'simulator' ? (
          <div className="space-y-4 text-xs">
            {/* Presets Chips */}
            <div>
              <label className="text-slate-400 block mb-1.5 font-medium">نمونه‌های آماده پیامک:</label>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedBank(p.bank);
                      setSmsText(p.text);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700/60 transition-all text-right"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bank Select */}
            <div>
              <label className="text-slate-400 block mb-1">بانک مقصد:</label>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.bank_code}>
                    {a.display_name} ({a.bank_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Textarea */}
            <div>
              <label className="text-slate-400 block mb-1">متن کامل پیامک بانکی:</label>
              <textarea
                rows={3}
                placeholder="متن پیامک بانک را اینجا پیست کنید یا یکی از نمونه‌های بالا را بزنید..."
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 text-xs font-sans focus:outline-none focus:border-indigo-500 leading-relaxed"
              />
            </div>

            {/* Live Parsing Result */}
            {smsText.trim() && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    نتیجه پردازش هوشمند پارسر:
                  </span>
                  {isTesting && <span className="text-indigo-400 animate-pulse">در حال بررسی...</span>}
                </div>

                {parseResult ? (
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div className="bg-slate-900 p-2 rounded-lg text-center">
                      <span className="text-[10px] text-slate-400 block">مبلغ استخراج‌شده:</span>
                      <span className="font-bold text-slate-100 font-num">
                        {formatRialAsToman(parseResult.amount_rial)} ت
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg text-center">
                      <span className="text-[10px] text-slate-400 block">نوع تراکنش:</span>
                      <span
                        className={`font-bold ${
                          parseResult.direction === 'income' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {parseResult.direction === 'income' ? 'واریز' : 'برداشت'}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg text-center">
                      <span className="text-[10px] text-slate-400 block">مانده بعد تراکنش:</span>
                      <span className="font-bold text-slate-100 font-num">
                        {parseResult.balance_after_rial != null
                          ? formatRialAsToman(parseResult.balance_after_rial) + ' ت'
                          : 'نامشخص'}
                      </span>
                    </div>
                  </div>
                ) : (
                  !isTesting && (
                    <div className="text-[11px] text-amber-400 flex items-center gap-1.5 py-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>الگوی این پیامک شناسایی نشد (به صورت بررسی دستی ذخیره خواهد شد).</span>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-300 p-2.5 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Send Button */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSendWebhook}
                disabled={isSending || !smsText.trim()}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>{isSending ? 'در حال شبیه‌سازی...' : 'شبیه‌سازی دریافت پیامک (POST به وب‌هوک)'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
              >
                بستن
              </button>
            </div>
          </div>
        ) : (
          /* iOS Shortcuts guide */
          <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">آدرس اندپوینت وب‌هوک:</span>
                <button
                  onClick={copyWebhookUrl}
                  className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 px-2 py-1 rounded"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'کپی شد' : 'کپی آدرس'}</span>
                </button>
              </div>
              <div className="bg-slate-900 p-2 rounded font-mono text-[11px] text-slate-300 break-all text-left" dir="ltr">
                {window.location.origin}/api/webhook/sms
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                نحوه تنظیم در iOS Shortcuts:
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] pr-1">
                <li>در برنامه Shortcuts آیفون وارد تب <strong>Automation</strong> شوید.</li>
                <li>گزینه <strong>Message</strong> را انتخاب کرده و فرستنده را شماره پیامک بانک (مثلاً بلو یا رسالت) قرار دهید.</li>
                <li>اکشن <strong>Get Contents of URL</strong> اضافه کنید.</li>
                <li>Method را روی <strong>POST</strong> و Request Body را روی <strong>JSON</strong> بگذارید.</li>
                <li>
                  دو فیلد ایجاد کنید:
                  <ul className="list-disc list-inside mr-4 my-1 text-slate-300">
                    <li><code className="text-indigo-300">bank</code>: کد بانک (مثلا <code className="text-indigo-300">blu</code> یا <code className="text-indigo-300">rasalat</code>)</li>
                    <li><code className="text-indigo-300">text</code>: متغیر <code className="text-indigo-300">Shortcut Input</code> (متن پیامک)</li>
                  </ul>
                </li>
              </ol>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 text-left" dir="ltr">
              <span className="text-slate-500 block font-sans mb-1 text-right" dir="rtl">تست با curl:</span>
              curl -X POST {window.location.origin}/api/webhook/sms \<br />
              &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
              &nbsp;&nbsp;-d '&#123;"bank":"blu", "text":"خرید ... ریال"&#125;'
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
