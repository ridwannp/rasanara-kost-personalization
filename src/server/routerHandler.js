/**
 * 9Router / OpenAI-Compatible AI Handler for Kos Decision Assistant
 *
 * Connects to 9Router AI Gateway (typically http://localhost:20128/v1 or https://api.9router.com/v1).
 * Supports any model routed through 9Router (DeepSeek, Claude, GPT, Gemini).
 * Features auto-fallback for common route variants (/v1/chat/completions, /api/v1/chat/completions).
 */

const DEFAULT_BASE_URL = 'http://localhost:20128/v1';
const DEFAULT_MODEL = 'deepseek-chat';

const SYSTEM_PROMPT = `Kamu adalah Asisten Keputusan Kos cerdas, objektif, dan jujur untuk mahasiswa IPB University (Kampus Dramaga).
Tugasmu: Membantu mahasiswa memahami kecocokan kos, menimbang pro & kontra, serta mempersiapkan survei/sewa berdasarkan FAKTA DATA LISTING dan PREFERENSI MAHASISWA yang disediakan.

ATURAN KETAT INTEGRITAS DATA:
1. DILARANG MENGARANG DATA: Jangan mengarang harga, fasilitas, jarak ke IPB, aturan, atau suasana yang tidak ada pada data listing.
2. JELASKAN TRADE-OFF: Jangan katakan kos ini sempurna. Ungkapkan kompromi secara jujur (misal: harga mendekati batas budget, jarak agak jauh, atau kamar tanpa AC).
3. TRANSPARANSI DATA: Jika suatu informasi tidak ada di listing (misal biaya listrik/air terpisah, deposit, jam malam, suasana kebisingan aktual malam hari), sebutkan secara eksplisit pada bagian 'unknowns' agar mahasiswa menanyakannya langsung ke pemilik kos.
4. JAWAB DALAM BAHASA INDONESIA yang ramah mahasiswa IPB, jelas, terstruktur, dan tidak bertele-tele.

FORMAT OUTPUT WAJIB BERBENTUK JSON dengan struktur persis berikut:
{
  "summary": "Ringkasan jawaban 1-2 kalimat langsung pada inti pertanyaan",
  "reasons": ["Alasan kecocokan berdasarkan profil dan preferensi mahasiswa jika relevan"],
  "pros": ["Kelebihan utama kos ini berdasarkan data listing yang tersedia"],
  "cons": ["Kekurangan, kompromi, atau hal yang perlu diwaspadai"],
  "unknowns": ["Hal-hal yang belum diketahui/belum terdata di listing dan perlu dipastikan saat survei"],
  "nextSteps": ["Langkah praktis berikutnya atau pertanyaan yang harus diajukan ke pemilik kos"],
  "disclaimer": "Catatan singkat tentang basis analisis (misal: Berdasarkan data listing Ngekost dan budget RpX)"
}`;

