const express = require('express');
const db = require('../db');
const { OPTIONS } = require('../schemas');
const { resourceRouter, HttpError } = require('./resource');
const dashboardRouter = require('./dashboard');
const usersRouter = require('./users');

const transferOf = (bookingId) => db.find('transfers', (t) => t.bookingId === bookingId)[0] || null;

function setBookingStatus(bookingId, status) {
  if (db.get('bookings', bookingId)) db.update('bookings', bookingId, { status });
}

// Booking details copied onto the transfer so the transfer table reads on its own.
const bookingSnapshot = (b) => ({
  name: b.name,
  phone: b.phone,
  project: b.project,
  plot: b.plot,
  price: b.price,
  deposit: b.deposit,
  paymentMethod: b.paymentMethod,
  bookingDate: b.date,
  assignedTo: b.assignedTo || '',
});

const bookingHooks = {
  beforeSave(data, prev) {
    const walkin = data.walkinId ? db.get('walkins', data.walkinId) : null;
    if (!walkin) data.walkinId = '';
    // A booking from a walk-in stays with that walk-in's salesperson unless chosen otherwise.
    if (!data.assignedTo && walkin) data.assignedTo = walkin.assignedTo || '';
    if (data.deposit > data.price) throw new HttpError(400, 'จำนวนเงินจองต้องไม่เกินราคาแปลงที่จอง');
    // "โอนแล้ว" is owned by the transfer workflow; the form can only book or cancel.
    if (prev && transferOf(prev.id)) data.status = 'โอนแล้ว';
    else data.status = data.status === 'ยกเลิก' ? 'ยกเลิก' : 'จองแล้ว';
    return data;
  },
  afterSave(record) {
    const transfer = transferOf(record.id);
    if (transfer) db.update('transfers', transfer.id, bookingSnapshot(record));
  },
  beforeDelete(record) {
    if (transferOf(record.id)) {
      throw new HttpError(409, 'รายการจองนี้มีการโอนกรรมสิทธิ์แล้ว กรุณาลบรายการโอนก่อน');
    }
  },
};

const transferHooks = {
  beforeSave(data, prev) {
    const booking = db.get('bookings', data.bookingId);
    if (!booking) throw new HttpError(400, 'ไม่พบรายการจองที่เลือก');
    const existing = transferOf(booking.id);
    if (existing && existing.id !== prev?.id) throw new HttpError(409, 'รายการจองนี้ถูกบันทึกการโอนไปแล้ว');
    if (booking.status === 'ยกเลิก') throw new HttpError(409, 'ไม่สามารถโอนรายการจองที่ถูกยกเลิกได้');
    return { ...data, ...bookingSnapshot(booking) };
  },
  afterSave(record, prev) {
    if (prev && prev.bookingId !== record.bookingId) setBookingStatus(prev.bookingId, 'จองแล้ว');
    setBookingStatus(record.bookingId, 'โอนแล้ว');
  },
  afterDelete(record) {
    setBookingStatus(record.bookingId, 'จองแล้ว');
  },
};

const router = express.Router();

router.get('/options', (req, res) => res.json(OPTIONS));
router.use('/dashboard', dashboardRouter);
router.use('/users', usersRouter);
router.use('/leads', resourceRouter('leads'));
router.use('/walkins', resourceRouter('walkins'));
router.use('/bookings', resourceRouter('bookings', bookingHooks));
router.use('/transfers', resourceRouter('transfers', transferHooks));

module.exports = router;
