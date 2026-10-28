import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, BotMessageSquare, Send, RotateCcw, AlertCircle, FlaskConical, Sparkles } from 'lucide-react';
import { askAssistant, checkAiStatus } from '../../services/aiAssistantService';
import AssistantMessage from './AssistantMessage';
import { AI_IS_MOCK } from '../../services/aiAssistantService';
// ─── Suggested questions ──────────────────────────────────────────────────────

const BASE_QUESTIONS = [
  { id: 'why', label: 'Kenapa kos ini cocok buat saya?' },
  { id: 'cons', label: 'Apa kekurangan kos ini?' },
  { id: 'checklist', label: 'Apa yang perlu saya pastikan sebelum menyewa?' },
  { id: 'tradeoff', label: 'Apa kompromi jika saya memilih kos ini?' },
];

const COMPARE_QUESTION = {
  id: 'compare',
  label: 'Bandingkan dengan kos lain yang saya simpan.',
};

// ─── State machine types ──────────────────────────────────────────────────────
// idle → loading → answered | error → idle

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProviderBadge({ configured, provider, model }) {
  if (configured && (provider === '9router' || provider === 'deepseek')) {
    return (
      <span
        title={`Terhubung ke 9Router AI Gateway (${model || 'OpenAI Compatible'})`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-[10px] font-semibold text-violet-700 select-none shadow-2xs"
      >
        <Sparkles className="w-3 h-3 text-violet-600 animate-pulse" />
        9Router AI
      </span>
    );
  }

  return (
    <span
      title="Mode Demo (data matching engine nyata). Konfigurasi ROUTER_API_KEY di .env.local untuk mengaktifkan 9Router."
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-700 cursor-help select-none"
      aria-label="Mode demo"
    >
      <FlaskConical className="w-3 h-3" />
      Demo
    </span>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2 px-1" aria-live="polite" aria-label="Memproses...">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 bg-[#2D5A47] rounded-full animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
      <span className="ml-2 text-xs text-slate-500">Menganalisis data kos…</span>
    </div>
  );
}

function EmptyState({ hasProfile }) {
  return (
    <div className="py-6 text-center space-y-2">
      <BotMessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
      <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
        {hasProfile
          ? 'Pilih pertanyaan di atas atau ketik pertanyaanmu sendiri tentang kos ini.'
          : 'Pilih pertanyaan untuk memulai. Lengkapi preferensimu agar jawaban lebih personal.'}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * KosAssistantPanel
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - primaryKos: { property, matchScore, matchReasons, matchTradeoffs }
 * - compareKos?: same shape | null (pass when there's a kos to compare)
 * - profile: StudentProfile | null
 */
export default function KosAssistantPanel({
  isOpen,
  onClose,
  primaryKos,
  compareKos = null,
  profile = null,
}) {
  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'answered' | 'error'
  const [response, setResponse] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const inFlightRef = useRef(false);
  const textareaRef = useRef(null);

  const [aiProvider, setAiProvider] = useState({ configured: false, provider: 'mock' });

  useEffect(() => {
    if (isOpen) {
      checkAiStatus().then(setAiProvider).catch(() => { });
    }
  }, [isOpen]);

  const hasCompareData = Boolean(compareKos?.property);

  const suggestedQuestions = hasCompareData
    ? [...BASE_QUESTIONS, COMPARE_QUESTION]
    : BASE_QUESTIONS;

  const submit = useCallback(
    async (q) => {
      const trimmed = (q || question).trim();
      if (!trimmed || inFlightRef.current) return;

      inFlightRef.current = true;
      setLastQuestion(trimmed);
      setQuestion('');
      setStatus('loading');
      setResponse(null);
      setErrorMsg('');

      try {
        const result = await askAssistant({
          question: trimmed,
          primaryKos,
          compareKos,
          profile,
        });
        setResponse(result);
        setStatus('answered');
      } catch (err) {
        setErrorMsg(err?.message || 'Terjadi kesalahan. Coba lagi.');
        setStatus('error');
      } finally {
        inFlightRef.current = false;
      }
    },
    [question, primaryKos, compareKos, profile]
  );

  const handleSuggestedClick = (label) => {
    if (status === 'loading') return;
    submit(label);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  const handleRetry = () => {
    if (lastQuestion) submit(lastQuestion);
  };

  const handleReset = () => {
    setStatus('idle');
    setResponse(null);
    setErrorMsg('');
    setLastQuestion('');
    setQuestion('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer — slides in from bottom on mobile, right panel on lg */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI Kos Decision Assistant"
        className="
          fixed z-50 bg-white shadow-2xl flex flex-col
          bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl
          lg:bottom-auto lg:top-0 lg:right-0 lg:left-auto lg:h-full lg:w-[420px] lg:rounded-none lg:rounded-l-2xl
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EAF4EF] flex items-center justify-center">
              <BotMessageSquare className="w-4 h-4 text-[#2D5A47]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">AI Kos Assistant</span>
                <ProviderBadge
                  configured={aiProvider.configured}
                  provider={aiProvider.provider}
                  model={aiProvider.model}
                />
              </div>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5">
                {primaryKos?.property?.name ?? 'Kos'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Tutup assistant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* No profile notice */}
        {!profile && (
          <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Preferensimu belum diisi. Jawaban akan berdasarkan data kos saja — bukan profil personalmu.{' '}
              <a href="/find" className="underline font-semibold" onClick={onClose}>
                Isi preferensi →
              </a>
            </p>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {/* Suggested questions */}
          {status !== 'loading' && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Pertanyaan cepat
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((sq) => {
                  const isCompare = sq.id === 'compare';
                  const disabled = isCompare && !hasCompareData;
                  return (
                    <button
                      key={sq.id}
                      onClick={() => !disabled && handleSuggestedClick(sq.label)}
                      disabled={disabled}
                      title={
                        disabled
                          ? 'Tambahkan kos lain ke daftar simpan untuk membandingkan'
                          : undefined
                      }
                      className={`
                        text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all
                        ${disabled
                          ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                          : 'border-[#2D5A47]/30 bg-[#EAF4EF] text-[#2D5A47] hover:bg-[#2D5A47] hover:text-white active:scale-95'
                        }
                      `}
                    >
                      {sq.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Divider */}
          {status !== 'idle' && (
            <div className="border-t border-slate-100" />
          )}

          {/* Last question label */}
          {lastQuestion && status !== 'idle' && (
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-slate-600">K</span>
              </div>
              <p className="text-xs text-slate-700 font-medium leading-relaxed">{lastQuestion}</p>
            </div>
          )}

          {/* Loading */}
          {status === 'loading' && (
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-[#EAF4EF] flex items-center justify-center shrink-0 mt-0.5">
                <BotMessageSquare className="w-3.5 h-3.5 text-[#2D5A47]" />
              </div>
              <LoadingDots />
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-red-600 font-medium">{errorMsg}</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2D5A47] hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" /> Coba lagi
                  </button>
                  <button
                    onClick={handleReset}
                    className="text-[11px] text-slate-400 hover:underline"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Answer */}
          {status === 'answered' && response && (
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-[#EAF4EF] flex items-center justify-center shrink-0 mt-0.5">
                <BotMessageSquare className="w-3.5 h-3.5 text-[#2D5A47]" />
              </div>
              <div className="flex-1 space-y-3">
                <AssistantMessage response={response} />
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Tanya hal lain
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {status === 'idle' && <EmptyState hasProfile={Boolean(profile)} />}
        </div>

        {/* Input footer */}
        <div className="px-4 py-3 border-t border-slate-100 shrink-0">
          <form onSubmit={handleFormSubmit} className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pertanyaanmu…"
              rows={1}
              maxLength={400}
              disabled={status === 'loading'}
              aria-label="Pertanyaan untuk AI assistant"
              className="flex-1 resize-none text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2D5A47]/30 focus:border-[#2D5A47] transition-all placeholder:text-slate-300 disabled:bg-slate-50 disabled:text-slate-400 leading-relaxed"
              style={{ maxHeight: '100px', overflowY: 'auto' }}
            />
            <button
              type="submit"
              disabled={!question.trim() || status === 'loading'}
              aria-label="Kirim pertanyaan"
              className="shrink-0 w-10 h-10 rounded-xl bg-[#2D5A47] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#234939] transition-all active:scale-95 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          {AI_IS_MOCK && (
            <p className="text-[10px] text-slate-300 mt-1.5 text-center leading-relaxed">
              Mode demo — jawaban berasal dari data kos, bukan AI model. Hubungkan backend untuk produksi.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
