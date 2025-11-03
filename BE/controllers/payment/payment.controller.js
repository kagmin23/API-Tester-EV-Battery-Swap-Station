const Payment = require("../../models/payment/payment.model");
const Booking = require("../../models/booking/booking.model");
const Transaction = require("../../models/transaction/transaction.model");
const { createVnpayUrl, verifyVnpayReturn } = require("../../utils/vnpay");

/**
 * Create a VNPay payment URL and initialize payment record
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.amount - Payment amount in VND
 * @param {string} [req.body.orderInfo] - Order description (optional)
 * @param {string} [req.body.bookingId] - ID of the booking (optional)
 * @param {string} req.body.returnUrl - Client deep link to redirect after payment completion
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Payment URL and transaction reference
 */
const createVnpayPayment = async (req, res) => {
  try {
    let { amount, orderInfo, bookingId, returnUrl: clientReturnUrl } = req.body;
    if (!amount || !clientReturnUrl) {
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
    const serverReturnUrl = process.env.VNP_RETURN_URL;

    if (!serverReturnUrl) {
      return res.status(500).json({
        success: false,
        message: "Server return URL is not configured",
      });
    }

    const { paymentUrl, txnRef } = createVnpayUrl({
      amount,
      orderInfo,
      ipAddr: req.ip,
      returnUrl: serverReturnUrl,
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
      vnpReturnUrl: serverReturnUrl,
      clientReturnUrl,
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

const vnpayReturn = async (req, res) => {
  try {
    const ok = verifyVnpayReturn(
      { ...req.query },
      process.env.VNP_HASHSECRET || "SECRET"
    );
    const txnRef = req.query.vnp_TxnRef;
    const responseCode = req.query.vnp_ResponseCode;

    const pay = await Payment.findOne({ vnpTxnRef: txnRef });
    if (!pay) {
      console.warn("[VNPay Return] Payment not found by txnRef:", txnRef);
      return res.status(404).send("<h2>Payment not found</h2>");
    }

    pay.vnpResponseCode = responseCode;
    pay.vnpSecureHash = req.query.vnp_SecureHash;
    pay.status = ok && responseCode === "00" ? "success" : "failed";
    await pay.save();

    if (pay.status === "success") {
      //log successful payment
      console.log("✅ [VNPay Return] Payment successful:", {
        id: pay._id,
        amount: pay.amount,
        booking: pay.booking
      });
    } if (pay.booking && pay.status === "success") {
      await Booking.findByIdAndUpdate(pay.booking, { paymentStatus: "paid" });

      const existingTxn = await Transaction.findOne({ booking: pay.booking });
      if (!existingTxn) {
        const bookingDoc = await Booking.findById(pay.booking).lean();
        const createdTxn = await Transaction.create({
          user: pay.user,
          station: pay.station || bookingDoc?.station,
          vehicle: bookingDoc?.vehicle || undefined,
          battery: bookingDoc?.battery || undefined,
          booking: pay.booking,
          cost: pay.amount,
        });

        //Log transaction created
        console.log("✅ [VNPay Return] Transaction created:", {
          id: createdTxn._id,
          transactionId: createdTxn.transactionId,
          cost: createdTxn.cost
        });
      }
    }

    // If this payment is for a subscription, create UserSubscription (idempotent)
    if (pay.extra && pay.extra.type === 'subscription' && pay.status === 'success') {
      try {
        const UserSubscription = require('../../models/subscription/userSubscription.model');
        const SubscriptionPlan = require('../../models/subscription/subscriptionPlan.model');
        const planId = pay.extra.plan;
        // avoid double-creating if we've already attached a subscription id
        if (!pay.extra.subscriptionId) {
          const plan = await SubscriptionPlan.findById(planId);
          if (plan) {
            // Check slot availability again
            if (plan.quantity_slot !== null && plan.quantity_slot !== undefined) {
              const activeCount = await UserSubscription.countDocuments({ plan: plan._id, status: 'active' });
              if (activeCount >= plan.quantity_slot) {
                // out of slots; mark payment as failed
                pay.status = 'failed';
                await pay.save();
              } else {
                // Prevent duplicate per-user active subscription; if a cancelled subscription exists, reactivate it
                const existingActive = await UserSubscription.findOne({ plan: plan._id, user: pay.user, status: 'active' });
                if (!existingActive) {
                  const cancelled = await UserSubscription.findOne({ plan: plan._id, user: pay.user, status: 'cancelled' });
                  const start = new Date();
                  let end = null;
                  if (plan.durations && Number.isFinite(Number(plan.durations))) {
                    const d = new Date(start);
                    d.setMonth(d.getMonth() + Number(plan.durations));
                    end = d;
                  }
                  const remaining_swaps = (plan.count_swap === null || plan.count_swap === undefined) ? null : plan.count_swap;
                  if (cancelled) {
                    // reactivate cancelled subscription
                    cancelled.start_date = start;
                    cancelled.end_date = end;
                    cancelled.remaining_swaps = remaining_swaps;
                    cancelled.status = 'active';
                    const sub = await cancelled.save();
                    pay.extra = pay.extra || {};
                    pay.extra.subscriptionId = sub._id.toString();
                    await pay.save();
                  } else {
                    const sub = await UserSubscription.create({
                      user: pay.user,
                      plan: plan._id,
                      start_date: start,
                      end_date: end,
                      remaining_swaps,
                      status: 'active',
                    });
                    pay.extra = pay.extra || {};
                    pay.extra.subscriptionId = sub._id.toString();
                    await pay.save();
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        // swallow subscription creation errors but keep payment saved
        console.error('Error creating subscription after vnpay return:', err.message);
      }
    }

    // Redirect về app Expo (deep link)
    const rawRedirect = pay.clientReturnUrl || pay.vnpReturnUrl || req.query.vnp_ReturnUrl || "";
    const redirectBase = rawRedirect ? decodeURIComponent(rawRedirect) : "";
    const successLink =
      pay.status === "success"
        ? `${redirectBase}`
        : `${redirectBase}?status=failed`;

    return res.redirect(successLink);
  } catch (err) {
    return res.status(400).send(`<h3>Error: ${err.message}</h3>`);
  }
};

const vnpayIpn = async (req, res) => {
  try {
    const method = req.method;
    const params = (req.body && Object.keys(req.body).length > 0) ? { ...req.body } : { ...req.query };

    const ok = verifyVnpayReturn(
      { ...params },
      process.env.VNP_HASHSECRET || "SECRET"
    );

    if (!ok) {
      return res
        .status(200)
        .json({ RspCode: "97", Message: "Invalid signature" });
    }

    const txnRef = params.vnp_TxnRef;
    const responseCode = params.vnp_ResponseCode;
    const pay = await Payment.findOne({ vnpTxnRef: txnRef });

    if (!pay) {
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

      if (pay.status === "success") {
        console.log("✅ [VNPay IPN] Payment successful:", {
          id: pay._id,
          amount: pay.amount
        });
      }
    }

    // Chỉ tạo Transaction khi thanh toán thành công
    if (pay.status === "success" && pay.booking) {
      await Booking.findByIdAndUpdate(pay.booking, { paymentStatus: "paid" });

      // Tạo transaction idempotent theo booking
      const existingTxn = await Transaction.findOne({ booking: pay.booking });
      if (!existingTxn) {
        const bookingDoc = await Booking.findById(pay.booking).lean();
        const createdTxn = await Transaction.create({
          user: pay.user,
          station: pay.station || bookingDoc?.station,
          vehicle: bookingDoc?.vehicle || undefined,
          battery: bookingDoc?.battery || undefined,
          booking: pay.booking,
          cost: pay.amount,
        });
        console.log("✅ [VNPay IPN] Transaction created:", {
          id: createdTxn._id,
          transactionId: createdTxn.transactionId,
          cost: createdTxn.cost
        });
      }
    }

    // If this payment is for a subscription via IPN, create subscription similarly
    if (pay.extra && pay.extra.type === 'subscription' && responseCode === '00') {
      try {
        const UserSubscription = require('../../models/subscription/userSubscription.model');
        const SubscriptionPlan = require('../../models/subscription/subscriptionPlan.model');
        const planId = pay.extra.plan;
        // idempotent: skip if we've already created subscription
        if (!pay.extra.subscriptionId) {
          const plan = await SubscriptionPlan.findById(planId);
          if (plan) {
            const start = new Date();
            let end = null;
            if (plan.durations && Number.isFinite(Number(plan.durations))) {
              const d = new Date(start);
              d.setMonth(d.getMonth() + Number(plan.durations));
              end = d;
            }
            const remaining_swaps = (plan.count_swap === null || plan.count_swap === undefined) ? null : plan.count_swap;
            const existingActive = await UserSubscription.findOne({ plan: plan._id, user: pay.user, status: 'active' });
            if (!existingActive) {
              const cancelled = await UserSubscription.findOne({ plan: plan._id, user: pay.user, status: 'cancelled' });
              if (cancelled) {
                cancelled.start_date = start;
                cancelled.end_date = end;
                cancelled.remaining_swaps = remaining_swaps;
                cancelled.status = 'active';
                const sub = await cancelled.save();
                pay.extra = pay.extra || {};
                pay.extra.subscriptionId = sub._id.toString();
                await pay.save();
              } else {
                const sub = await UserSubscription.create({
                  user: pay.user,
                  plan: plan._id,
                  start_date: start,
                  end_date: end,
                  remaining_swaps,
                  status: 'active',
                });
                pay.extra = pay.extra || {};
                pay.extra.subscriptionId = sub._id.toString();
                await pay.save();
              }
            }
          }
        }
      } catch (err) {
        console.error('Error creating subscription after vnpay ipn:', err.message);
      }
    }

    return res.status(200).json({ RspCode: "00", Message: "Success" });
  } catch (err) {
    console.error("[VNPay IPN] Error:", err);
    return res.status(200).json({ RspCode: "99", Message: "Unknown error" });
  }
};

const getVnpayPaymentStatus = async (req, res) => {
  try {
    const { paymentId, txnRef } = req.query;

    if (!paymentId && !txnRef) {
      return res.status(400).json({
        success: false,
        message: "paymentId or txnRef is required",
      });
    }

    const criteria = paymentId ? { _id: paymentId } : { vnpTxnRef: txnRef };
    const paymentDoc = await Payment.findOne(criteria)
      .populate({ path: "booking", select: "bookingId paymentStatus user station" })
      .populate({ path: "station", select: "name code" });

    if (!paymentDoc) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const isOwner = paymentDoc.user?.toString() === req.user.id;
    const privilegedRoles = ["admin", "staff"];
    const isPrivileged = req.user && privilegedRoles.includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const bookingRef = paymentDoc.booking && paymentDoc.booking._id ? paymentDoc.booking._id : paymentDoc.booking;
    let transactionDoc = null;
    if (bookingRef) {
      transactionDoc = await Transaction.findOne({ booking: bookingRef }).lean();
    }

    const payment = paymentDoc.toObject({ virtuals: true });
    const response = {
      paymentId: payment._id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      vnpTxnRef: payment.vnpTxnRef,
      vnpResponseCode: payment.vnpResponseCode,
      clientReturnUrl: payment.clientReturnUrl,
      vnpReturnUrl: payment.vnpReturnUrl,
      hasTransaction: !!transactionDoc,
      booking: payment.booking
        ? {
          id: payment.booking._id,
          bookingId: payment.booking.bookingId,
          paymentStatus: payment.booking.paymentStatus,
        }
        : null,
      transaction: transactionDoc
        ? {
          id: transactionDoc._id,
          transactionId: transactionDoc.transactionId,
          cost: transactionDoc.cost,
          createdAt: transactionDoc.createdAt,
        }
        : null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };

    return res.status(200).json({ success: true, data: response });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = { createVnpayPayment, vnpayReturn, vnpayIpn, getVnpayPaymentStatus };
