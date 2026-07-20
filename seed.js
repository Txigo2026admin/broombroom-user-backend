require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const CarCategory = require('./models/CarCategory');
const Booking = require('./models/Booking');
const PricingRule = require('./models/PricingRule');
const GlobalSetting = require('./models/GlobalSetting');
const StatePricing = require('./models/StatePricing');
const RoutePricing = require('./models/RoutePricing');
const RentalPackage = require('./models/RentalPackage');
const City = require('./models/City');

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/broomboom_user_db');
        console.log('Connected to DB for seeding...');

        // Clear existing data
        await User.deleteMany();
        await CarCategory.deleteMany();
        await Booking.deleteMany();
        await PricingRule.deleteMany();
        await GlobalSetting.deleteMany();
        await StatePricing.deleteMany();
        await RoutePricing.deleteMany();
        await RentalPackage.deleteMany();
        await City.deleteMany();

        // Seed Cities with Coordinates for proximity testing
        await City.create([
            { name: 'Kolkata', displayName: 'Kolkata, West Bengal', lat: '22.5726', lon: '88.3639', state: 'West Bengal', placeId: 'place_kolkata' },
            { name: 'Salt Lake', displayName: 'Salt Lake City, Kolkata', lat: '22.5726', lon: '88.4348', state: 'West Bengal', placeId: 'place_salt_lake' },
            { name: 'Kolkata Airport', displayName: 'Netaji Subhash Chandra Bose Intl Airport', lat: '22.6547', lon: '88.4467', state: 'West Bengal', placeId: 'place_airport' },
            { name: 'Digha', displayName: 'Digha Beach, West Bengal', lat: '21.6266', lon: '87.5074', state: 'West Bengal', placeId: 'place_digha' },
            { name: 'Delhi', displayName: 'Delhi, National Capital Territory', lat: '28.6139', lon: '77.2090', state: 'Delhi', placeId: 'place_delhi' },
            { name: 'Agra', displayName: 'Agra, Uttar Pradesh', lat: '27.1767', lon: '78.0081', state: 'Uttar Pradesh', placeId: 'place_agra' },
            { name: 'Mumbai Airport', displayName: 'Chhatrapati Shivaji Maharaj Intl Airport', lat: '19.0896', lon: '72.8656', state: 'Maharashtra', placeId: 'place_mumbai_airport' },
            { name: 'Pune', displayName: 'Pune, Maharashtra', lat: '18.5204', lon: '73.8567', state: 'Maharashtra', placeId: 'place_pune' }
        ]);
        console.log('Cities seeded');

        // Seed Users
        await User.create([
            { name: 'Rahul Sharma', email: 'rahul@example.com', phone: '+91 9876543210', status: 'Active' },
            { name: 'Priya Verma', email: 'priya@example.com', phone: '+91 8765432109', status: 'Active' },
            { name: 'Amit Patel', email: 'amit@example.com', phone: '+91 7654321098', status: 'Suspended' }
        ]);
        console.log('Users seeded');

        // Seed Car Categories
        await CarCategory.create([
            { name: 'Hatchback', displayName: 'Hatchback', seater: 4, baseFare: 50, perKmRate: 10 },
            { name: 'Sedan', displayName: 'Sedan', seater: 4, baseFare: 50, perKmRate: 13 },
            { name: 'SUV', displayName: 'SUV (Ertiga)', seater: 6, baseFare: 80, perKmRate: 15 },
            { name: 'SUV+', displayName: 'Luxury SUV (Crysta)', seater: 7, baseFare: 120, perKmRate: 20 }
        ]);
        console.log('Car Categories seeded');

        // Seed State-wise General Pricing
        await StatePricing.create([
            // West Bengal default fallback rates
            { state: 'West Bengal', rideCategory: 'Oneway', carCategory: 'Sedan', seater: 4, ratePerKm: 13, minKms: 100, driverBata: 250, nightAllowance: 250, advanceValue: 20 },
            { state: 'West Bengal', rideCategory: 'Oneway', carCategory: 'Hatchback', seater: 4, ratePerKm: 10, minKms: 100, driverBata: 200, nightAllowance: 200, advanceValue: 20 },
            { state: 'West Bengal', rideCategory: 'Roundtrip', carCategory: 'Sedan', seater: 4, ratePerKm: 13, hourlyRate: 120, minKms: 250, driverBata: 250, nightAllowance: 250, advanceValue: 20 },
            
            // Maharashtra default fallback rates
            { state: 'Maharashtra', rideCategory: 'Oneway', carCategory: 'Sedan', seater: 4, ratePerKm: 14, minKms: 100, driverBata: 250, nightAllowance: 250, advanceValue: 20 },
            { state: 'Maharashtra', rideCategory: 'Roundtrip', carCategory: 'SUV', seater: 6, ratePerKm: 18, hourlyRate: 150, minKms: 300, driverBata: 300, nightAllowance: 300, advanceValue: 20 }
        ]);
        console.log('State Pricing seeded');

        // Seed Route-Specific Pricing (including geo-coordinates)
        await RoutePricing.create([
            // Kolkata Airport to Digha
            {
                pickupLocation: 'Kolkata Airport',
                dropLocation: 'Digha',
                pickupLat: 22.6547,
                pickupLng: 88.4467,
                dropLat: 21.6266,
                dropLng: 87.5074,
                nearbyRadiusKm: 25,
                rideCategory: 'Oneway',
                carCategory: 'Sedan',
                seater: 4,
                fixedPrice: 3500,
                advanceType: 'Percentage',
                advanceValue: 20
            },
            // Kolkata Airport to Salt Lake (e.g. Airport Transfer fixed price)
            {
                pickupLocation: 'Kolkata Airport',
                dropLocation: 'Salt Lake',
                pickupLat: 22.6547,
                pickupLng: 88.4467,
                dropLat: 22.5726,
                dropLng: 88.4348,
                nearbyRadiusKm: 25,
                rideCategory: 'Airport',
                carCategory: 'Sedan',
                seater: 4,
                fixedPrice: 899,
                includeToll: true,
                includeParking: true,
                advanceType: 'Percentage',
                advanceValue: 15
            },
            // Delhi to Agra
            {
                pickupLocation: 'Delhi',
                dropLocation: 'Agra',
                pickupLat: 28.6139,
                pickupLng: 77.2090,
                dropLat: 27.1767,
                dropLng: 78.0081,
                nearbyRadiusKm: 25,
                rideCategory: 'Oneway',
                carCategory: 'Sedan',
                seater: 4,
                fixedPrice: 3000,
                advanceType: 'Fixed',
                advanceValue: 500
            },
            // Mumbai Airport to Pune
            {
                pickupLocation: 'Mumbai Airport',
                dropLocation: 'Pune',
                pickupLat: 19.0896,
                pickupLng: 72.8656,
                dropLat: 18.5204,
                dropLng: 73.8567,
                nearbyRadiusKm: 25,
                rideCategory: 'Oneway',
                carCategory: 'Sedan',
                seater: 4,
                fixedPrice: 2500,
                advanceType: 'Percentage',
                advanceValue: 20
            }
        ]);
        console.log('Route Pricing seeded');

        // Seed Rental Packages
        await RentalPackage.create([
            { state: 'West Bengal', carCategory: 'Sedan', seater: 4, packageHours: 4, includedKms: 40, baseFare: 1000, extraKmRate: 14, extraHourRate: 150, advanceValue: 20 },
            { state: 'West Bengal', carCategory: 'Sedan', seater: 4, packageHours: 8, includedKms: 80, baseFare: 2000, extraKmRate: 14, extraHourRate: 150, advanceValue: 20 },
            { state: 'West Bengal', carCategory: 'Sedan', seater: 4, packageHours: 12, includedKms: 120, baseFare: 3000, extraKmRate: 14, extraHourRate: 150, advanceValue: 20 }
        ]);
        console.log('Rental Packages seeded');

        // Seed Global Settings
        await GlobalSetting.create([
            { key: 'globalMultiplier', value: 1.0 },
            { key: 'advancePercentage', value: 20 }
        ]);
        console.log('Global Settings seeded');

        // Seed Bookings with the new schema
        await Booking.create([
            {
                bookingId: 'BB7890BC',
                customerName: 'Rahul Sharma',
                customerMobile: '+91 9876543210',
                customerEmail: 'rahul@example.com',
                serviceType: 'Outstation oneway',
                state: 'Maharashtra',
                pickupAddress: 'Mumbai Airport Terminal 2',
                dropAddress: 'Lonavala Center Square',
                pickupDate: '2026-05-15',
                pickupTime: '10:00',
                vehicleCategory: 'Sedan',
                seater: 4,
                fare: 2500,
                advance: 500,
                dueFare: 2000,
                extraKm: '15',
                extraHour: '100',
                waitingCharges: '50',
                nightAllowance: '250',
                status: 'Confirmed',
                allocateOurPilot: true
            },
            {
                bookingId: 'BB1234XY',
                customerName: 'Priya Verma',
                customerMobile: '+91 8765432109',
                serviceType: 'Airport',
                state: 'Karnataka',
                pickupAddress: 'Indiranagar 100ft Road, Bangalore',
                dropAddress: 'Kempegowda International Airport',
                pickupDate: '2026-05-16',
                pickupTime: '04:30',
                vehicleCategory: 'SUV',
                seater: 6,
                fare: 1200,
                advance: 200,
                dueFare: 1000,
                status: 'Pending',
                allocateOurPilot: false
            }
        ]);
        console.log('Bookings seeded');

        console.log('Seeding completed successfully');
        process.exit();
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

seedData();
