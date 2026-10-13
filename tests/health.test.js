require('./helpers');
const request = require('supertest');
const { createApp } = require('../src/app');

test('GET /health', async () => {
  const res = await request(createApp()).get('/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok' });
});

test('bad ObjectId param -> 400', async () => {
  const res = await request(createApp()).get('/__oid/not-an-id');
  expect(res.status).toBe(400);
});

test('malformed JSON body -> 400', async () => {
  const res = await request(createApp())
    .post('/__oid/x')
    .set('Content-Type', 'application/json')
    .send('{bad');
  expect(res.status).toBe(400);
});
