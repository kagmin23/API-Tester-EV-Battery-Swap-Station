const mongoose = require('mongoose');

/**
 * BatterySlot Model
 * Đại diện cho một slot (ô chứa) trong trụ pin
 * Mỗi trụ có 10 slot
 */
const batterySlotSchema = new mongoose.Schema({
    slotCode: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        // Format: PILLAR_CODE-S01, PILLAR_CODE-S02,...
    },

    pillar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BatteryPillar',
        required: true,
        index: true
    },

    station: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station',
        required: true,
        index: true
    },

    // Số thứ tự slot trong trụ (1-10)
    slotNumber: {
        type: Number,
        required: true,
        min: 1,
        max: 20
    },

    // Pin hiện tại trong slot (null nếu trống)
    battery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Battery',
        default: null,
        index: true
    },

    // Trạng thái slot
    status: {
        type: String,
        enum: ['empty', 'occupied', 'reserved', 'locked', 'maintenance', 'error'],
        default: 'empty',
        index: true
    },

    // Vị trí trong UI (để FE hiển thị)
    position: {
        row: { type: Number, min: 1, max: 10 }, // Hàng (1-10 cho 10 slots)
        column: { type: Number, default: 1 }     // Cột (mặc định 1)
    },

    // Thông tin đặt chỗ (nếu có)
    reservation: {
        booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reservedAt: { type: Date },
        expiresAt: { type: Date }
    },

    // Lịch sử hoạt động gần nhất
    lastActivity: {
        action: {
            type: String,
            enum: ['insert', 'remove', 'swap', 'reserve', 'cancel']
        },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        battery: { type: mongoose.Schema.Types.ObjectId, ref: 'Battery' },
        timestamp: { type: Date }
    },

    // Cờ đánh dấu slot luôn trống (slot dành cho việc bỏ pin cũ vào)
    isAlwaysEmpty: {
        type: Boolean,
        default: false
    },

    // Ghi chú
    notes: { type: String, trim: true }

}, { timestamps: true });

// Index phức hợp
batterySlotSchema.index({ pillar: 1, slotNumber: 1 }, { unique: true });
batterySlotSchema.index({ station: 1, status: 1 });
batterySlotSchema.index({ battery: 1 });

// Virtual để kiểm tra slot có trống không
batterySlotSchema.virtual('isEmpty').get(function () {
    return this.battery === null && this.status === 'empty';
});

// Virtual để kiểm tra slot có thể sử dụng không
batterySlotSchema.virtual('isAvailable').get(function () {
    return this.status === 'empty' || (this.status === 'occupied' && this.battery !== null);
});

// Method để đặt chỗ slot
batterySlotSchema.methods.reserve = async function (bookingId, userId, expirationMinutes = 15) {
    if (this.status !== 'empty' && this.status !== 'occupied') {
        throw new Error(`Slot ${this.slotCode} không thể đặt chỗ. Trạng thái hiện tại: ${this.status}`);
    }

    this.status = 'reserved';
    this.reservation = {
        booking: bookingId,
        user: userId,
        reservedAt: new Date(),
        expiresAt: new Date(Date.now() + expirationMinutes * 60 * 1000)
    };

    await this.save();

    // Cập nhật thống kê trụ
    const BatteryPillar = require('./batteryPillar.model');
    const pillar = await BatteryPillar.findById(this.pillar);
    if (pillar) {
        await pillar.updateSlotStats();
    }

    return this;
};

// Method để hủy đặt chỗ
batterySlotSchema.methods.cancelReservation = async function () {
    const previousStatus = this.battery ? 'occupied' : 'empty';
    this.status = previousStatus;
    this.reservation = undefined;

    await this.save();

    // Cập nhật thống kê trụ
    const BatteryPillar = require('./batteryPillar.model');
    const pillar = await BatteryPillar.findById(this.pillar);
    if (pillar) {
        await pillar.updateSlotStats();
    }

    return this;
};

// Method để đặt pin vào slot
batterySlotSchema.methods.insertBattery = async function (batteryId, userId = null) {
    if (this.battery !== null) {
        throw new Error(`Slot ${this.slotCode} đã có pin`);
    }

    this.battery = batteryId;
    this.status = 'occupied';
    this.lastActivity = {
        action: 'insert',
        user: userId,
        battery: batteryId,
        timestamp: new Date()
    };

    // Xóa reservation nếu có
    this.reservation = undefined;

    await this.save();

    // Cập nhật vị trí pin
    const Battery = require('./battery.model');
    await Battery.findByIdAndUpdate(batteryId, {
        currentSlot: this._id,
        currentPillar: this.pillar,
        station: this.station
    });

    // Cập nhật thống kê trụ
    const BatteryPillar = require('./batteryPillar.model');
    const pillar = await BatteryPillar.findById(this.pillar);
    if (pillar) {
        await pillar.updateSlotStats();
    }

    return this;
};

// Method để lấy pin ra khỏi slot
batterySlotSchema.methods.removeBattery = async function (userId = null) {
    if (this.battery === null) {
        throw new Error(`Slot ${this.slotCode} đang trống`);
    }

    const batteryId = this.battery;

    this.lastActivity = {
        action: 'remove',
        user: userId,
        battery: batteryId,
        timestamp: new Date()
    };

    this.battery = null;
    this.status = 'empty';

    await this.save();

    const Battery = require('./battery.model');
    await Battery.findByIdAndUpdate(batteryId, {
        currentSlot: null,
        currentPillar: null
    });

    // Cập nhật thống kê trụ
    const BatteryPillar = require('./batteryPillar.model');
    const pillar = await BatteryPillar.findById(this.pillar);
    if (pillar) {
        await pillar.updateSlotStats();
    }

    return batteryId;
};

// Method để swap pin (người dùng bỏ pin cũ vào, lấy pin mới ra)
batterySlotSchema.methods.swapBattery = async function (newBatteryId, oldBatteryId, userId = null) {
    this.lastActivity = {
        action: 'swap',
        user: userId,
        battery: newBatteryId,
        timestamp: new Date()
    };

    // Lưu thông tin pin cũ
    const oldBattery = this.battery;

    // Đổi pin
    this.battery = newBatteryId;
    this.status = 'occupied';
    this.reservation = undefined;

    await this.save();

    // Cập nhật vị trí pin mới
    const Battery = require('./battery.model');
    await Battery.findByIdAndUpdate(newBatteryId, {
        currentSlot: this._id,
        currentPillar: this.pillar,
        station: this.station,
        status: 'in-use' // Pin mới đang được người dùng sử dụng
    });

    // Cập nhật pin cũ
    if (oldBattery) {
        await Battery.findByIdAndUpdate(oldBattery, {
            currentSlot: null,
            currentPillar: null,
            status: 'idle' // Pin cũ trả lại sẽ chuyển sang idle để chờ sạc
        });
    }

    return this;
};

// Middleware: Tự động hủy reservation hết hạn
batterySlotSchema.pre('save', function (next) {
    if (this.reservation && this.reservation.expiresAt && this.reservation.expiresAt < new Date()) {
        this.status = this.battery ? 'occupied' : 'empty';
        this.reservation = undefined;
    }
    next();
});

// Middleware: Cập nhật thống kê khi slot thay đổi
batterySlotSchema.post(['save', 'findOneAndUpdate', 'findOneAndDelete'], async function (doc) {
    if (doc && doc.pillar) {
        const BatteryPillar = require('./batteryPillar.model');
        const pillar = await BatteryPillar.findById(doc.pillar);
        if (pillar) {
            await pillar.updateSlotStats();
        }
    }
});

module.exports = mongoose.model('BatterySlot', batterySlotSchema);
