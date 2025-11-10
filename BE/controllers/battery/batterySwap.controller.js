const BatteryPillar = require('../../models/battery/batteryPillar.model');
const BatterySlot = require('../../models/battery/batterySlot.model');
const Battery = require('../../models/battery/battery.model');
const BatterySwapHistory = require('../../models/battery/batterySwapHistory.model');
const Station = require('../../models/station/station.model');
const Booking = require('../../models/booking/booking.model');

// Create new battery pillar for station
const createPillar = async (req, res) => {
    try {
        const { stationId, pillarName, pillarNumber, totalSlots } = req.body;

        // Check if station exists
        const station = await Station.findById(stationId);
        if (!station) {
            return res.status(404).json({ message: 'Station not found' });
        }

        // Check if pillar number already exists
        const existingPillar = await BatteryPillar.findOne({
            station: stationId,
            pillarNumber
        });
        if (existingPillar) {
            return res.status(400).json({ message: 'Pillar number already exists' });
        }

        // Create new pillar
        const pillar = new BatteryPillar({
            station: stationId,
            pillarName,
            pillarNumber,
            totalSlots: totalSlots || 10
        });

        await pillar.save();

        // Initialize slots for the pillar
        await pillar.initializeSlots();

        // Update station info
        await station.updatePillarInfo();

        res.status(201).json({
            message: 'Pillar created successfully',
            pillar
        });
    } catch (error) {
        console.error('Error creating pillar:', error);
        res.status(500).json({ message: 'Error creating pillar', error: error.message });
    }
};

// Get list of battery pillars by station
const getPillarsByStation = async (req, res) => {
    try {
        const { stationId } = req.params;
        const { status } = req.query;

        const query = { station: stationId };
        if (status) {
            query.status = status;
        }

        const pillars = await BatteryPillar.find(query)
            .populate('station', 'stationName address')
            .sort({ pillarNumber: 1 });

        // Get slot information for each pillar
        const pillarsWithSlots = await Promise.all(
            pillars.map(async (pillar) => {
                const slots = await BatterySlot.find({ pillar: pillar._id })
                    .populate('battery', 'serial model soh status price')
                    .sort({ slotNumber: 1 });

                // ✅ Update stats and check availability
                await pillar.updateSlotStats();

                return {
                    ...pillar.toObject(),
                    slots,
                    // ✅ Add availability info for booking
                    availability: {
                        hasSwapSlotAvailable: pillar.slotStats.empty >= 1,
                        emptySlots: pillar.slotStats.empty,
                        canAcceptBooking: pillar.slotStats.empty >= 1 && pillar.slotStats.occupied > 0,
                        message: pillar.slotStats.empty < 1
                            ? 'No empty slot available. Cannot accept new bookings.'
                            : `${pillar.slotStats.empty} empty slot(s) available for old battery insertion.`
                    }
                };
            })
        );

        res.json({
            message: 'Pillars retrieved successfully',
            pillars: pillarsWithSlots
        });
    } catch (error) {
        console.error('Error getting pillars:', error);
        res.status(500).json({ message: 'Error retrieving pillars', error: error.message });
    }
};

// Get slot status of battery pillar
const getPillarSlots = async (req, res) => {
    try {
        const { pillarId } = req.params;

        const pillar = await BatteryPillar.findById(pillarId);
        if (!pillar) {
            return res.status(404).json({ message: 'Pillar not found' });
        }

        const slots = await BatterySlot.find({ pillar: pillarId })
            .populate('battery', 'serial model soh status')
            .populate('reservation.user', 'username email')
            .populate('reservation.booking', 'bookingId scheduledTime')
            .sort({ slotNumber: 1 });

        res.json({
            message: 'Slot status retrieved successfully',
            pillar: {
                _id: pillar._id,
                pillarCode: pillar.pillarCode,
                pillarName: pillar.pillarName,
                status: pillar.status,
                slotStats: pillar.slotStats
            },
            slots
        });
    } catch (error) {
        console.error('Error getting pillar slots:', error);
        res.status(500).json({ message: 'Error retrieving slot status', error: error.message });
    }
};

