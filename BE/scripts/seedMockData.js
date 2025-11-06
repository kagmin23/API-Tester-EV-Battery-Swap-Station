const mongoose = require('mongoose');
require('dotenv').config();
const Transaction = require('../models/transaction/transaction.model');
const Station = require('../models/station/station.model');
const User = require('../models/auth/auth.model');
const Battery = require('../models/battery/battery.model');
const Vehicle = require('../models/vehicle/vehicle.model');

const DAYS_TO_GENERATE = 30;
const TRANSACTIONS_PER_DAY = 20;

async function seedMockData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const stations = await Station.find().limit(5);
    const users = await User.find({ role: 'driver' }).limit(10);
    const batteries = await Battery.find().limit(20);
    const vehicles = await Vehicle.find().limit(10);

    if (stations.length === 0) {
      console.log('❌ No stations found. Please create stations first.');
      return;
    }

    console.log(`📊 Found ${stations.length} stations, ${users.length} users`);
    console.log(`🔄 Generating ${DAYS_TO_GENERATE} days of mock transactions...`);

    const transactions = [];
    const endDate = new Date();

    for (let day = DAYS_TO_GENERATE; day >= 0; day--) {
      const currentDate = new Date(endDate);
      currentDate.setDate(currentDate.getDate() - day);

      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      const dailyTotal = isWeekend ? 10 : TRANSACTIONS_PER_DAY;

      for (let i = 0; i < dailyTotal; i++) {
        const hour = Math.floor(Math.random() * 24);
        const minutes = Math.floor(Math.random() * 60);
        
        const txTime = new Date(currentDate);
        txTime.setHours(hour, minutes, 0, 0);

        transactions.push({
          user: users[Math.floor(Math.random() * users.length)]?._id || null,
          station: stations[Math.floor(Math.random() * stations.length)]._id,
          vehicle: vehicles[Math.floor(Math.random() * vehicles.length)]?.licensePlate || 'MOCK-001',
          battery: batteries[Math.floor(Math.random() * batteries.length)]?._id || null,
          transaction_time: txTime,
          cost: 50000 + Math.floor(Math.random() * 20000)
        });
      }
    }

    console.log(`📦 Generated ${transactions.length} mock transactions`);

    await Transaction.deleteMany({ cost: { $gte: 50000, $lte: 70000 } });
    console.log('🧹 Cleaned old mock data');

    await Transaction.insertMany(transactions);
    console.log(`✅ Inserted ${transactions.length} transactions`);

    const stats = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          minDate: { $min: '$transaction_time' },
          maxDate: { $max: '$transaction_time' }
        }
      }
    ]);

    console.log('\n📊 Database Stats:');
    console.log(`   Total transactions: ${stats[0].count}`);
    console.log(`   Date range: ${stats[0].minDate} → ${stats[0].maxDate}`);
    console.log('\n✅ Mock data seeded successfully!');
    console.log('🚀 You can now train the AI model!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

seedMockData();

