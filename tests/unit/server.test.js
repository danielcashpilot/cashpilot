'use strict';

process.env.ANTHROPIC_API_KEY = 'test-key-for-tests';

const request = require('supertest');
const app     = require('../../server/server.js');

// Mock global fetch so we don't hit real Anthropic API
global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  test('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  test('includes server name', async () => {
    const res = await request(app).get('/health');
    expect(res.body.name).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /analyze
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /analyze', () => {
  const validBody = {
    model:      'claude-sonnet-4-20250514',
    max_tokens: 250,
    messages:   [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
  };

  const mockAnthropicResponse = {
    id:      'msg_test',
    type:    'message',
    role:    'assistant',
    content: [{ type: 'text', text: '{"type":"ביטוח בריאות","company":"פניקס"}' }],
    model:   'claude-sonnet-4-20250514',
  };

  test('proxies request to Anthropic and returns result', async () => {
    global.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => mockAnthropicResponse,
    });

    const res = await request(app)
      .post('/analyze')
      .send(validBody)
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://localhost:3001');

    expect(res.status).toBe(200);
    expect(res.body.content).toBeDefined();
    expect(res.body.content[0].text).toContain('ביטוח בריאות');
  });

  test('sends correct headers to Anthropic', async () => {
    global.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => mockAnthropicResponse,
    });

    await request(app)
      .post('/analyze')
      .send(validBody)
      .set('Origin', 'http://localhost:3001');

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opts.headers['x-api-key']).toBe('test-key-for-tests');
    expect(opts.headers['anthropic-version']).toBeDefined();
    expect(opts.method).toBe('POST');
  });

  test('returns 400 when messages array is missing', async () => {
    const res = await request(app)
      .post('/analyze')
      .send({ model: 'test' })
      .set('Origin', 'http://localhost:3001');

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('returns 400 for empty body', async () => {
    const res = await request(app)
      .post('/analyze')
      .send({})
      .set('Origin', 'http://localhost:3001');

    expect(res.status).toBe(400);
  });

  test('returns 500 when Anthropic fetch throws', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const res = await request(app)
      .post('/analyze')
      .send(validBody)
      .set('Origin', 'http://localhost:3001');

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });

  test('forwards Anthropic error responses', async () => {
    global.fetch.mockResolvedValueOnce({
      status: 401,
      json: async () => ({ error: { type: 'authentication_error', message: 'Invalid API key' } }),
    });

    const res = await request(app)
      .post('/analyze')
      .send(validBody)
      .set('Origin', 'http://localhost:3001');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('rejects requests from unknown origins', async () => {
    const res = await request(app)
      .post('/analyze')
      .send(validBody)
      .set('Origin', 'https://malicious-site.com');

    // CORS error - request should be blocked or fail
    expect([403, 500, 400].includes(res.status) || res.status >= 400).toBe(true);
  });
});
