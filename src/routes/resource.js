const express = require('express');
const db = require('../db');
const { validate, SCHEMAS } = require('../schemas');
const { HttpError } = require('../errors');
const { can, requirePerm } = require('../auth');

const inRange = (date, from, to) => (!from || date >= from) && (!to || date <= to);

const byDateDesc = (a, b) =>
  (b.date || '').localeCompare(a.date || '') ||
  (b.time || '').localeCompare(a.time || '') ||
  (b.createdAt || '').localeCompare(a.createdAt || '');

/** Users without `records:all` only see records assigned to them. */
const isVisible = (user, record) => can(user, 'records:all') || (!!record.assignedTo && record.assignedTo === user.id);

/**
 * Generic CRUD router for one collection, guarded by `<name>:read|write|delete`.
 * Optional hooks: beforeSave(data, prev, user) -> data, afterSave(record, prev),
 * beforeDelete(record), afterDelete(record). Hooks may throw HttpError.
 */
function resourceRouter(name, hooks = {}) {
  const router = express.Router();
  const fields = SCHEMAS[name].fields;

  // Who owns the record: Sales always own what they create and can't reassign it.
  function applyAssignment(data, prev, user) {
    if (!('assignedTo' in fields)) return;
    if (!can(user, 'records:assign')) {
      data.assignedTo = prev ? prev.assignedTo || '' : user.id;
    } else if (data.assignedTo && !db.get('users', data.assignedTo)) {
      throw new HttpError(400, 'ไม่พบผู้รับผิดชอบที่เลือก');
    }
    if ('salesperson' in fields) data.salesperson = data.assignedTo ? db.get('users', data.assignedTo)?.name || '' : '';
  }

  function prepare(req, prev) {
    const { data, errors } = validate(name, req.body);
    if (errors.length) throw new HttpError(400, errors.join(' • '), errors);
    applyAssignment(data, prev, req.user);
    return hooks.beforeSave ? hooks.beforeSave(data, prev, req.user) : data;
  }

  function findVisible(req) {
    const record = db.get(name, req.params.id);
    // 404 (not 403) so other people's record ids aren't confirmed.
    if (!record || !isVisible(req.user, record)) throw new HttpError(404, 'ไม่พบข้อมูลที่ต้องการ');
    return record;
  }

  // GET /api/:resource?from=YYYY-MM-DD&to=YYYY-MM-DD
  router.get('/', requirePerm(`${name}:read`), (req, res) => {
    const { from = '', to = '' } = req.query;
    res.json(db.find(name, (r) => inRange(r.date, from, to) && isVisible(req.user, r)).sort(byDateDesc));
  });

  router.get('/:id', requirePerm(`${name}:read`), (req, res) => {
    res.json(findVisible(req));
  });

  router.post('/', requirePerm(`${name}:write`), (req, res) => {
    const record = db.insert(name, prepare(req, null));
    hooks.afterSave?.(record, null);
    res.status(201).json(record);
  });

  router.put('/:id', requirePerm(`${name}:write`), (req, res) => {
    const prev = findVisible(req);
    const record = db.update(name, prev.id, prepare(req, prev));
    hooks.afterSave?.(record, prev);
    res.json(record);
  });

  router.delete('/:id', requirePerm(`${name}:delete`), (req, res) => {
    const record = findVisible(req);
    hooks.beforeDelete?.(record);
    db.remove(name, record.id);
    hooks.afterDelete?.(record);
    res.status(204).end();
  });

  return router;
}

module.exports = { resourceRouter, HttpError, inRange, byDateDesc, isVisible };
