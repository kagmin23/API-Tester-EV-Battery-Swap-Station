const SubscriptionPlan = require('../../models/subscription/subscriptionPlan.model');
const Battery = require('../../models/battery/battery.model');
const BatterySlot = require('../../models/battery/batterySlot.model');

/**
 * Try create a reservation for a given UserSubscription
 * Returns { ok: true, details } on success or { ok:false, reason }
 */
async function createReservationForSubscription(sub) {
  if (!sub) return { ok: false, reason: 'no-sub' };

  const plan = await SubscriptionPlan.findById(sub.plan);
  if (!plan) return { ok: false, reason: 'no-plan' };
  if (plan.type !== 'periodic') return { ok: false, reason: 'plan-not-periodic' };

  if (!sub.station) return { ok: false, reason: 'no-station' };

  // find best candidate battery at station: prefer highest SOH
  const candidates = await Battery.find({ station: sub.station, status: { $in: ['idle', 'full'] }, currentSlot: { $ne: null } })
    .sort({ soh: -1 })
    .limit(10)
    .populate('currentSlot')
    .exec();

  if (!candidates || candidates.length === 0) return { ok: false, reason: 'no-battery-available' };

  // pick first candidate whose slot is not reserved or reserved by same user
  let chosen = null;
  for (const b of candidates) {
    const slot = b.currentSlot;
    if (!slot) continue;
    // skip if slot already reserved by other user and reservation not expired
    const slotRes = slot.reservation;
    if (slot.status === 'occupied') {
      if (!slotRes || !slotRes.user) {
        chosen = { battery: b, slot };
        break;
      }
      // if reserved by same user, allow
      if (slotRes.user && slotRes.user.toString() === sub.user.toString()) {
        chosen = { battery: b, slot };
        break;
      }
    }
  }

  if (!chosen) return { ok: false, reason: 'no-suitable-slot' };

  const now = new Date();
  // expires at end of day (server local)
  const expires = new Date(now);
  expires.setHours(23, 59, 59, 999);

  try {
    // mark battery as is-booking
    await Battery.findByIdAndUpdate(chosen.battery._id, { status: 'is-booking' });

    // set slot reservation
    await BatterySlot.findByIdAndUpdate(chosen.slot._id, {
      status: 'reserved',
      reservation: {
        booking: null,
        user: sub.user,
        reservedAt: now,
        expiresAt: expires
      }
    });

    // update subscription's last_reserved_month
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    sub.last_reserved_month = ym;
    await sub.save();

    return { ok: true, details: { battery: chosen.battery._id, slot: chosen.slot._id } };
  } catch (err) {
    return { ok: false, reason: 'exception', error: err.message || err };
  }
}

module.exports = { createReservationForSubscription };
