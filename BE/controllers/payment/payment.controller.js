const Payment = require('../../models/payment/payment.model');
const Booking = require('../../models/booking/booking.model');
const { createVnpayUrl, verifyVnpayReturn } = require('../../utils/vnpay');

// POST /api/payments/vnpay/create { amount, orderInfo, bookingId?, returnUrl }
const createVnpayPayment = async (req, res) => {
  try {
    const { amount, orderInfo, bookingId, returnUrl } = req.body;
    if (!amount || !orderInfo || !returnUrl) return res.status(400).json({ success: false, message: 'amount, orderInfo, returnUrl are required' });
    let booking = null;
    if (bookingId) {
      booking = await Booking.findOne({ bookingId, user: req.user.id });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const vnp_TmnCode = process.env.VNP_TMNCODE || 'DEMO';
    const vnp_HashSecret = process.env.VNP_HASHSECRET || 'SECRET';
    const vnp_Url = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const { paymentUrl, txnRef } = createVnpayUrl({ amount, orderInfo, ipAddr: req.ip, returnUrl, vnp_TmnCode, vnp_HashSecret, vnp_Url });
    const payment = await Payment.create({ user: req.user.id, booking: booking?._id, station: booking?.station, method: 'vnpay', amount, status: 'init', vnpTxnRef: txnRef, vnpOrderInfo: orderInfo });
    return res.status(201).json({ success: true, data: { url: paymentUrl, txnRef, payment_id: payment._id } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/payments/vnpay/return : VNPAY return URL
const vnpayReturn = async (req, res) => {
  try {
    const ok = verifyVnpayReturn({ ...req.query }, process.env.VNP_HASHSECRET || 'SECRET');
    const txnRef = req.query.vnp_TxnRef;
    const pay = await Payment.findOne({ vnpTxnRef: txnRef });
    if (!pay) return res.status(404).json({ success: false, message: 'Payment not found' });
    pay.vnpResponseCode = req.query.vnp_ResponseCode;
    pay.vnpSecureHash = req.query.vnp_SecureHash;
    pay.status = ok && req.query.vnp_ResponseCode === '00' ? 'success' : 'failed';
    await pay.save();
    return res.status(200).json({ success: true, data: { status: pay.status, code: req.query.vnp_ResponseCode } });
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
};

// GET /api/payments/vnpay/ipn : VNPAY IPN handler (demo)
const vnpayIpn = async (req, res) => {
  try { const ok = verifyVnpayReturn({ ...req.query }, process.env.VNP_HASHSECRET || 'SECRET'); return res.status(200).json({ RspCode: ok ? '00' : '97', Message: ok ? 'Success' : 'Fail checksum' }); } catch { return res.status(200).json({ RspCode: '99', Message: 'Unknown error' }); }
};

module.exports = { createVnpayPayment, vnpayReturn, vnpayIpn };