// Get full details of a pillar by ID
const getPillarDetailById = async (req, res) => {
    try {
        const { pillarId } = req.params;

        // ✅ Lấy pillar với đầy đủ thông tin
        const pillar = await BatteryPillar.findById(pillarId)
            .populate('station', 'stationName address city district latitude longitude');

        if (!pillar) {
            return res.status(404).json({
                success: false,
                message: 'Pillar not found'
            });
        }

        // ✅ Lấy tất cả slots của pillar với thông tin battery và reservation
        const slots = await BatterySlot.find({ pillar: pillarId })
            .populate('battery', 'serial model soh status manufacturer capacity_kWh voltage price')
            .populate('reservation.user', 'fullName email phone')
            .populate('reservation.booking', 'bookingId scheduledTime status')
            .populate('lastActivity.user', 'fullName email')
            .populate('lastActivity.battery', 'serial model')
            .sort({ slotNumber: 1 });

        // ✅ Tính toán statistics
        const totalSlots = slots.length;
        const emptySlots = slots.filter(s => s.status === 'empty').length;
        const occupiedSlots = slots.filter(s => s.status === 'occupied').length;
        const reservedSlots = slots.filter(s => s.status === 'reserved').length;
        const lockedSlots = slots.filter(s => s.status === 'locked').length;
        const maintenanceSlots = slots.filter(s => s.status === 'maintenance').length;
        const errorSlots = slots.filter(s => s.status === 'error').length;

        // ✅ Batteries trong pillar
        const batteriesInPillar = slots.filter(s => s.battery).map(s => ({
            slotNumber: s.slotNumber,
            slotCode: s.slotCode,
            battery: s.battery,
            slotStatus: s.status
        }));

        res.json({
            success: true,
            message: 'Pillar details retrieved successfully',
            data: {
                pillar: {
                    _id: pillar._id,
                    pillarCode: pillar.pillarCode,
                    pillarName: pillar.pillarName,
                    pillarNumber: pillar.pillarNumber,
                    status: pillar.status,
                    station: pillar.station,
                    slotStats: pillar.slotStats,
                    createdAt: pillar.createdAt,
                    updatedAt: pillar.updatedAt
                },
                statistics: {
                    totalSlots,
                    emptySlots,
                    occupiedSlots,
                    reservedSlots,
                    lockedSlots,
                    maintenanceSlots,
                    errorSlots,
                    availableBatteries: batteriesInPillar.length
                },
                slots,
                batteries: batteriesInPillar
            }
        });
    } catch (error) {
        console.error('Error getting pillar detail:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving pillar details',
            error: error.message
        });
    }
};

// ✅ API mới: Lấy slots dạng grid (2D array) cho UI
const getPillarSlotsGrid = async (req, res) => {
    try {
        const { pillarId } = req.params;
        const { rows = 2, columns = 5 } = req.query; // Mặc định 2 hàng x 5 cột

        // Validate pillar
        const pillar = await BatteryPillar.findById(pillarId)
            .populate('station', 'stationName address');

        if (!pillar) {
            return res.status(404).json({
                success: false,
                message: 'Pillar not found'
            });
        }

        // Get all slots
        const slots = await BatterySlot.find({ pillar: pillarId })
            .populate('battery', 'serial model soh status manufacturer capacity_kWh voltage price')
            .populate('reservation.user', 'fullName email')
            .populate('reservation.booking', 'bookingId scheduledTime status')
            .sort({ slotNumber: 1 });

        // ✅ Tạo grid 2D array
        const numRows = parseInt(rows);
        const numColumns = parseInt(columns);
        const grid = [];

        // Initialize grid với null
        for (let i = 0; i < numRows; i++) {
            grid[i] = [];
            for (let j = 0; j < numColumns; j++) {
                grid[i][j] = null;
            }
        }

        // ✅ Fill slots vào grid theo position hoặc slotNumber
        slots.forEach((slot, index) => {
            let row, col;

            // Nếu có position.row và position.column, dùng nó
            if (slot.position && slot.position.row && slot.position.column) {
                row = slot.position.row - 1; // Convert to 0-based index
                col = slot.position.column - 1;
            } else {
                // Nếu không có position, tính theo slotNumber
                // Slot 1-5 → row 0, Slot 6-10 → row 1
                row = Math.floor(index / numColumns);
                col = index % numColumns;
            }

            // Đảm bảo không vượt quá grid
            if (row < numRows && col < numColumns) {
                grid[row][col] = {
                    _id: slot._id,
                    slotNumber: slot.slotNumber,
                    slotCode: slot.slotCode,
                    status: slot.status,
                    position: {
                        row: row + 1, // Convert back to 1-based
                        column: col + 1
                    },
                    battery: slot.battery ? {
                        _id: slot.battery._id,
                        serial: slot.battery.serial,
                        model: slot.battery.model,
                        soh: slot.battery.soh,
                        status: slot.battery.status,
                        manufacturer: slot.battery.manufacturer,
                        capacity_kWh: slot.battery.capacity_kWh,
                        voltage: slot.battery.voltage,
                        price: slot.battery.price
                    } : null,
                    reservation: slot.reservation && slot.reservation.booking ? {
                        booking: slot.reservation.booking,
                        user: slot.reservation.user,
                        reservedAt: slot.reservation.reservedAt,
                        expiresAt: slot.reservation.expiresAt
                    } : null,
                    isAlwaysEmpty: slot.isAlwaysEmpty || false
                };
            }
        });

        res.json({
            success: true,
            message: 'Slot grid retrieved successfully',
            data: {
                pillar: {
                    _id: pillar._id,
                    pillarCode: pillar.pillarCode,
                    pillarName: pillar.pillarName,
                    pillarNumber: pillar.pillarNumber,
                    status: pillar.status,
                    station: pillar.station,
                    slotStats: pillar.slotStats
                },
                gridLayout: {
                    rows: numRows,
                    columns: numColumns,
                    totalSlots: slots.length
                },
                grid, // ✅ 2D array [row][column]
                slotsList: slots // ✅ Flat array (optional, nếu FE cần)
            }
        });
    } catch (error) {
        console.error('Error getting pillar slots grid:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving slot grid',
            error: error.message
        });
    }
};

