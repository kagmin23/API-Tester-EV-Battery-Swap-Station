const SubscriptionPlan = require('../../models/subscription/subscriptionPlan.model');
const UserSubscription = require('../../models/subscription/userSubscription.model');
const Payment = require('../../models/payment/payment.model');
const { createVnpayUrl } = require('../../utils/vnpay');

const getPlansForUser = async (req, res) => {
  try {
    const status = req.query.status || 'active';
    const plans = await SubscriptionPlan.find({ status });
    return res.status(200).json({ success: true, data: plans });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Create a VNPay payment for a subscription plan (returns payment URL).
 * Body: { planId, returnUrl }
 */
const createSubscriptionPayment = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'driver') {
      return res.status(403).json({ success: false, message: 'Only drivers can purchase subscriptions' });
    }
    const { planId, returnUrl } = req.body || {};
    if (!planId || !returnUrl) return res.status(400).json({ success: false, message: 'planId and returnUrl are required' });

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    if (plan.status !== 'active') return res.status(400).json({ success: false, message: 'Plan is not active' });

    // Check slot availability
    if (plan.quantity_slot !== null && plan.quantity_slot !== undefined) {
      const activeCount = await UserSubscription.countDocuments({ plan: plan._id, status: 'active' });
      if (activeCount >= plan.quantity_slot) {
        return res.status(400).json({ success: false, message: 'No available slots for this plan' });
      }
    }

    const amount = plan.price;
    const orderInfo = `Subscription purchase: ${plan._id}`;

    const vnp_TmnCode = process.env.VNP_TMNCODE || 'DEMO';
    const vnp_HashSecret = process.env.VNP_HASHSECRET || 'SECRET';
    const vnp_Url = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

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
      method: 'vnpay',
      amount,
      status: 'init',
      vnpTxnRef: txnRef,
      vnpOrderInfo: orderInfo,
      vnpReturnUrl: returnUrl,
      extra: { type: 'subscription', plan: plan._id.toString() },
    });

    return res.status(201).json({ success: true, data: { url: paymentUrl, txnRef, paymentId: payment._id } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const purchaseSubscription = async (req, res) => {
  try {
    // Only drivers may purchase
    if (!req.user || req.user.role !== 'driver') {
      return res.status(403).json({ success: false, message: 'Only drivers can purchase subscriptions' });
    }

    const { planId, start_date } = req.body || {};
    if (!planId) return res.status(400).json({ success: false, message: 'planId is required' });

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    if (plan.status !== 'active') return res.status(400).json({ success: false, message: 'Plan is not active' });

    // Enforce quantity_slot (if set)
    if (plan.quantity_slot !== null && plan.quantity_slot !== undefined) {
      const activeCount = await UserSubscription.countDocuments({ plan: plan._id, status: 'active' });
      if (activeCount >= plan.quantity_slot) {
        return res.status(400).json({ success: false, message: 'No available slots for this plan' });
      }
    }

    // Prevent duplicate active subscription for same user+plan
    const existing = await UserSubscription.findOne({ plan: plan._id, user: req.user.id, status: 'active' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User already has an active subscription for this plan' });
    }

    const start = start_date ? new Date(start_date) : new Date();
    let end = null;
    if (plan.durations && Number.isFinite(Number(plan.durations))) {
      // add months
      const d = new Date(start);
      d.setMonth(d.getMonth() + Number(plan.durations));
      end = d;
    }

    const remaining_swaps = (plan.count_swap === null || plan.count_swap === undefined) ? null : plan.count_swap;

    const sub = await UserSubscription.create({
      user: req.user.id,
      plan: plan._id,
      start_date: start,
      end_date: end,
      remaining_swaps,
      status: 'active',
    });

    return res.status(201).json({ success: true, data: sub });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  getPlansForUser,
  purchaseSubscription,
  createSubscriptionPayment,
};
