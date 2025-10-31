const Payment = require("../../models/payment/payment.model");
const Booking = require("../../models/booking/booking.model");
const Transaction = require("../../models/transaction/transaction.model");
const { createVnpayUrl, verifyVnpayReturn } = require("../../utils/vnpay");

// ✅ POST /api/payments/vnpay/create
// Body: { amount, orderInfo?, bookingId?, returnUrl }
const createVnpayPayment = async (req, res) => {
  try {
    let { amount, orderInfo, bookingId, returnUrl } = req.body;
    if (!amount || !returnUrl) {
      return res.status(400).json({
        success: false,
        message: "amount and returnUrl are required",
      });
    }
    if (!orderInfo && bookingId) orderInfo = `Booking #${bookingId}`;
    if (!orderInfo) orderInfo = "VNPay Payment";

    let booking = null;
    if (bookingId) {
      booking = await Booking.findOne({ bookingId, user: req.user.id });
      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }
    }

    const vnp_TmnCode = process.env.VNP_TMNCODE || "DEMO";
    const vnp_HashSecret = process.env.VNP_HASHSECRET || "SECRET";
    const vnp_Url =
      process.env.VNP_URL ||
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

    const { paymentUrl, txnRef } = createVnpayUrl({
      amount,
      orderInfo,
      ipAddr: req.ip,
      returnUrl,
      vnp_TmnCode,
      vnp_HashSecret,
      vnp_Url,
    });

    const payment = await Payment.create({
      user: req.user.id,
      booking: booking?._id,
      station: booking?.station,
      method: "vnpay",
      amount,
      status: "init",
      vnpTxnRef: txnRef,
      vnpOrderInfo: orderInfo,
      vnpReturnUrl: returnUrl,
    });

    return res.status(201).json({
      success: true,
      data: { url: paymentUrl, txnRef, paymentId: payment._id },
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// ✅ GET /api/payments/vnpay/return
// → VNPay sẽ redirect về đây sau khi thanh toán
const vnpayReturn = async (req, res) => {
  try {
    console.log("[VNPay Return] Incoming query:", req.query);
    const ok = verifyVnpayReturn(
      { ...req.query },
      process.env.VNP_HASHSECRET || "SECRET"
    );
    const txnRef = req.query.vnp_TxnRef;
    const responseCode = req.query.vnp_ResponseCode;
    console.log("[VNPay Return] verify=", ok, "txnRef=", txnRef, "resp=", responseCode);

    const pay = await Payment.findOne({ vnpTxnRef: txnRef });
    if (!pay) {
      console.warn("[VNPay Return] Payment not found by txnRef:", txnRef);
      return res.status(404).send("<h2>Payment not found</h2>");
    }

    console.log("[VNPay Return] Found Payment:", {
      id: pay._id, status: pay.status, amount: pay.amount, booking: pay.booking, station: pay.station
    });
    pay.vnpResponseCode = responseCode;
    pay.vnpSecureHash = req.query.vnp_SecureHash;
    pay.status = ok && responseCode === "00" ? "success" : "failed";
    await pay.save();
    console.log("[VNPay Return] Payment saved:", { id: pay._id, status: pay.status });

    // Nếu có booking, update paymentStatus
    if (pay.booking && pay.status === "success") {
      console.log("[VNPay Return] Booking present, updating paymentStatus and ensuring Transaction...");
      await Booking.findByIdAndUpdate(pay.booking, { paymentStatus: "paid" });

      // Tạo transaction sau khi thanh toán thành công (idempotent theo booking)
      const existingTxn = await Transaction.findOne({ booking: pay.booking });
      console.log("[VNPay Return] existingTxn:", existingTxn ? existingTxn._id : null);
      if (!existingTxn) {
        const bookingDoc = await Booking.findById(pay.booking).lean();
        console.log("[VNPay Return] Creating Transaction with: ", {
          user: pay.user,
          station: pay.station || bookingDoc?.station,
          vehicle: bookingDoc?.vehicle,
          battery: bookingDoc?.battery,
          booking: pay.booking,
          cost: pay.amount,
        });
        const createdTxn = await Transaction.create({
          user: pay.user,
          station: pay.station || bookingDoc?.station,
          vehicle: bookingDoc?.vehicle || undefined,
          battery: bookingDoc?.battery || undefined,
          booking: pay.booking,
          cost: pay.amount,
        });
        console.log("[VNPay Return] Transaction created successfully:", createdTxn);
      } else {
        console.log("[VNPay Return] Transaction already exists, skipping create.");
      }
    }

    // ✅ Redirect về app Expo (deep link)
    const redirectBase = decodeURIComponent(
      pay.vnpReturnUrl || req.query.vnp_ReturnUrl || ""
    );
    const successLink =
      pay.status === "success"
        ? `${redirectBase}`
        : `${redirectBase}?status=failed`;

    // ⚠️ Nếu FE gửi returnUrl là exp://192.168.1.16:8081/--/payment-success
    // VNPay sẽ redirect về link đó (mở app ngay)
    return res.redirect(successLink);
  } catch (err) {
    return res.status(400).send(`<h3>Error: ${err.message}</h3>`);
  }
};

// ✅ GET /api/payments/vnpay/ipn (callback server-to-server)
const vnpayIpn = async (req, res) => {
  try {
    const method = req.method;
    const params = (req.body && Object.keys(req.body).length > 0) ? { ...req.body } : { ...req.query };
    console.log("[VNPay IPN] Incoming:", { method, originalUrl: req.originalUrl });
    console.log("[VNPay IPN] Headers:", req.headers);
    console.log("[VNPay IPN] Params:", params);

    const ok = verifyVnpayReturn(
      { ...params },
      process.env.VNP_HASHSECRET || "SECRET"
    );

    if (!ok) {
      console.warn("[VNPay IPN] Invalid signature");
      return res
        .status(200)
        .json({ RspCode: "97", Message: "Invalid signature" });
    }

    const txnRef = params.vnp_TxnRef;
    const responseCode = params.vnp_ResponseCode;
    const pay = await Payment.findOne({ vnpTxnRef: txnRef });

    if (!pay) {
      console.warn("[VNPay IPN] Payment not found by txnRef:", txnRef);
      return res
        .status(200)
        .json({ RspCode: "01", Message: "Payment not found" });
    }

    // Cập nhật trạng thái nếu chưa là success
    if (pay.status !== "success") {
      pay.vnpResponseCode = responseCode;
      pay.vnpSecureHash = params.vnp_SecureHash;
      pay.status = responseCode === "00" ? "success" : "failed";
      await pay.save();
      console.log("[VNPay IPN] Payment saved:", { id: pay._id, status: pay.status });
    }

    // Chỉ tạo Transaction khi thanh toán thành công
    if (pay.status === "success" && pay.booking) {
      console.log("[VNPay IPN] Booking present, updating paymentStatus and ensuring Transaction...");
      await Booking.findByIdAndUpdate(pay.booking, { paymentStatus: "paid" });

      // Tạo transaction idempotent theo booking
      let createdTxn = null;
      const existingTxn = await Transaction.findOne({ booking: pay.booking });
      console.log("[VNPay IPN] existingTxn:", existingTxn ? existingTxn._id : null);
      if (!existingTxn) {
        const bookingDoc = await Booking.findById(pay.booking).lean();
        createdTxn = await Transaction.create({
          user: pay.user,
          station: pay.station || bookingDoc?.station,
          vehicle: bookingDoc?.vehicle || undefined,
          battery: bookingDoc?.battery || undefined,
          booking: pay.booking,
          cost: pay.amount,
        });
        console.log("[VNPay IPN] Transaction created successfully:", createdTxn);
      } else {
        console.log("[VNPay IPN] Transaction already exists for booking:", existingTxn._id);
      }
    }

    return res.status(200).json({ RspCode: "00", Message: "Success" });
  } catch (err) {
    console.error("[VNPay IPN] Error:", err);
    return res.status(200).json({ RspCode: "99", Message: "Unknown error" });
  }
};

module.exports = { createVnpayPayment, vnpayReturn, vnpayIpn };