// Tìm slot trống hoặc có pin để swap
const getAvailableSlots = async (req, res) => {
    try {
        const { stationId, pillarId, needEmpty } = req.query;

        // ✅ Query theo Slot Status (không phải Battery Status)
        const query = { status: { $in: ['empty', 'occupied'] } };

        if (stationId) query.station = stationId;
        if (pillarId) query.pillar = pillarId;

        // Nếu cần slot trống (để bỏ pin cũ vào)
        if (needEmpty === 'true') {
            query.battery = null;
            query.status = 'empty'; // ✅ Slot Status = empty
        }

        const slots = await BatterySlot.find(query)
            .populate('battery', 'serial model soh status') // ✅ Populate để lấy Battery Status
            .populate('pillar', 'pillarCode pillarName')
            .populate('station', 'stationName address')
            .sort({ 'pillar.pillarNumber': 1, slotNumber: 1 })
            .limit(50);

        res.json({
            message: 'Available slots retrieved successfully',
            count: slots.length,
            slots
        });
    } catch (error) {
        console.error('Error getting available slots:', error);
        res.status(500).json({ message: 'Error retrieving available slots', error: error.message });
    }
};

// Bắt đầu quy trình đổi pin
const initiateSwap = async (req, res) => {
    try {
        const { vehicleId, bookingId } = req.body;

        // ✅ Lấy userId từ middleware authenticate
        const userId = req.user.id;

        // ✅ Validate booking (BẮT BUỘC vì booking đã có pillar và battery)
        if (!bookingId) {
            return res.status(400).json({
                message: 'bookingId is required to perform swap'
            });
        }

        const booking = await Booking.findById(bookingId)
            .populate('battery', 'serial model soh status currentSlot currentPillar')
            .populate('pillar', 'pillarCode pillarName pillarNumber')
            .populate('station', 'stationName address');

        if (!booking) {
            return res.status(404).json({
                message: 'Booking not found'
            });
        }
        console.log("user trong booking", booking.user);
        console.log('userId', userId);

        // ✅ Validate booking thuộc về user đang request
        // Convert CẢ HAI về string để so sánh (vì cả 2 đều là ObjectId)
        if (booking.user.toString() !== userId.toString()) {
            return res.status(403).json({
                message: 'You do not have permission to perform swap for this booking'
            });
        }


        if (!['booked', 'arrived'].includes(booking.status)) {
            return res.status(400).json({
                message: `Invalid booking. Status now: ${booking.status}. need 'booked' or 'arrived'.`
            });
        }

        // ✅ Validate booking phải có pillar và battery
        if (!booking.pillar) {
            return res.status(400).json({
                message: 'Booking dont have pillar. Please create new booking with pillarId.'
            });
        }

        if (!booking.battery) {
            return res.status(400).json({
                message: 'Booking dont have battery. Please create new booking with batteryId.'
            });
        }

        // ✅ Validate battery đã đặt vẫn còn hợp lệ
        const bookedBattery = booking.battery;
        if (!['is-booking', 'full', 'idle'].includes(bookedBattery.status)) {
            return res.status(400).json({
                message: `Booked battery is no longer available. Status: ${bookedBattery.status}. Please cancel and create a new booking.`
            });
        }

        // ✅ Validate battery vẫn nằm trong pillar đã đặt
        if (bookedBattery.currentPillar.toString() !== booking.pillar._id.toString()) {
            return res.status(400).json({
                message: 'Booked battery has been moved to a different pillar. Please create a new booking.'
            });
        }

        // ✅ Lấy thông tin slot của battery đã đặt
        const bookedBatterySlot = await BatterySlot.findById(bookedBattery.currentSlot);
        if (!bookedBatterySlot) {
            return res.status(400).json({
                message: 'Slot of booked battery not found. Please contact staff.'
            });
        }


        const emptySlot = await BatterySlot.findOne({
            pillar: booking.pillar._id,
            status: 'empty',
            battery: null
        }).populate('pillar');

        if (!emptySlot) {
            return res.status(400).json({
                message: `No empty slot in ${booking.pillar.pillarName}. Please contact station staff.`
            });
        }

        // ✅ Tạo bản ghi swap history (dùng userId từ req.user và stationId từ booking)
        const swapHistory = new BatterySwapHistory({
            user: userId,
            vehicle: vehicleId,
            station: booking.station._id, // ✅ Lấy từ booking thay vì req.body
            pillar: booking.pillar._id,
            slot: emptySlot._id,
            booking: bookingId,
            status: 'initiated',
            newBattery: {
                battery: bookedBattery._id,
                soh: bookedBattery.soh,
                chargeLevel: 100,
                status: bookedBattery.status
            }
        });

        await swapHistory.save();

        // ✅ Reserve slot trống (15 phút) - Đảm bảo slot không bị user khác chiếm
        // Nếu muốn GIỮ slot empty cho đến khi insertOldBattery, comment dòng này
        await emptySlot.reserve(bookingId, userId, 15);

        res.json({
            message: 'Swap transaction initiated successfully',
            swapId: swapHistory.swapId,
            instructions: {
                step1: `Go to pillar ${booking.pillar.pillarName}`,
                step2: `Insert old battery into empty slot number ${emptySlot.slotNumber}`,
                step3: `Take booked battery (${bookedBattery.serial}) from slot number ${bookedBatterySlot.slotNumber}`,
                step4: 'Confirm completion on app'
            },
            booking: {
                bookingId: booking.bookingId,
                status: booking.status,
                scheduledTime: booking.scheduledTime
            },
            pillar: {
                _id: booking.pillar._id,
                pillarCode: booking.pillar.pillarCode,
                pillarName: booking.pillar.pillarName,
                pillarNumber: booking.pillar.pillarNumber
            },
            emptySlot: {
                _id: emptySlot._id,
                slotCode: emptySlot.slotCode,
                slotNumber: emptySlot.slotNumber
            },
            bookedBattery: {
                _id: bookedBattery._id,
                serial: bookedBattery.serial,
                model: bookedBattery.model,
                soh: bookedBattery.soh,
                slotNumber: bookedBatterySlot.slotNumber,
                slotCode: bookedBatterySlot.slotCode
            }
        });
    } catch (error) {
        console.error('Error initiating swap:', error);
        res.status(500).json({ message: 'Error initiating swap transaction', error: error.message });
    }
};

