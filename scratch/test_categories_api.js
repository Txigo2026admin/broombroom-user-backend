const http = require('http');

const categories = ['Hatchback', 'Sedan', 'SUV', 'SUV+', '13 Seater Traveller', '17 Seater Traveller', '25 Seater Traveller'];

function callApi(payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const req = http.request({
            hostname: 'localhost',
            port: 5004,
            path: '/api/pricing-rules/calculate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

(async () => {
    console.log('--- ONEWAY Kolkata -> Digha (185 km) ---');
    for (const cat of categories) {
        const res = await callApi({
            rideType: 'Oneway',
            sourceCity: 'Kolkata',
            destinationCity: 'Digha',
            category: cat,
            distance: 185
        });
        console.log(`${cat.padEnd(20)}: Fare=Rs.${res.fare}, Advance=Rs.${res.advance}, Due=Rs.${res.dueFare}, Rule=${res.ruleType}`);
    }

    console.log('\n--- ROUNDTRIP Kolkata <-> Digha (370 km, 24h) ---');
    for (const cat of categories) {
        const res = await callApi({
            rideType: 'Roundtrip',
            sourceCity: 'Kolkata',
            destinationCity: 'Digha',
            category: cat,
            distance: 370,
            oneWayDistance: 185,
            pickupDate: '2026-10-28',
            pickupTime: '10:00 AM',
            returnDate: '2026-10-29',
            returnTime: '10:00 AM'
        });
        console.log(`${cat.padEnd(20)}: Fare=Rs.${res.fare}, Advance=Rs.${res.advance}, Due=Rs.${res.dueFare}, Rule=${res.ruleType}`);
    }
})();

