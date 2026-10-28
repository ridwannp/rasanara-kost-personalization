/**
 * AI Kos Decision Assistant — Service Layer
 *
 * CONTRACT:
 *   askAssistant(payload) → Promise<AssistantResponse>
 *
 * payload: {
 *   question: string,
 *   primaryKos: { property, matchScore, matchReasons, matchTradeoffs },
 *   compareKos?: same shape | null,
 *   profile?: StudentProfile | null,
 * }
 *
 * AssistantResponse: {
 *   summary?: string,
 *   reasons?: string[],
 *   pros?: string[],
 *   cons?: string[],
 *   unknowns?: string[],
 *   nextSteps?: string[],
 *   disclaimer?: string,
 * }
 *
 * BACKEND INTEGRATION NOTE:
 *   When a backend endpoint is available, set AI_IS_MOCK = false and configure
 *   VITE_AI_BACKEND_URL in your .env file (server-side only, NOT exposed as VITE_).
 *   NEVER put AI provider secret keys in this file or any frontend bundle.
 *
 *   Backend endpoint shape:
 *     POST /api/ai/kos-assistant
 *     Body: sanitized payload (no phone, no email, no full PII)
 *     Response: AssistantResponse JSON
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Set to false when a real backend endpoint is configured */
export const AI_IS_MOCK = true;

const MOCK_DELAY_MS = 850;
const MAX_QUESTION_CHARS = 400;
const REQUEST_COOLDOWN_MS = 1500;

let _lastRequestTime = 0;

// ─── Input sanitization ───────────────────────────────────────────────────────

/** Strip PII before sending to any remote endpoint. */
function sanitizeProfile(profile) {
  if (!profile) return null;
  return {
    archetype: profile.archetype?.title || null,
    studyProgram: profile.studyProgram || null,
    moveInDate: profile.moveInDate || null,
    preferences: profile.preferences
      ? {
          budgetMin: profile.preferences.budgetMin,
          budgetMax: profile.preferences.budgetMax,
          maxDistance: profile.preferences.maxDistance,
          gender: profile.preferences.gender,
          facilities: profile.preferences.facilities,
          lifestyle: profile.preferences.lifestyle
            ? {
                environmentPref: profile.preferences.lifestyle.environmentPref,
                afterClass: profile.preferences.lifestyle.afterClass,
              }
            : null,
        }
      : null,
    // Intentionally OMITTING: name, contact.whatsapp, contact.email, id
  };
}

function sanitizeKos(kosCtx) {
  if (!kosCtx?.property) return null;
  const p = kosCtx.property;
  return {
    id: p.id,
    name: p.name,
    price: p.pricing?.min || p.priceMin,
    priceMax: p.pricing?.max || p.priceMax,
    distanceFromIPB: p.distanceFromIPB,
    gender: p.gender,
    facilities: p.facilities,
    environment: p.environment,
    personality: p.personality,
    suitableFor: p.suitableFor,
    rules: p.rules,
    rooms: p.rooms?.map((r) => ({
      name: r.name,
      price: r.price,
      size: r.size,
      available: r.available,
    })),
    availability: p.availability,
    verified: p.verified,
    rating: p.rating,
    reviewCount: p.reviewCount,
    matchScore: kosCtx.matchScore,
    matchReasons: kosCtx.matchReasons,
    matchTradeoffs: kosCtx.matchTradeoffs,
    // Intentionally OMITTING: owner phone/whatsapp
  };
}

// ─── Mock response generator ──────────────────────────────────────────────────

/**
 * Derives answers from REAL kos data + profile.
 * Clearly labeled as demo — NOT connected to any AI model.
 */