// Người dùng bỏ pin cũ vào slot trống
const insertOldBattery = async (req, res) => {
    try {
        const {
            swapId,
            slotId,
            oldBatterySerial,
            // ✅ Thông tin bổ sung cho oldBattery (nếu chưa tồn tại)
            model,
            manufacturer,
            capacity_kWh,
            voltage,
            price
        } = req.body;

        // Tìm giao dịch swap
        const swapHistory = await BatterySwapHistory.findOne({ swapId });
        if (!swapHistory) {
            return res.status(404).json({ message: 'Swap transaction not found' });
        }

        if (swapHistory.status !== 'initiated') {
            return res.status(400).json({ message: 'Transaction not in a valid state' });
        }

        // Tìm hoặc tạo battery record cho pin cũ
        let oldBattery = await Battery.findOne({ serial: oldBatterySerial });

        if (!oldBattery) {
            // ✅ Validate đầy đủ thông tin khi tạo mới
            if (!model) {
                return res.status(400).json({
                    message: 'Missing battery information: model is required when creating a new battery'
                });
            }
            if (!price && price !== 0) {
                return res.status(400).json({
                    message: 'Missing battery information: price is required when creating a new battery'
                });
            }

            // ✅ Tạo mới với đầy đủ thông tin
            oldBattery = new Battery({
                serial: oldBatterySerial,
                model,
                manufacturer: manufacturer || 'Unknown',
                capacity_kWh: capacity_kWh || 48, // Default 48kWh
                voltage: voltage || 48, // Default 48V
                price,
                station: swapHistory.station,
                status: 'idle',
                soh: 80, // Mặc định, sẽ được kiểm tra lại bởi staff
                currentPillar: null, // Sẽ được cập nhật khi insertBattery
                currentSlot: null
            });
            await oldBattery.save();
        }

        // Tìm slot
        const slot = await BatterySlot.findById(slotId);
        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        // Bỏ pin vào slot
        await slot.insertBattery(oldBattery._id, swapHistory.user);

        // Cập nhật swap history
        swapHistory.oldBattery = {
            battery: oldBattery._id,
            soh: oldBattery.soh,
            chargeLevel: 20, // Giả định pin cũ còn ít
            status: oldBattery.status
        };
        swapHistory.status = 'in-progress';
        await swapHistory.save();

        res.json({
            message: 'Old battery received. Please take the new battery.',
            swapId: swapHistory.swapId,
            oldBattery: {
                serial: oldBattery.serial,
                slotNumber: slot.slotNumber
            },
            nextStep: 'Take the new battery and confirm completion'
        });
    } catch (error) {
        console.error('Error inserting old battery:', error);
        res.status(500).json({ message: 'Error processing old battery', error: error.message });
    }
};

