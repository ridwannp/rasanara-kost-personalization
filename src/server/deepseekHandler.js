/**
 * DeepSeek AI Handler for Kos Decision Assistant
 *
 * Runs on the Node.js server (via Vite dev server middleware).
 * Calls DeepSeek API (deepseek-chat / DeepSeek-V3) with JSON mode.
 * Keeps the DEEPSEEK_API_KEY secure on the server side.
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

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

/**
 * Builds the user prompt containing question and structured context.
 */
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
 * Calls DeepSeek API with JSON mode.
 *
 * @param {object} payload
 * @param {string} apiKey
 * @returns {Promise<object>} AssistantResponse
 */
export async function queryDeepSeek(payload, apiKey) {
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY belum disetel di file .env / .env.local.');
  }

  const userContent = buildUserPrompt(payload);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new Error('DEEPSEEK_API_KEY tidak valid. Periksa kembali kunci API Anda di .env.local.');
      }
      if (response.status === 429) {
        throw new Error('Limit kuota DeepSeek tercapai atau rate limit aktif. Coba beberapa saat lagi.');
      }
      throw new Error(`DeepSeek API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const messageContent = data.choices?.[0]?.message?.content;

    if (!messageContent) {
      throw new Error('DeepSeek tidak mengembalikan respons teks.');
    }

    const parsed = JSON.parse(messageContent);
    return {
      summary: parsed.summary || 'Berikut hasil analisis kos ini.',
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      pros: Array.isArray(parsed.pros) ? parsed.pros : [],
      cons: Array.isArray(parsed.cons) ? parsed.cons : [],
      unknowns: Array.isArray(parsed.unknowns) ? parsed.unknowns : [],
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
      disclaimer: parsed.disclaimer || 'Dianalisis oleh DeepSeek AI berbasis data listing dan profil mahasiswa.',
      provider: 'deepseek',
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Permintaan ke DeepSeek timeout (>25 detik). Silakan coba lagi.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
