const mongoose = require('mongoose');

/**
 * BatterySwapHistory Model
 * Lưu lịch sử các lần đổi pin
 */
const batterySwapHistorySchema = new mongoose.Schema({
    // Thông tin giao dịch
    swapId: {
        type: String,
        unique: true,
        required: true,
        default: () => `SWAP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    },

    // Người dùng
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Xe
    vehicle: {
        type: String,
        ref: 'Vehicle',
        required: true
    },

    // Trạm
    station: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station',
        required: true,
        index: true
    },

    // Trụ pin
    pillar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BatteryPillar',
        required: true
    },

    // Slot được sử dụng
    slot: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BatterySlot',
        required: true
    },

    // Pin cũ (người dùng trả lại) - Chỉ có sau khi insertOldBattery
    oldBattery: {
        battery: { type: mongoose.Schema.Types.ObjectId, ref: 'Battery' }, // ✅ Bỏ required
        soh: { type: Number, min: 0, max: 100 },
        chargeLevel: { type: Number, min: 0, max: 100 }, // % pin còn lại
        status: { type: String }
    },

    // Pin mới (người dùng nhận được)
    newBattery: {
        battery: { type: mongoose.Schema.Types.ObjectId, ref: 'Battery', required: true },
        soh: { type: Number, min: 0, max: 100 },
        chargeLevel: { type: Number, min: 0, max: 100, default: 100 },
        status: { type: String }
    },

    // Thông tin booking (nếu có)
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    },

    // Subscription (nếu có)
    subscription: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserSubscription'
    },

    // Thời gian
    swapTime: {
        type: Date,
        default: Date.now,
        index: true
    },

    // Thời gian hoàn thành
    completedAt: {
        type: Date
    },

    // Trạng thái giao dịch
    status: {
        type: String,
        enum: ['initiated', 'in-progress', 'completed', 'failed', 'cancelled'],
        default: 'initiated',
        index: true
    },

    // Ghi chú
    notes: { type: String, trim: true }

}, { timestamps: true });

// Index
batterySwapHistorySchema.index({ user: 1, swapTime: -1 });
batterySwapHistorySchema.index({ station: 1, swapTime: -1 });
batterySwapHistorySchema.index({ status: 1, swapTime: -1 });

// Method để hoàn thành giao dịch swap
batterySwapHistorySchema.methods.complete = async function () {
    this.status = 'completed';
    this.completedAt = new Date();
    await this.save();
    return this;
};

// Method để hủy giao dịch swap
batterySwapHistorySchema.methods.cancel = async function (reason) {
    this.status = 'cancelled';
    this.notes = reason || 'Giao dịch bị hủy';

    await this.save();
    return this;
};

// Static method để lấy thống kê swap theo trạm
batterySwapHistorySchema.statics.getStationStats = async function (stationId, startDate, endDate) {
    const matchConditions = {
        station: mongoose.Types.ObjectId(stationId),
        status: 'completed'
    };

    if (startDate || endDate) {
        matchConditions.swapTime = {};
        if (startDate) matchConditions.swapTime.$gte = new Date(startDate);
        if (endDate) matchConditions.swapTime.$lte = new Date(endDate);
    }

    const stats = await this.aggregate([
        { $match: matchConditions },
        {
            $group: {
                _id: null,
                totalSwaps: { $sum: 1 }
            }
        }
    ]);

    return stats[0] || {
        totalSwaps: 0
    };
};

// Static method để lấy thống kê swap theo user
batterySwapHistorySchema.statics.getUserStats = async function (userId, startDate, endDate) {
    const matchConditions = {
        user: mongoose.Types.ObjectId(userId),
        status: 'completed'
    };

    if (startDate || endDate) {
        matchConditions.swapTime = {};
        if (startDate) matchConditions.swapTime.$gte = new Date(startDate);
        if (endDate) matchConditions.swapTime.$lte = new Date(endDate);
    }

    const stats = await this.aggregate([
        { $match: matchConditions },
        {
            $group: {
                _id: null,
                totalSwaps: { $sum: 1 },
                favoriteStation: { $first: '$station' }
            }
        }
    ]);

    return stats[0] || {
        totalSwaps: 0,
        favoriteStation: null
    };
};

module.exports = mongoose.model('BatterySwapHistory', batterySwapHistorySchema);