// Hoàn thành giao dịch đổi pin
const completeSwap = async (req, res) => {
    try {
        const { swapId } = req.body;
        console.log(swapId)
        // Tìm giao dịch swap
        const swapHistory = await BatterySwapHistory.findOne({ swapId })
            .populate('newBattery.battery')
            .populate('oldBattery.battery')
            .populate('slot')
            .populate('pillar');

        if (!swapHistory) {
            return res.status(404).json({ message: 'Swap transaction not found' });
        }

        if (swapHistory.status !== 'in-progress') {
            return res.status(400).json({ message: 'Transaction not in a valid state' });
        }

        // Remove new battery from slot
        const newBatterySlot = await BatterySlot.findById(
            swapHistory.newBattery.battery.currentSlot
        );

        if (newBatterySlot) {
            await newBatterySlot.removeBattery(swapHistory.user);
        }

        // Update old battery status to idle (returned to station)
        await Battery.findByIdAndUpdate(swapHistory.oldBattery.battery._id, {
            status: 'idle'
        });

        // ✅ Update new battery status to in-use (taken by user)
        await Battery.findByIdAndUpdate(swapHistory.newBattery.battery._id, {
            status: 'in-use'
        });

        // ✅ Update SwapHistory to reflect actual battery statuses
        swapHistory.oldBattery.status = 'idle';
        swapHistory.newBattery.status = 'in-use';

        // Update booking if exists
        if (swapHistory.booking) {
            await Booking.findByIdAndUpdate(swapHistory.booking, {
                status: 'completed'
            });
        }

        // Complete swap (this will save swapHistory with updated statuses)
        await swapHistory.complete();

        // Cập nhật thống kê station
        const station = await Station.findById(swapHistory.station);
        if (station) {
            await station.updateBatteryCounts();
            await station.updatePillarInfo();
        }

        // Tính swap duration (giây)
        const swapDuration = swapHistory.swapTime && swapHistory.completedAt
            ? Math.floor((swapHistory.completedAt - swapHistory.swapTime) / 1000)
            : 0;

        res.json({
            message: 'Đổi pin thành công!',
            swapId: swapHistory.swapId,
            summary: {
                oldBattery: swapHistory.oldBattery.battery.serial,
                newBattery: swapHistory.newBattery.battery.serial,
                newBatteryCharge: swapHistory.newBattery.chargeLevel,
                swapDuration,
                completedAt: swapHistory.completedAt
            }
        });
    } catch (error) {
        console.error('Error completing swap:', error);
        res.status(500).json({ message: 'Error completing swap transaction', error: error.message });
    }
};

