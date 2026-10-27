const CarCategory = require('./models/CarCategory');
const StatePricing = require('./models/StatePricing');
const RoutePricing = require('./models/RoutePricing');
const RentalPackage = require('./models/RentalPackage');
const AirportPricing = require('./models/AirportPricing');
const connectDB = require('./config/db');

async function check() {
  await connectDB();
  console.log('--- CarCategory (Sedan) ---');
  const cats = await CarCategory.find({ name: { $regex: /sedan/i } });
  console.log(JSON.stringify(cats, null, 2));

  console.log('--- StatePricing (Sedan) ---');
  const sp = await StatePricing.find({ carCategory: { $regex: /sedan/i } });
  console.log(JSON.stringify(sp, null, 2));

  console.log('--- RoutePricing (Sedan) ---');
  const rp = await RoutePricing.find({ carCategory: { $regex: /sedan/i } });
  console.log(JSON.stringify(rp, null, 2));

  console.log('--- RentalPackage (Sedan) ---');
  const rent = await RentalPackage.find({ carCategory: { $regex: /sedan/i } });
  console.log(JSON.stringify(rent, null, 2));

  console.log('--- AirportPricing (Sedan) ---');
  const ap = await AirportPricing.find({ carCategory: { $regex: /sedan/i } });
  console.log(JSON.stringify(ap, null, 2));

  process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });

