import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { query9Router } from '../../server/routerHandler.js';

describe('9Router Handler Unit Tests', () => {
  it('throws a connection error if 9Router endpoint is unreachable', async () => {
    await assert.rejects(
      () =>
        query9Router(
          { question: 'Halo' },
          { apiKey: 'sk-test', baseUrl: 'http://127.0.0.1:59999/v1', model: 'deepseek-chat' }
        ),
      /Gagal terhubung ke 9Router/
    );
  });
});
