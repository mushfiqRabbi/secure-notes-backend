const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function parsePage(query = {}) {
  const p = parseInt(query.page, 10);
  const l = parseInt(query.limit, 10);
  const page = Number.isFinite(p) && p > 0 ? p : 1;
  const limit = Number.isFinite(l) && l > 0 ? Math.min(l, MAX_LIMIT) : DEFAULT_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
}

const pageResult = (items, total, { page, limit }) => ({
  items,
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

module.exports = { parsePage, pageResult };