function buildUserPrompt({ question, primaryKos, compareKos, profile }) {
  const p = primaryKos?.property;
  const comp = compareKos?.property;
  const prefs = profile?.preferences;

  let prompt = `PERTANYAAN MAHASISWA:\n"${question}"\n\n`;

  prompt += `=== DATA KOS UTAMA ===\n`;
  prompt += `Nama: ${p?.name || 'Tidak diketahui'}\n`;
  prompt += `Harga: Rp${p?.priceMin?.toLocaleString('id-ID') || p?.pricing?.min?.toLocaleString('id-ID') || '—'}/bulan\n`;
  prompt += `Jarak ke IPB: ${p?.distanceFromIPB ?? '—'} km\n`;
  prompt += `Tipe Kos: ${p?.gender || 'Campur'}\n`;
  prompt += `Fasilitas: ${(p?.facilities || []).join(', ') || 'Standar'}\n`;
  prompt += `Tingkat Kebisingan: ${p?.environment?.noiseLevel || 'Tidak terdata'}\n`;
  prompt += `Status Verifikasi: ${p?.verified ? 'Terverifikasi' : 'Belum terverifikasi'}\n`;
  prompt += `Rating: ${p?.rating ?? '—'} (${p?.reviewCount ?? 0} ulasan)\n`;
  prompt += `Kamar Tersedia: ${p?.availability?.availableRooms ?? 'Belum terkonfirmasi'}\n`;
  if (p?.rules?.length) {
    prompt += `Aturan Kos: ${p.rules.join('; ')}\n`;
  }
  if (primaryKos?.matchScore !== undefined && primaryKos?.matchScore !== null) {
    prompt += `Skor Matching Engine: ${primaryKos.matchScore}%\n`;
  }
  if (primaryKos?.matchReasons?.length) {
    prompt += `Alasan Cocok dari Matching Engine: ${primaryKos.matchReasons.join('; ')}\n`;
  }
  if (primaryKos?.matchTradeoffs?.length) {
    prompt += `Kompromi dari Matching Engine: ${primaryKos.matchTradeoffs.join('; ')}\n`;
  }

  if (comp) {
    prompt += `\n=== DATA KOS PEMBANDING ===\n`;
    prompt += `Nama: ${comp.name}\n`;
    prompt += `Harga: Rp${comp.priceMin?.toLocaleString('id-ID') || comp.pricing?.min?.toLocaleString('id-ID') || '—'}/bulan\n`;
    prompt += `Jarak ke IPB: ${comp.distanceFromIPB ?? '—'} km\n`;
    prompt += `Fasilitas: ${(comp.facilities || []).join(', ') || 'Standar'}\n`;
    if (compareKos?.matchScore !== undefined) {
      prompt += `Skor Matching Engine: ${compareKos.matchScore}%\n`;
    }
  }

  if (prefs || profile?.archetype) {
    prompt += `\n=== PROFIL PREFERENSI MAHASISWA ===\n`;
    if (profile?.archetype?.title) prompt += `Persona: ${profile.archetype.title}\n`;
    if (profile?.studyProgram) prompt += `Jurusan: ${profile.studyProgram}\n`;
    if (prefs?.budgetMax) prompt += `Budget Maksimal: Rp${prefs.budgetMax.toLocaleString('id-ID')}/bulan\n`;
    if (prefs?.maxDistance) prompt += `Jarak Maksimal: ${prefs.maxDistance} km\n`;
    if (prefs?.facilities?.length) prompt += `Fasilitas Prioritas: ${prefs.facilities.join(', ')}\n`;
  } else {
    prompt += `\n(Profil mahasiswa belum diatur secara spesifik. Jawab berdasarkan data listing yang ada.)\n`;
  }

  return prompt;
}

/**
 * Extracts and parses JSON from model output text.
 */
function extractJsonFromText(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // ignore
  }

  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      // ignore
    }
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Handles both standard JSON responses and SSE streaming responses (data: {...}\n\n).
 */
function parseCompletionResponse(rawText) {
  if (!rawText) return null;

  // Case 1: SSE stream chunks (starts with or contains "data: ")
  if (rawText.includes('data:')) {
    let fullContent = '';
    const lines = rawText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const chunk = JSON.parse(jsonStr);
        const delta =
          chunk.choices?.[0]?.delta?.content ||
          chunk.choices?.[0]?.message?.content ||
          '';
        fullContent += delta;
      } catch {
        // ignore chunk parse error
      }
    }
    if (fullContent.trim()) {
      return fullContent;
    }
  }

  // Case 2: Standard JSON object
  try {
    const data = JSON.parse(rawText);
    return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || null;
  } catch {
    return rawText;
  }
}

/**
 * Fetches available models from 9Router to assist when a 404 occurs.
 */
