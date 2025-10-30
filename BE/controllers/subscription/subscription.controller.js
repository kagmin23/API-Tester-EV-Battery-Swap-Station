const SubscriptionPlan = require('../../models/subscription/subscriptionPlan.model');
const UserSubscription = require('../../models/subscription/userSubscription.model');
const Payment = require('../../models/payment/payment.model');
const { createVnpayUrl } = require('../../utils/vnpay');

const getPlansForUser = async (req, res) => {
  try {
    const status = req.query.status || 'active';
    const plans = await SubscriptionPlan.find({ status });

    // Enhance each plan with availability and the current user's subscription info
    const enhanced = await Promise.all(plans.map(async (plan) => {
      const planObj = plan.toObject();

      // compute active count if quantity_slot is set
      let activeCount = null;
      if (plan.quantity_slot !== null && plan.quantity_slot !== undefined) {
        activeCount = await UserSubscription.countDocuments({ plan: plan._id, status: 'active' });
      }

      // find current user's subscription for this plan (any status)
      let userSub = null;
      if (req.user && req.user.id) {
        userSub = await UserSubscription.findOne({ plan: plan._id, user: req.user.id });
      }

      return {
        ...planObj,
        availableSlots: (plan.quantity_slot !== null && plan.quantity_slot !== undefined) ? Math.max(0, plan.quantity_slot - (activeCount || 0)) : null,
        userSubscription: userSub ? {
          id: userSub._id,
          status: userSub.status,
          remaining_swaps: userSub.remaining_swaps,
          start_date: userSub.start_date,
          end_date: userSub.end_date,
        } : null,
      };
    }));

    return res.status(200).json({ success: true, data: enhanced });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

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

    // Immediately mark as paid and create the UserSubscription record so the driver
    // is considered to have purchased the plan right away. We still return the VNPay URL
    // for compatibility, but payment.status will be set to 'paid' and subscriptionId attached.
    try {
      const existingActive = await UserSubscription.findOne({ plan: plan._id, user: req.user.id, status: 'active' });
      if (existingActive) {
  payment.extra = payment.extra || {};
  payment.extra.subscriptionId = existingActive._id.toString();
  payment.status = 'success';
        await payment.save();
        return res.status(200).json({ success: true, data: { url: paymentUrl, txnRef, paymentId: payment._id, subscriptionId: existingActive._id } });
      }

      const cancelled = await UserSubscription.findOne({ plan: plan._id, user: req.user.id, status: 'cancelled' });
      const start = new Date();
      let end = null;
      if (plan.durations && Number.isFinite(Number(plan.durations))) {
        const d = new Date(start);
        d.setMonth(d.getMonth() + Number(plan.durations));
        end = d;
      }
      const remaining_swaps = (plan.count_swap === null || plan.count_swap === undefined) ? null : plan.count_swap;

      if (cancelled) {
        cancelled.start_date = start;
        cancelled.end_date = end;
        cancelled.remaining_swaps = remaining_swaps;
        cancelled.status = 'active';
        const sub = await cancelled.save();
  payment.extra = payment.extra || {};
  payment.extra.subscriptionId = sub._id.toString();
  payment.status = 'success';
        await payment.save();
        return res.status(201).json({ success: true, data: { url: paymentUrl, txnRef, paymentId: payment._id, subscriptionId: sub._id } });
      }

      // create new subscription
      const sub = await UserSubscription.create({
        user: req.user.id,
        plan: plan._id,
        start_date: start,
        end_date: end,
        remaining_swaps,
        status: 'active',
      });
  payment.extra = payment.extra || {};
  payment.extra.subscriptionId = sub._id.toString();
  payment.status = 'success';
      await payment.save();

      return res.status(201).json({ success: true, data: { url: paymentUrl, txnRef, paymentId: payment._id, subscriptionId: sub._id } });
    } catch (errInner) {
      // If subscription creation fails, keep payment as init and return error (include message for debugging)
      console.error('subscription creation after payment failed:', errInner && errInner.stack ? errInner.stack : errInner);
      // don't expose stack in production; this is for dev/debugging
      const msg = errInner && errInner.message ? errInner.message : 'Failed to create subscription after payment';
      return res.status(500).json({ success: false, message: msg });
    }
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
    const existingActive = await UserSubscription.findOne({ plan: plan._id, user: req.user.id, status: 'active' });
    if (existingActive) {
      return res.status(400).json({ success: false, message: 'User already has an active subscription for this plan' });
    }

    // If user has a cancelled subscription for same plan, reactivate it
    const existingCancelled = await UserSubscription.findOne({ plan: plan._id, user: req.user.id, status: 'cancelled' });
    if (existingCancelled) {
      const start = start_date ? new Date(start_date) : new Date();
      let end = null;
      if (plan.durations && Number.isFinite(Number(plan.durations))) {
        const d = new Date(start);
        d.setMonth(d.getMonth() + Number(plan.durations));
        end = d;
      }
      const remaining_swaps = (plan.count_swap === null || plan.count_swap === undefined) ? null : plan.count_swap;

      existingCancelled.start_date = start;
      existingCancelled.end_date = end;
      existingCancelled.remaining_swaps = remaining_swaps;
      existingCancelled.status = 'active';
      await existingCancelled.save();
      return res.status(200).json({ success: true, data: existingCancelled, message: 'Subscription re-activated' });
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

const confirmPurchase = async (req, res) => {
  try {
    // only drivers can confirm purchases
    if (!req.user || req.user.role !== 'driver') {
      return res.status(403).json({ success: false, message: 'Only drivers can confirm subscription purchases' });
    }

    const { subscriptionId } = req.body || {};
    if (!subscriptionId) return res.status(400).json({ success: false, message: 'subscriptionId is required' });

    const sub = await UserSubscription.findById(subscriptionId);
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

    // ensure the subscription belongs to the authenticated user
    if (sub.user.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not allowed to confirm this subscription' });
    }

    // Only allow transition to 'in-use' from 'active'
    if (sub.status === 'in-use') {
      return res.status(400).json({ success: false, message: 'Subscription is already in-use' });
    }
    if (sub.status !== 'active') {
      return res.status(400).json({ success: false, message: `Subscription cannot be confirmed from status '${sub.status}'` });
    }

    sub.status = 'in-use';
    await sub.save();

    return res.status(200).json({ success: true, data: sub });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  getPlansForUser,
  purchaseSubscription,
  createSubscriptionPayment,
  confirmPurchase,
};
