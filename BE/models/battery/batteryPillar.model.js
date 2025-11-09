const mongoose = require('mongoose');

/**
 * BatteryPillar Model
 * Đại diện cho một trụ pin tại trạm
 * Mỗi trụ có 10 slot để chứa pin
 */
const batteryPillarSchema = new mongoose.Schema({
    pillarCode: {
        type: String,
        trim: true,
        unique: true,
        // Format: STATION_ID-P01, STATION_ID-P02,...
        // Tự động generate trong pre-save hook
    },

    station: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station',
        required: true,
        index: true
    },

    pillarName: {
        type: String,
        required: true,
        trim: true
    },

    // Số thứ tự trụ tại station (1, 2, 3,...)
    pillarNumber: {
        type: Number,
        required: true,
        min: 1
    },

    // Tổng số slot (mặc định 10)
    totalSlots: {
        type: Number,
        default: 10,
        min: 1,
        max: 20
    },

    // Trạng thái trụ
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance', 'error'],
        default: 'active',
        index: true
    },

    // Thống kê slot
    slotStats: {
        total: { type: Number, default: 10 },
        occupied: { type: Number, default: 0 }, // Slot có pin
        empty: { type: Number, default: 10 },   // Slot trống
        reserved: { type: Number, default: 0 }  // Slot đang được đặt
    },

    // Thông tin kỹ thuật
    technicalInfo: {
        model: { type: String, trim: true },
        manufacturer: { type: String, trim: true },
        powerSupply: { type: String, trim: true }, // e.g., "220V AC"
        maxChargingPower: { type: Number, min: 0 }, // kW
    },

    // Ghi chú
    notes: { type: String, trim: true },

    // Ngày bảo trì gần nhất
    lastMaintenanceDate: { type: Date },

    // Ngày bảo trì tiếp theo
    nextMaintenanceDate: { type: Date }

}, { timestamps: true });

// Index phức hợp cho tìm kiếm
batteryPillarSchema.index({ station: 1, pillarNumber: 1 }, { unique: true });
batteryPillarSchema.index({ pillarCode: 1 }, { unique: true });
batteryPillarSchema.index({ status: 1 });

// Virtual để lấy danh sách slots
batteryPillarSchema.virtual('slots', {
    ref: 'BatterySlot',
    localField: '_id',
    foreignField: 'pillar'
});

// Method để cập nhật thống kê slot
batteryPillarSchema.methods.updateSlotStats = async function () {
    const BatterySlot = require('./batterySlot.model');

    const stats = await BatterySlot.aggregate([
        { $match: { pillar: this._id } },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                occupied: {
                    $sum: {
                        $cond: [{ $ne: ['$battery', null] }, 1, 0]
                    }
                },
                reserved: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'reserved'] }, 1, 0]
                    }
                }
            }
        }
    ]);

    if (stats.length > 0) {
        this.slotStats.total = stats[0].total;
        this.slotStats.occupied = stats[0].occupied;
        this.slotStats.reserved = stats[0].reserved;
        this.slotStats.empty = stats[0].total - stats[0].occupied;
    } else {
        // Nếu chưa có slot nào, khởi tạo mặc định
        this.slotStats = {
            total: this.totalSlots,
            occupied: 0,
            empty: this.totalSlots,
            reserved: 0
        };
    }

    await this.save();
    return this;
};

// Method để khởi tạo slots cho trụ mới
batteryPillarSchema.methods.initializeSlots = async function () {
    const BatterySlot = require('./batterySlot.model');

    const slots = [];
    for (let i = 1; i <= this.totalSlots; i++) {
        slots.push({
            pillar: this._id,
            station: this.station,
            slotNumber: i,
            slotCode: `${this.pillarCode}-S${String(i).padStart(2, '0')}`,
            status: 'empty'
        });
    }

    await BatterySlot.insertMany(slots);
    await this.updateSlotStats();

    return this;
};

// Pre-save hook để tạo pillarCode nếu chưa có
batteryPillarSchema.pre('save', async function (next) {
    if (this.isNew && !this.pillarCode) {
        const Station = require('../station/station.model');
        const station = await Station.findById(this.station);
        if (station) {
            this.pillarCode = `${station._id.toString().slice(-6).toUpperCase()}-P${String(this.pillarNumber).padStart(2, '0')}`;
        }
    }
    next();
});

module.exports = mongoose.model('BatteryPillar', batteryPillarSchema);