// Get battery swap history
const getSwapHistory = async (req, res) => {
    try {
        const { userId, stationId, startDate, endDate, page = 1, limit = 20 } = req.query;

        const query = {};
        if (userId) query.user = userId;
        if (stationId) query.station = stationId;
        if (startDate || endDate) {
            query.swapTime = {};
            if (startDate) query.swapTime.$gte = new Date(startDate);
            if (endDate) query.swapTime.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;

        const [history, total] = await Promise.all([
            BatterySwapHistory.find(query)
                .populate('user', 'username email')
                .populate('station', 'stationName address')
                .populate('pillar', 'pillarName pillarCode')
                .populate('newBattery.battery', 'serial model')
                .populate('oldBattery.battery', 'serial model')
                .sort({ swapTime: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            BatterySwapHistory.countDocuments(query)
        ]);

        res.json({
            message: 'Lấy lịch sử đổi pin thành công',
            history,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error getting swap history:', error);
        res.status(500).json({ message: 'Error getting swap history', error: error.message });
    }
};

// Staff gán pin vào slot
const assignBatteryToSlot = async (req, res) => {
    try {
        const { batteryId, slotId } = req.body;
        const staffId = req.user.id; // ✅ Từ JWT decoded
        const userRole = req.user.role;
        const userStation = req.user.station; // ✅ Từ database query trong middleware

        // Kiểm tra battery có tồn tại không
        const battery = await Battery.findById(batteryId);
        if (!battery) {
            return res.status(404).json({ message: 'Battery not found' });
        }

        // ✅ Kiểm tra Battery Status - Không được gán pin đang lỗi hoặc đang sử dụng
        if (battery.status === 'faulty') {
            return res.status(400).json({
                message: 'Battery is faulty. Cannot assign to slot. Please repair first.'
            });
        }

        if (battery.status === 'in-use') {
            return res.status(400).json({
                message: 'Battery is currently in use (in-use). Cannot assign to slot.'
            });
        }

        // Kiểm tra battery đã ở trong slot khác chưa
        if (battery.currentSlot) {
            return res.status(400).json({
                message: 'Battery is currently in another slot. Please remove it first.'
            });
        }

        // Kiểm tra slot có tồn tại không
        const slot = await BatterySlot.findById(slotId)
            .populate('pillar', 'pillarName pillarCode')
            .populate('station', 'stationName');

        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        // Kiểm tra staff chỉ được gán pin tại trạm của mình (trừ admin)
        if (userRole === 'staff') {
            if (!userStation) {
                return res.status(403).json({
                    message: 'Staff has not been assigned a station. Please contact admin.'
                });
            }
            if (slot.station._id.toString() !== userStation.toString()) {
                return res.status(403).json({
                    message: 'You are only authorized to manage slots at your assigned station.'
                });
            }
        }

        // Kiểm tra slot đã có pin chưa
        if (slot.battery) {
            return res.status(400).json({
                message: 'Slot already has a battery. Please choose an empty slot.'
            });
        }

        // Kiểm tra Slot Status - Chỉ cho phép gán vào slot 'empty'
        if (slot.status !== 'empty') {
            return res.status(400).json({
                message: `Slot is currently ${slot.status}. Can only assign battery to an empty slot.`
            });
        }

        // ✅ Check if pillar will still have at least 1 empty slot after assignment
        const pillar = await BatteryPillar.findById(slot.pillar._id);
        if (pillar) {
            await pillar.updateSlotStats();

            // Nếu chỉ còn 1 empty slot (slot hiện tại), không cho phép assign
            if (pillar.slotStats.empty <= 1) {
                return res.status(400).json({
                    message: `Cannot assign battery. Pillar ${pillar.pillarName} must keep at least 1 empty slot for swap operations. Current empty slots: ${pillar.slotStats.empty}. Please remove a battery from another slot first.`
                });
            }
        }

        // Gán pin vào slot
        await slot.insertBattery(batteryId, staffId);

        // Cập nhật battery
        battery.currentSlot = slotId;
        battery.currentPillar = slot.pillar._id;
        battery.station = slot.station._id;
        await battery.save();

        // Cập nhật stats của pillar (update lại sau khi insert)
        await pillar.updateSlotStats();

        // Cập nhật stats của station
        const station = await Station.findById(slot.station._id);
        if (station) {
            await station.updateBatteryCounts();
        }

        res.json({
            message: 'Battery assigned to slot successfully',
            battery: {
                serial: battery.serial,
                model: battery.model,
                soh: battery.soh,
                status: battery.status
            },
            slot: {
                slotNumber: slot.slotNumber,
                slotCode: slot.slotCode,
                pillarName: slot.pillar.pillarName,
                stationName: slot.station.stationName
            },
            pillarStats: {
                emptySlots: pillar.slotStats.empty,
                occupiedSlots: pillar.slotStats.occupied,
                message: `${pillar.slotStats.empty} empty slot(s) remaining in ${pillar.pillarName}`
            }
        });
    } catch (error) {
        console.error('Error assigning battery to slot:', error);
        res.status(500).json({ message: 'Error assigning battery to slot', error: error.message });
    }
};

// Staff lấy pin ra khỏi slot
const removeBatteryFromSlot = async (req, res) => {
    try {
        const { slotId } = req.body;
        const staffId = req.user.id; // ✅ Fix: Dùng id thay vì _id
        const userRole = req.user.role;
        const userStation = req.user.station;

        // Kiểm tra slot có tồn tại không
        const slot = await BatterySlot.findById(slotId)
            .populate('battery', 'serial model soh status')
            .populate('pillar', 'pillarName pillarCode')
            .populate('station', 'stationName');

        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        // Kiểm tra staff chỉ được lấy pin tại trạm của mình (trừ admin)
        if (userRole === 'staff') {
            if (!userStation) {
                return res.status(403).json({
                    message: 'Staff has not been assigned a station. Please contact admin.'
                });
            }
            if (slot.station._id.toString() !== userStation.toString()) {
                return res.status(403).json({
                    message: 'You are only authorized to manage slots at your assigned station.'
                });
            }
        }

        // Kiểm tra slot có pin không
        if (!slot.battery) {
            return res.status(400).json({
                message: 'Slot is empty. No battery to remove.'
            });
        }

        // ✅ Kiểm tra Slot Status - Chỉ cho phép lấy pin từ slot 'occupied'
        if (slot.status !== 'occupied') {
            return res.status(400).json({
                message: `Slot is currently ${slot.status}. Can only remove battery from an occupied slot.`
            });
        }

        const batteryInfo = {
            id: slot.battery._id,
            serial: slot.battery.serial,
            model: slot.battery.model,
            soh: slot.battery.soh,
            status: slot.battery.status
        };

        // Remove battery from slot (method tự động clear currentSlot/Pillar)
        await slot.removeBattery(staffId);

        // ✅ Fix: Set battery status (vì method removeBattery không set status)
        // Staff có thể set status tùy theo tình huống (idle/maintenance/faulty)
        // Mặc định: idle (sẵn sàng để charge hoặc assign lại)
        await Battery.findByIdAndUpdate(batteryInfo.id, {
            status: 'idle' // hoặc có thể cho phép staff chọn trong request body
        });

        // Cập nhật stats của pillar
        const pillar = await BatteryPillar.findById(slot.pillar._id);
        if (pillar) {
            await pillar.updateSlotStats();
        }

        // Cập nhật stats của station
        const station = await Station.findById(slot.station._id);
        if (station) {
            await station.updateBatteryCounts();
        }

        res.json({
            message: 'Battery removed from slot successfully',
            battery: batteryInfo,
            slot: {
                slotNumber: slot.slotNumber,
                slotCode: slot.slotCode,
                pillarName: slot.pillar.pillarName,
                stationName: slot.station.stationName,
                status: 'empty'
            }
        });
    } catch (error) {
        console.error('Error removing battery from slot:', error);
        res.status(500).json({ message: 'Error removing battery from slot', error: error.message });
    }
};

module.exports = {
    createPillar,
    getPillarsByStation,
    getPillarSlots,
    getPillarSlotsGrid,
    getPillarDetailById,
    getAvailableSlots,
    initiateSwap,
    insertOldBattery,
    completeSwap,
    getSwapHistory,
    assignBatteryToSlot,
    removeBatteryFromSlot
};