async function fetchAvailableModels(baseUrl, headers) {
  const root = baseUrl.replace(/\/v1.*$/, '').replace(/\/api.*$/, '');
  const testUrls = [
    `${baseUrl}/models`,
    `${root}/v1/models`,
    `${root}/api/v1/models`,
    `${root}/models`,
  ];

  for (const u of testUrls) {
    try {
      const res = await fetch(u, { headers, signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const json = await res.json();
        const list = json?.data || json?.models || json;
        if (Array.isArray(list)) {
          return list.map((m) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
        }
      }
    } catch {
      // try next
    }
  }
  return [];
}

/**
 * Query 9Router / OpenAI-compatible endpoint with automatic fallback for route variations.
 *
 * @param {object} payload
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string} [options.baseUrl]
 * @param {string} [options.model]
 * @returns {Promise<object>} AssistantResponse
 */
export async function query9Router(payload, { apiKey, baseUrl, model }) {
  const cleanKey = (apiKey || '').trim();
  const rawBase = (baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  const selectedModel = (model || DEFAULT_MODEL).trim();

  // Generate candidate URLs to try in order (standard /v1/chat/completions first)
  const cleanBase = rawBase.replace(/\/+$/, '');
  const root = cleanBase.replace(/\/(api\/)?v1.*$/, '');
  const candidateUrls = [
    cleanBase.endsWith('/chat/completions')
      ? cleanBase
      : cleanBase.includes('/v1')
        ? `${cleanBase}/chat/completions`
        : `${root}/v1/chat/completions`,
    `${root}/v1/chat/completions`,
    `${root}/api/v1/chat/completions`,
    `${cleanBase}/chat/completions`,
  ];
  const uniqueUrls = [...new Set(candidateUrls)];

  const userContent = buildUserPrompt(payload);

  const requestBody = {
    model: selectedModel,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    temperature: 0.3,
    max_tokens: 1200,
    stream: false,
  };

  const headers = {
    'Content-Type': 'application/json',
  };
  if (cleanKey) {
    headers['Authorization'] = `Bearer ${cleanKey}`;
  }

  let lastError = null;

  for (const targetUrl of uniqueUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (response.ok) {
        clearTimeout(timeout);
        const rawText = await response.text();
        const messageContent = parseCompletionResponse(rawText);

        if (!messageContent) {
          throw new Error('9Router tidak mengembalikan respons teks.');
        }

        const parsed = extractJsonFromText(messageContent);
        if (!parsed) {
          return {
            summary: messageContent.slice(0, 200),
            reasons: [],
            pros: [],
            cons: [],
            unknowns: ['Format respons AI tidak terstruktur.'],
            nextSteps: ['Tanyakan kembali atau cek langsung listing kos.'],
            disclaimer: 'Dianalisis melalui 9Router AI Gateway.',
            provider: '9router',
          };
        }

        return {
          summary: parsed.summary || 'Berikut hasil analisis kos ini.',
          reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
          pros: Array.isArray(parsed.pros) ? parsed.pros : [],
          cons: Array.isArray(parsed.cons) ? parsed.cons : [],
          unknowns: Array.isArray(parsed.unknowns) ? parsed.unknowns : [],
          nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
          disclaimer: parsed.disclaimer || 'Dianalisis melalui 9Router AI Gateway.',
          provider: '9router',
        };
      }

      // If response is not ok
      const errText = await response.text().catch(() => '');
      clearTimeout(timeout);

      // If 401 Unauthorized
      if (response.status === 401) {
        throw new Error('API Key 9Router tidak valid. Periksa kembali API Key di .env.local.');
      }

      // If 429 Rate limit
      if (response.status === 429) {
        throw new Error('Limit kuota 9Router tercapai atau rate limit aktif. Coba beberapa saat lagi.');
      }

      // If 404
      if (response.status === 404) {
        let parsedErr = null;
        try {
          parsedErr = JSON.parse(errText);
        } catch {
          // HTML 404 page from Next.js means the URL path does not exist; try next candidate
          lastError = new Error(`404 path not found pada ${targetUrl}`);
          continue;
        }

        // It is a valid JSON error returned by 9Router API (e.g. model or provider issue)
        const errMsg = parsedErr?.error?.message || parsedErr?.error || parsedErr?.message;
        if (errMsg) {
          const available = await fetchAvailableModels(rawBase, headers);
          const suggestion = available.length
            ? `\nModel yang tersedia di 9Router Anda:\n- ${available.join('\n- ')}\n\nUbah ROUTER_MODEL di .env.local dengan salah satu model di atas.`
            : `\nPastikan model "${selectedModel}" sudah ditambahkan di dashboard 9Router (http://localhost:20128).`;
          throw new Error(`9Router Error: ${errMsg}.${suggestion}`);
        }

        lastError = new Error(`404 pada ${targetUrl}`);
        continue;
      }

      throw new Error(`9Router Error (${response.status}): ${errText}`);
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error('Permintaan ke 9Router timeout (>25 detik). Silakan coba lagi.');
      }
      if (
        err.message.includes('API Key') ||
        err.message.includes('Limit kuota') ||
        err.message.includes('ROUTER_MODEL')
      ) {
        throw err;
      }
      lastError = err;
    }
  }

  // If all candidates failed
  if (lastError) {
    if (
      lastError.message.includes('ECONNREFUSED') ||
      lastError.message.includes('Failed to fetch') ||
      lastError.message.includes('fetch failed')
    ) {
      throw new Error(
        `Gagal terhubung ke 9Router di ${rawBase}. Pastikan 9Router sedang berjalan (jalankan 'npx 9router').`
      );
    }
    // If it was 404
    if (lastError.message.includes('404')) {
      const available = await fetchAvailableModels(rawBase, headers);
      const modelNote = available.length
        ? `\n\nModel yang terdeteksi di 9Router:\n• ${available.join('\n• ')}\n\nSet ROUTER_MODEL di .env.local dengan salah satu model tersebut.`
        : '';
      throw new Error(
        `Endpoint 9Router 404 Not Found. Pastikan 9Router berjalan dan model "${selectedModel}" sudah aktif di dashboard 9Router (http://localhost:20128).${modelNote}`
      );
    }
    throw lastError;
  }

  throw new Error('Gagal menghubungi 9Router.');
}
