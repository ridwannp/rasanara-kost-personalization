import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  askAssistant,
  sanitizeProfile,
  sanitizeKos,
  generateMockResponse,
  AI_IS_MOCK
} from '../aiAssistantService.js';

describe('AI Kos Decision Assistant Service', () => {
  const sampleProfile = {
    id: 'user-123',
    name: 'Budi Santoso',
    studyProgram: 'Ilmu Komputer',
    contact: {
      whatsapp: '081234567890',
      email: 'budi@apps.ipb.ac.id'
    },
    preferences: {
      budgetMin: 800000,
      budgetMax: 1500000,
      maxDistance: 2.5,
      gender: 'putra',
      facilities: ['wifi', 'ac', 'bathroom_inside'],
      lifestyle: {
        environmentPref: 'quiet',
        afterClass: 'rest'
      }
    },
    archetype: {
      title: 'The Focused Scholar'
    }
  };

  const samplePrimaryKos = {
    property: {
      id: 'kos-1',
      name: 'Wisma Mahasiswa Dramaga',
      priceMin: 1200000,
      pricing: { min: 1200000, max: 1500000 },
      distanceFromIPB: 1.2,
      gender: 'putra',
      facilities: ['wifi', 'ac', 'bathroom_inside'],
      environment: { noiseLevel: 'low' },
      verified: true,
      rating: 4.8,
      reviewCount: 15,
      availability: { availableRooms: 2 },
      owner: {
        name: 'Pak Haji',
        whatsapp: '089876543210'
      }
    },
    matchScore: 92,
    matchReasons: ['Harga sesuai budget', 'Fasilitas WiFi & AC lengkap', 'Dekat kampus (< 2 km)'],
    matchTradeoffs: []
  };

  const sampleCompareKos = {
    property: {
      id: 'kos-2',
      name: 'Kos Asri Dramaga',
      priceMin: 900000,
      pricing: { min: 900000, max: 1100000 },
      distanceFromIPB: 2.0,
      gender: 'putra',
      facilities: ['wifi', 'bathroom_inside'],
      environment: { noiseLevel: 'moderate' },
      verified: false,
      rating: 4.2,
      reviewCount: 6,
      availability: { availableRooms: 1 },
      owner: {
        name: 'Bu Sri',
        whatsapp: '081122334455'
      }
    },
    matchScore: 78,
    matchReasons: ['Harga sangat hemat', 'Kamar mandi dalam'],
    matchTradeoffs: ['Tidak ada AC', 'Jarak lebih jauh (2.0 km)']
  };

  describe('1. Context mapping and privacy sanitization', () => {
    it('strips PII from user profile (no phone, no email, no full name)', () => {
      const sanitized = sanitizeProfile(sampleProfile);
      assert.strictEqual(sanitized.name, undefined);
      assert.strictEqual(sanitized.contact, undefined);
      assert.strictEqual(sanitized.id, undefined);
      assert.strictEqual(sanitized.archetype, 'The Focused Scholar');
      assert.strictEqual(sanitized.studyProgram, 'Ilmu Komputer');
      assert.strictEqual(sanitized.preferences.budgetMax, 1500000);
      assert.deepStrictEqual(sanitized.preferences.facilities, ['wifi', 'ac', 'bathroom_inside']);
    });

    it('handles null or undefined profile safely', () => {
      assert.strictEqual(sanitizeProfile(null), null);
      assert.strictEqual(sanitizeProfile(undefined), null);
    });

    it('strips owner contact information from kos data', () => {
      const sanitized = sanitizeKos(samplePrimaryKos);
      assert.strictEqual(sanitized.owner, undefined);
      assert.strictEqual(sanitized.id, 'kos-1');
      assert.strictEqual(sanitized.name, 'Wisma Mahasiswa Dramaga');
      assert.strictEqual(sanitized.matchScore, 92);
      assert.strictEqual(sanitized.price, 1200000);
    });

    it('handles null or empty kos context safely', () => {
      assert.strictEqual(sanitizeKos(null), null);
      assert.strictEqual(sanitizeKos({}), null);
    });
  });

  describe('2. Quick suggested questions & mock generation', () => {
    it('answers "why" match question using real matching score & reasons', () => {
      const res = generateMockResponse('Kenapa kos ini cocok buat saya?', samplePrimaryKos, null, sampleProfile);
      assert.ok(res.summary.includes('92%'));
      assert.ok(res.reasons.length > 0);
      assert.ok(res.pros.length > 0);
      assert.ok(res.unknowns.length > 0);
      assert.ok(res.nextSteps.length > 0);
      assert.ok(res.disclaimer.includes('preferensimu'));
    });

    it('answers "cons / tradeoffs" question highlighting weaknesses', () => {
      const kosWithTradeoff = {
        ...samplePrimaryKos,
        matchTradeoffs: ['Harga mendekati batas atas budgetmu']
      };
      const res = generateMockResponse('Apa kekurangan kos ini?', kosWithTradeoff, null, sampleProfile);
      assert.ok(res.summary);
      assert.ok(res.cons.length > 0);
      assert.ok(res.unknowns.length > 0);
      assert.ok(res.nextSteps.length > 0);
    });

    it('answers "comparison" between two saved kos', () => {
      const res = generateMockResponse('Bandingkan dengan kos lain yang saya simpan.', samplePrimaryKos, sampleCompareKos, sampleProfile);
      assert.ok(res.summary.includes('Wisma Mahasiswa Dramaga'));
      assert.ok(res.summary.includes('Kos Asri Dramaga'));
      assert.ok(res.pros.length > 0);
      assert.ok(res.unknowns.length > 0);
      assert.ok(res.nextSteps.length > 0);
    });

    it('answers "checklist" before renting question', () => {
      const res = generateMockResponse('Apa yang perlu saya pastikan sebelum menyewa?', samplePrimaryKos, null, sampleProfile);
      assert.ok(res.summary);
      assert.ok(res.nextSteps.length > 0);
      assert.ok(res.unknowns.length > 0);
    });
  });

  describe('3. Empty and unverified data handling', () => {
    it('handles missing student profile gracefully without fabricating data', () => {
      const res = generateMockResponse('Kenapa kos ini cocok buat saya?', samplePrimaryKos, null, null);
      assert.ok(res.disclaimer.includes('Tanpa profil preferensi'));
      assert.ok(res.summary.includes('Wisma Mahasiswa Dramaga'));
    });

    it('identifies unverified availability and unknown daily environment', () => {
      const unverifiedKos = {
        ...samplePrimaryKos,
        property: {
          ...samplePrimaryKos.property,
          availability: { availableRooms: null },
          environment: { noiseLevel: 'unknown' }
        }
      };
      const res = generateMockResponse('Apa kekurangan kos ini?', unverifiedKos, null, null);
      assert.ok(res.unknowns.some((u) => u.toLowerCase().includes('belum') || u.toLowerCase().includes('terdata')));
    });
  });

  describe('4. Input validation and error handling', () => {
    it('rejects empty question', async () => {
      await assert.rejects(
        () => askAssistant({ question: '   ', primaryKos: samplePrimaryKos }),
        /Pertanyaan tidak boleh kosong/
      );
    });

    it('rejects excessively long question', async () => {
      const longQuestion = 'a'.repeat(401);
      await assert.rejects(
        () => askAssistant({ question: longQuestion, primaryKos: samplePrimaryKos }),
        /Pertanyaan terlalu panjang/
      );
    });

    it('rejects when primary kos data is missing', async () => {
      await assert.rejects(
        () => askAssistant({ question: 'Bagus tidak?', primaryKos: null }),
        /Data kos tidak tersedia/
      );
    });
  });

  describe('5. Mock and development mode transparency', () => {
    it('is explicitly flagged as mock mode', () => {
      assert.strictEqual(AI_IS_MOCK, true);
    });
  });
});