function generateMockResponse(question, primaryKos, compareKos, profile) {
  const prop = primaryKos?.property;
  const prefs = profile?.preferences;
  const matchScore = primaryKos?.matchScore;
  const reasons = primaryKos?.matchReasons ?? [];
  const tradeoffs = primaryKos?.matchTradeoffs ?? [];

  const q = (question || '').toLowerCase();

  const isComparison = q.includes('banding') || q.includes('simpan') || q.includes('lain');
  const isWhyMatch =
    q.includes('kenapa') || q.includes('cocok') || q.includes('sesuai') || q.includes('alasan');
  const isWeakness =
    q.includes('kekurangan') || q.includes('kurang') || q.includes('kompromi') || q.includes('kelemahan');
  const isCheckList =
    q.includes('pastikan') || q.includes('tanya') || q.includes('cek') || q.includes('sebelum');

  // ── Why match ──
  if (isWhyMatch) {
    const profileNote = prefs
      ? `Berdasarkan preferensimu (budget Rp${(prefs.budgetMax / 1e6).toFixed(1)} jt, jarak max ${prefs.maxDistance} km, skor cocok ${matchScore ?? '—'}%).`
      : 'Tanpa profil preferensi, analisis berikut berdasarkan data kos saja.';

    return {
      summary: `${prop?.name ?? 'Kos ini'} mendapat skor kecocokan ${matchScore ?? '—'}% dari matching engine.`,
      reasons: reasons.length > 0 ? reasons : ['Data alasan kecocokan tidak tersedia.'],
      pros: [
        prop?.environment?.noiseLevel === 'low' ? 'Lingkungan tenang (noise level: rendah)' : null,
        prop?.facilities?.includes('wifi') ? 'WiFi tersedia' : null,
        prop?.facilities?.includes('ac') ? 'AC di kamar' : null,
        prop?.facilities?.includes('bathroom_inside') ? 'Kamar mandi dalam' : null,
        prop?.verified ? 'Properti terverifikasi' : null,
        prop?.rating ? `Rating ${prop.rating}/5 dari ${prop.reviewCount} ulasan` : null,
      ].filter(Boolean),
      unknowns: [
        'Kondisi aktual kamar perlu dicek langsung saat survei',
        'Suasana harian dan riwayat penghuni sebelumnya belum tersedia',
        !prop?.availability?.availableRooms
          ? 'Status ketersediaan kamar belum terkonfirmasi'
          : null,
      ].filter(Boolean),
      nextSteps: [
        'Kunjungi langsung untuk melihat kondisi kamar',
        'Konfirmasi ketersediaan sebelum membayar',
        prefs?.facilities?.length
          ? `Pastikan fasilitas prioritasmu tersedia: ${prefs.facilities.slice(0, 2).join(', ')}`
          : 'Lengkapi preferensimu untuk rekomendasi yang lebih personal',
      ].filter(Boolean),
      disclaimer: profileNote,
    };
  }

  // ── Weaknesses / trade-offs ──
  if (isWeakness) {
    const price = prop?.pricing?.min || prop?.priceMin;
    const budgetMax = prefs?.budgetMax;
    const isOverBudget = budgetMax && price && price > budgetMax;

    return {
      summary: `Berikut hal-hal yang perlu dipertimbangkan sebelum memilih ${prop?.name ?? 'kos ini'}.`,
      cons: tradeoffs.length > 0 ? tradeoffs : ['Data kekurangan spesifik tidak tersedia untuk kos ini.'],
      unknowns: [
        'Tingkat kebisingan aktual di malam hari / akhir pekan belum diverifikasi',
        'Kebijakan tamu dan jam malam perlu dikonfirmasi langsung ke pemilik',
        prop?.environment?.noiseLevel !== 'low'
          ? 'Suasana lingkungan sekitar belum terdata secara detail'
          : null,
      ].filter(Boolean),
      nextSteps: [
        isOverBudget
          ? `Harga mulai Rp${(price / 1e6).toFixed(1)} jt sedikit di atas budgetmu (Rp${(budgetMax / 1e6).toFixed(1)} jt) — pertimbangkan apakah fasilitas setimpal`
          : null,
        'Tanya pemilik tentang kebijakan yang tidak tercantum (tamu, hewan peliharaan, jam bertamu)',
        'Cek ulasan penghuni sebelumnya di platform lain jika tersedia',
      ].filter(Boolean),
    };
  }

  // ── Comparison ──
  if (isComparison && compareKos?.property) {
    const propB = compareKos.property;
    const priceA = prop?.pricing?.min || prop?.priceMin || 0;
    const priceB = propB?.pricing?.min || propB?.priceMin || 0;
    const distA = prop?.distanceFromIPB ?? 99;
    const distB = propB?.distanceFromIPB ?? 99;
    const scoreA = primaryKos?.matchScore ?? 0;
    const scoreB = compareKos?.matchScore ?? 0;

    return {
      summary: `Membandingkan ${prop?.name ?? 'Kos A'} (${scoreA}% cocok) vs ${propB?.name ?? 'Kos B'} (${scoreB}% cocok).`,
      pros: [
        scoreA !== scoreB
          ? scoreA > scoreB
            ? `${prop?.name} lebih cocok dengan preferensimu (selisih ${scoreA - scoreB}%)`
            : `${propB?.name} lebih cocok dengan preferensimu (selisih ${scoreB - scoreA}%)`
          : 'Skor kecocokan keduanya setara',
        priceA !== priceB
          ? priceA < priceB
            ? `${prop?.name} lebih hemat (selisih Rp${Math.round((priceB - priceA) / 1000)}rb/bln)`
            : `${propB?.name} lebih hemat (selisih Rp${Math.round((priceA - priceB) / 1000)}rb/bln)`
          : 'Harga keduanya setara',
        distA !== distB
          ? distA < distB
            ? `${prop?.name} lebih dekat ke IPB (${distA} km vs ${distB} km)`
            : `${propB?.name} lebih dekat ke IPB (${distB} km vs ${distA} km)`
          : 'Jarak keduanya ke IPB setara',
      ].filter(Boolean),
      unknowns: [
        'Perbandingan ini berdasarkan data listing — kondisi aktual perlu dicek langsung',
        'Ulasan penghuni dan suasana harian tidak tersedia dalam platform ini',
      ],
      nextSteps: [
        'Kunjungi keduanya sebelum memutuskan',
        'Gunakan halaman Bandingkan untuk melihat spesifikasi lengkap berdampingan',
      ],
    };
  }

  // ── Checklist before renting ──
  if (isCheckList) {
    return {
      summary: `Sebelum menyewa ${prop?.name ?? 'kos ini'}, pastikan kamu menanyakan dan mengecek hal-hal berikut.`,
      nextSteps: [
        'Konfirmasi ketersediaan kamar dan tanggal bisa mulai masuk',
        'Tanya rincian biaya: listrik, air, parkir, dan deposit',
        'Pastikan kondisi fasilitas berfungsi (AC, WiFi, kamar mandi) saat kunjungan',
        prop?.rules?.length
          ? `Baca peraturan kos: "${prop.rules[0]}"${prop.rules.length > 1 ? ` (+${prop.rules.length - 1} peraturan lain)` : ''}`
          : 'Tanyakan peraturan bertamu dan jam malam secara eksplisit',
        'Minta kontrak sewa tertulis sebelum membayar apapun',
        'Simpan kontak darurat pemilik atau pengelola kos',
      ],
      unknowns: [
        'Biaya listrik (meteran sendiri atau flat rate?) belum tercantum di listing',
        'Kebijakan deposit dan pengembaliannya tidak terdata di platform ini',
        'Kondisi koneksi WiFi di jam sibuk belum diverifikasi',
      ],
    };
  }

  // ── Fallback generic ──
  return {
    summary: `Berikut gambaran umum tentang ${prop?.name ?? 'kos ini'} berdasarkan data yang tersedia.`,
    pros: reasons.slice(0, 3),
    cons: tradeoffs,
    unknowns: ['Informasi kondisi aktual dan suasana harian perlu dicek langsung ke lokasi.'],
    nextSteps: [
      'Kunjungi kos untuk melihat kondisi nyata',
      'Hubungi pemilik untuk pertanyaan spesifik',
    ],
    disclaimer: profile
      ? `Analisis berdasarkan data listing dan profil preferensimu (skor cocok: ${matchScore ?? '—'}%).`
      : 'Profil preferensimu belum tersedia — lengkapi untuk jawaban yang lebih personal.',
  };
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

function checkCooldown() {
  const now = Date.now();
  if (now - _lastRequestTime < REQUEST_COOLDOWN_MS) {
    throw new Error('Tunggu sebentar sebelum mengirim pertanyaan lagi.');
  }
  _lastRequestTime = now;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks if DeepSeek backend proxy is configured with an API key.
 * @returns {Promise<{ configured: boolean, provider: string }>}
 */
export async function checkAiStatus() {
  try {
    const res = await fetch('/api/ai/status');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // ignore
  }
  return { configured: false, provider: 'mock' };
}

/**
 * Ask the AI Kos Decision Assistant a question.
 *
 * @param {object} payload
 * @param {string} payload.question
 * @param {object} payload.primaryKos - { property, matchScore, matchReasons, matchTradeoffs }
 * @param {object} [payload.compareKos] - same shape, optional
 * @param {object} [payload.profile] - from StudentProfileContext
 * @returns {Promise<AssistantResponse>}
 */
export async function askAssistant({ question, primaryKos, compareKos = null, profile = null }) {
  if (!question || question.trim().length === 0) {
    throw new Error('Pertanyaan tidak boleh kosong.');
  }
  if (question.length > MAX_QUESTION_CHARS) {
    throw new Error(`Pertanyaan terlalu panjang (maks ${MAX_QUESTION_CHARS} karakter).`);
  }
  if (!primaryKos?.property) {
    throw new Error('Data kos tidak tersedia untuk dianalisis.');
  }

  checkCooldown();

  // Try calling the Vite dev server /api/ai/kos-assistant middleware (DeepSeek proxy)
  if (typeof window !== 'undefined') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch('/api/ai/kos-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim().slice(0, MAX_QUESTION_CHARS),
          primaryKos: sanitizeKos(primaryKos),
          compareKos: compareKos ? sanitizeKos(compareKos) : null,
          profile: sanitizeProfile(profile),
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }

      const errData = await res.json().catch(() => ({}));
      if (errData.code === 'API_KEY_MISSING') {
        throw new Error(
          'API Key belum disetel di file .env.local (ROUTER_API_KEY). Tambahkan ROUTER_API_KEY=sk-... di file .env.local.'
        );
      }
      if (errData.error) {
        throw new Error(errData.error);
      }
      throw new Error(`Server error ${res.status}`);
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Permintaan ke 9Router timeout (>25 detik). Silakan coba lagi.', { cause: err });
      }
      // Re-throw specific errors (API key missing, rate limit, quota, connection)
      if (
        err.message.includes('API Key') ||
        err.message.includes('ROUTER') ||
        err.message.includes('9Router') ||
        err.message.includes('Limit kuota') ||
        err.message.includes('tidak valid') ||
        err.message.includes('Gagal terhubung')
      ) {
        throw err;
      }
      // If endpoint not reachable or network issue, fallback to mock in dev
      console.warn('[AI Assistant] Gagal memanggil endpoint 9Router, beralih ke mode lokal:', err.message);
      await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
      return generateMockResponse(question, primaryKos, compareKos, profile);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Node.js test environment fallback
  await new Promise((resolve) => setTimeout(resolve, 10));
  return generateMockResponse(question, primaryKos, compareKos, profile);
}

// ─── Exported for testing ─────────────────────────────────────────────────────
export { sanitizeProfile, sanitizeKos, generateMockResponse };

