const { parsePage, pageResult } = require('../src/lib/pagination');

test('defaults', () => expect(parsePage({})).toEqual({ page: 1, limit: 20, skip: 0 }));

test('clamps', () => {
  expect(parsePage({ page: '-3', limit: '100000' })).toEqual({ page: 1, limit: 100, skip: 0 });
  expect(parsePage({ page: 'abc', limit: 'abc' })).toEqual({ page: 1, limit: 20, skip: 0 });
  expect(parsePage({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, skip: 20 });
});

test('pageResult', () =>
  expect(pageResult([1], 41, { page: 1, limit: 20 })).toEqual({ items: [1], page: 1, limit: 20, total: 41, pages: 3 }));
