const BatteryPillar = require('../../models/battery/batteryPillar.model');
const BatterySlot = require('../../models/battery/batterySlot.model');
const Battery = require('../../models/battery/battery.model');
const BatterySwapHistory = require('../../models/battery/batterySwapHistory.model');
const Station = require('../../models/station/station.model');
const Booking = require('../../models/booking/booking.model');

// Tạo trụ pin mới cho station
const createPillar = async (req, res) => {
    try {
        const { stationId, pillarName, pillarNumber, totalSlots } = req.body;

        // Kiểm tra station có tồn tại không
        const station = await Station.findById(stationId);
        if (!station) {
            return res.status(404).json({ message: 'Không tìm thấy trạm' });
        }

        // Kiểm tra pillarNumber đã tồn tại chưa
        const existingPillar = await BatteryPillar.findOne({
            station: stationId,
            pillarNumber
        });
        if (existingPillar) {
            return res.status(400).json({ message: 'Pillar number is already exists' });
        }

        // Tạo pillar mới
        const pillar = new BatteryPillar({
            station: stationId,
            pillarName,
            pillarNumber,
            totalSlots: totalSlots || 10
        });

        await pillar.save();

        // Khởi tạo các slot cho trụ
        await pillar.initializeSlots();

        // Cập nhật thông tin station
        await station.updatePillarInfo();

        res.status(201).json({
            message: 'create pillar successfully',
            pillar
        });
    } catch (error) {
        console.error('Error creating pillar:', error);
        res.status(500).json({ message: 'Error creating pillar', error: error.message });
    }
};

// Lấy danh sách trụ pin của station
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

        // Lấy thông tin slots cho mỗi pillar
        const pillarsWithSlots = await Promise.all(
            pillars.map(async (pillar) => {
                const slots = await BatterySlot.find({ pillar: pillar._id })
                    .populate('battery', 'serial model soh status price')
                    .sort({ slotNumber: 1 });

                return {
                    ...pillar.toObject(),
                    slots
                };
            })
        );

        res.json({
            message: 'Lấy danh sách trụ pin thành công',
            pillars: pillarsWithSlots
        });
    } catch (error) {
        console.error('Error getting pillars:', error);
        res.status(500).json({ message: 'Lỗi lấy danh sách trụ pin', error: error.message });
    }
};

// Lấy trạng thái các slot của trụ pin
const getPillarSlots = async (req, res) => {
    try {
        const { pillarId } = req.params;

        const pillar = await BatteryPillar.findById(pillarId);
        if (!pillar) {
            return res.status(404).json({ message: 'Không tìm thấy trụ pin' });
        }

        const slots = await BatterySlot.find({ pillar: pillarId })
            .populate('battery', 'serial model soh status')
            .populate('reservation.user', 'username email')
            .populate('reservation.booking', 'bookingId scheduledTime')
            .sort({ slotNumber: 1 });

        res.json({
            message: 'Lấy trạng thái slot thành công',
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
        res.status(500).json({ message: 'Lỗi lấy trạng thái slot', error: error.message });
    }
};

// Lấy chi tiết đầy đủ của 1 trụ pin theo ID
const getPillarDetailById = async (req, res) => {
    try {
        const { pillarId } = req.params;

        // ✅ Lấy pillar với đầy đủ thông tin
        const pillar = await BatteryPillar.findById(pillarId)
            .populate('station', 'stationName address city district latitude longitude');

        if (!pillar) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy trụ pin'
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
            message: 'Lấy chi tiết trụ pin thành công',
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
            message: 'Lỗi lấy chi tiết trụ pin',
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
                message: 'Không tìm thấy trụ pin'
            });
        }

        // Lấy tất cả slots
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
            message: 'Lấy slot grid thành công',
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
            message: 'Lỗi lấy slot grid',
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
            message: 'Lấy danh sách slot khả dụng thành công',
            count: slots.length,
            slots
        });
    } catch (error) {
        console.error('Error getting available slots:', error);
        res.status(500).json({ message: 'Lỗi lấy danh sách slot', error: error.message });
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
                message: 'bookingId là bắt buộc để thực hiện swap'
            });
        }

        const booking = await Booking.findById(bookingId)
            .populate('battery', 'serial model soh status currentSlot currentPillar')
            .populate('pillar', 'pillarCode pillarName pillarNumber')
            .populate('station', 'stationName address');

        if (!booking) {
            return res.status(404).json({
                message: 'Không tìm thấy booking'
            });
        }
        console.log("user trong booking", booking.user);
        console.log('userId', userId);

        // ✅ Validate booking thuộc về user đang request
        // Convert CẢ HAI về string để so sánh (vì cả 2 đều là ObjectId)
        if (booking.user.toString() !== userId.toString()) {
            return res.status(403).json({
                message: 'Bạn không có quyền thực hiện swap cho booking này'
            });
        }


        if (!['booked', 'arrived'].includes(booking.status)) {
            return res.status(400).json({
                message: `Booking không hợp lệ. Status hiện tại: ${booking.status}. Cần 'booked' hoặc 'arrived'.`
            });
        }

        // ✅ Validate booking phải có pillar và battery
        if (!booking.pillar) {
            return res.status(400).json({
                message: 'Booking không có thông tin pillar. Vui lòng tạo booking mới với pillarId.'
            });
        }

        if (!booking.battery) {
            return res.status(400).json({
                message: 'Booking không có thông tin battery. Vui lòng tạo booking mới với batteryId.'
            });
        }

        // ✅ Validate battery đã đặt vẫn còn hợp lệ
        const bookedBattery = booking.battery;
        if (!['is-booking', 'full', 'idle'].includes(bookedBattery.status)) {
            return res.status(400).json({
                message: `Pin đã đặt không còn khả dụng. Status: ${bookedBattery.status}. Vui lòng hủy và tạo booking mới.`
            });
        }

        // ✅ Validate battery vẫn nằm trong pillar đã đặt
        if (bookedBattery.currentPillar.toString() !== booking.pillar._id.toString()) {
            return res.status(400).json({
                message: 'Pin đã được di chuyển sang pillar khác. Vui lòng tạo booking mới.'
            });
        }

        // ✅ Lấy thông tin slot của battery đã đặt
        const bookedBatterySlot = await BatterySlot.findById(bookedBattery.currentSlot);
        if (!bookedBatterySlot) {
            return res.status(400).json({
                message: 'Không tìm thấy slot của pin đã đặt. Vui lòng liên hệ nhân viên.'
            });
        }


        const emptySlot = await BatterySlot.findOne({
            pillar: booking.pillar._id,
            status: 'empty',
            battery: null
        }).populate('pillar');

        if (!emptySlot) {
            return res.status(400).json({
                message: `Không có slot trống trong ${booking.pillar.pillarName}. Vui lòng liên hệ nhân viên trạm.`
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

        // ✅ Reserve slot trống (15 phút)
        await emptySlot.reserve(bookingId, userId, 15);

        res.json({
            message: 'Khởi tạo giao dịch đổi pin thành công',
            swapId: swapHistory.swapId,
            instructions: {
                step1: `Đến trụ ${booking.pillar.pillarName}`,
                step2: `Bỏ pin cũ vào slot trống số ${emptySlot.slotNumber}`,
                step3: `Lấy pin đã đặt (${bookedBattery.serial}) từ slot số ${bookedBatterySlot.slotNumber}`,
                step4: 'Xác nhận hoàn thành trên app'
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
        res.status(500).json({ message: 'Lỗi khởi tạo giao dịch đổi pin', error: error.message });
    }
};

// Người dùng bỏ pin cũ vào slot trống
const insertOldBattery = async (req, res) => {
    try {
        const { swapId, oldBatterySerial, slotId } = req.body;

        // Tìm giao dịch swap
        const swapHistory = await BatterySwapHistory.findOne({ swapId });
        if (!swapHistory) {
            return res.status(404).json({ message: 'Không tìm thấy giao dịch đổi pin' });
        }

        if (swapHistory.status !== 'initiated') {
            return res.status(400).json({ message: 'Giao dịch không ở trạng thái phù hợp' });
        }

        // Tìm hoặc tạo battery record cho pin cũ
        let oldBattery = await Battery.findOne({ serial: oldBatterySerial });
        if (!oldBattery) {
            // Tạo mới nếu pin chưa được đăng ký
            oldBattery = new Battery({
                serial: oldBatterySerial,
                station: swapHistory.station,
                status: 'idle',
                soh: 80 // Mặc định, sẽ được kiểm tra sau
            });
            await oldBattery.save();
        }

        // Tìm slot
        const slot = await BatterySlot.findById(slotId);
        if (!slot) {
            return res.status(404).json({ message: 'Không tìm thấy slot' });
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
            message: 'Đã nhận pin cũ. Vui lòng lấy pin mới.',
            swapId: swapHistory.swapId,
            oldBattery: {
                serial: oldBattery.serial,
                slotNumber: slot.slotNumber
            },
            nextStep: 'Lấy pin mới và xác nhận hoàn thành'
        });
    } catch (error) {
        console.error('Error inserting old battery:', error);
        res.status(500).json({ message: 'Lỗi xử lý pin cũ', error: error.message });
    }
};

// Hoàn thành giao dịch đổi pin
const completeSwap = async (req, res) => {
    try {
        const { swapId } = req.body;

        // Tìm giao dịch swap
        const swapHistory = await BatterySwapHistory.findOne({ swapId })
            .populate('newBattery.battery')
            .populate('oldBattery.battery')
            .populate('slot')
            .populate('pillar');

        if (!swapHistory) {
            return res.status(404).json({ message: 'Không tìm thấy giao dịch đổi pin' });
        }

        if (swapHistory.status !== 'in-progress') {
            return res.status(400).json({ message: 'Giao dịch chưa sẵn sàng để hoàn thành' });
        }

        // Lấy pin mới ra khỏi slot
        const newBatterySlot = await BatterySlot.findById(
            swapHistory.newBattery.battery.currentSlot
        );

        if (newBatterySlot) {
            await newBatterySlot.removeBattery(swapHistory.user);
        }

        // Cập nhật trạng thái pin cũ sang charging
        await Battery.findByIdAndUpdate(swapHistory.oldBattery.battery._id, {
            status: 'charging'
        });

        // Cập nhật booking nếu có
        if (swapHistory.booking) {
            await Booking.findByIdAndUpdate(swapHistory.booking, {
                status: 'completed'
            });
        }

        // Hoàn thành swap
        await swapHistory.complete();

        // Cập nhật thống kê station
        const station = await Station.findById(swapHistory.station);
        if (station) {
            await station.updateBatteryCounts();
            await station.updatePillarInfo();
        }

        res.json({
            message: 'Đổi pin thành công!',
            swapId: swapHistory.swapId,
            summary: {
                oldBattery: swapHistory.oldBattery.battery.serial,
                newBattery: swapHistory.newBattery.battery.serial,
                newBatteryCharge: swapHistory.newBattery.chargeLevel,
                swapDuration: swapHistory.metadata.swapDuration,
                completedAt: swapHistory.completedAt
            }
        });
    } catch (error) {
        console.error('Error completing swap:', error);
        res.status(500).json({ message: 'Lỗi hoàn thành giao dịch đổi pin', error: error.message });
    }
};

// Lấy lịch sử đổi pin
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
        res.status(500).json({ message: 'Lỗi lấy lịch sử đổi pin', error: error.message });
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
            return res.status(404).json({ message: 'Không tìm thấy pin' });
        }

        // ✅ Kiểm tra Battery Status - Không được gán pin đang lỗi hoặc đang sử dụng
        if (battery.status === 'faulty') {
            return res.status(400).json({
                message: 'Pin bị lỗi (faulty). Không thể gán vào slot. Vui lòng sửa chữa trước.'
            });
        }

        if (battery.status === 'in-use') {
            return res.status(400).json({
                message: 'Pin đang được sử dụng (in-use). Không thể gán vào slot.'
            });
        }

        // Kiểm tra battery đã ở trong slot khác chưa
        if (battery.currentSlot) {
            return res.status(400).json({
                message: 'Pin đang ở trong slot khác. Vui lòng lấy pin ra trước.'
            });
        }

        // Kiểm tra slot có tồn tại không
        const slot = await BatterySlot.findById(slotId)
            .populate('pillar', 'pillarName pillarCode')
            .populate('station', 'stationName');

        if (!slot) {
            return res.status(404).json({ message: 'Không tìm thấy slot' });
        }

        // Kiểm tra staff chỉ được gán pin tại trạm của mình (trừ admin)
        if (userRole === 'staff') {
            if (!userStation) {
                return res.status(403).json({
                    message: 'Staff chưa được phân công trạm. Vui lòng liên hệ admin.'
                });
            }
            if (slot.station._id.toString() !== userStation.toString()) {
                return res.status(403).json({
                    message: 'Bạn chỉ có quyền quản lý slot tại trạm được phân công.'
                });
            }
        }

        // Kiểm tra slot đã có pin chưa
        if (slot.battery) {
            return res.status(400).json({
                message: 'Slot đã có pin. Vui lòng chọn slot trống.'
            });
        }

        // Kiểm tra Slot Status - Chỉ cho phép gán vào slot 'empty'
        if (slot.status !== 'empty') {
            return res.status(400).json({
                message: `Slot hiện đang ${slot.status}. Chỉ có thể gán pin vào slot trống (empty).`
            });
        }

        // Gán pin vào slot
        await slot.insertBattery(batteryId, staffId);

        // Cập nhật battery
        battery.currentSlot = slotId;
        battery.currentPillar = slot.pillar._id;
        battery.station = slot.station._id;
        await battery.save();

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
            message: 'Gán pin vào slot thành công',
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
            }
        });
    } catch (error) {
        console.error('Error assigning battery to slot:', error);
        res.status(500).json({ message: 'Lỗi gán pin vào slot', error: error.message });
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
            return res.status(404).json({ message: 'Không tìm thấy slot' });
        }

        // Kiểm tra staff chỉ được lấy pin tại trạm của mình (trừ admin)
        if (userRole === 'staff') {
            if (!userStation) {
                return res.status(403).json({
                    message: 'Staff chưa được phân công trạm. Vui lòng liên hệ admin.'
                });
            }
            if (slot.station._id.toString() !== userStation.toString()) {
                return res.status(403).json({
                    message: 'Bạn chỉ có quyền quản lý slot tại trạm được phân công.'
                });
            }
        }

        // Kiểm tra slot có pin không
        if (!slot.battery) {
            return res.status(400).json({
                message: 'Slot đang trống. Không có pin để lấy ra.'
            });
        }

        // ✅ Kiểm tra Slot Status - Chỉ cho phép lấy pin từ slot 'occupied'
        if (slot.status !== 'occupied') {
            return res.status(400).json({
                message: `Slot hiện đang ${slot.status}. Chỉ có thể lấy pin từ slot đang có pin (occupied).`
            });
        }

        const batteryInfo = {
            serial: slot.battery.serial,
            model: slot.battery.model,
            soh: slot.battery.soh,
            status: slot.battery.status
        };

        // Lấy pin ra khỏi slot
        await slot.removeBattery(staffId);

        // Cập nhật battery
        await Battery.findByIdAndUpdate(slot.battery._id, {
            currentSlot: null,
            currentPillar: null
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
            message: 'Lấy pin ra khỏi slot thành công',
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
        res.status(500).json({ message: 'Lỗi lấy pin ra khỏi slot', error: error.message });
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
