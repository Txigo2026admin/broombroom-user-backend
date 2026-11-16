const http = require('http');

const testAddons = [
  { id: 'addon-pet', key: 'petAllowance', name: 'Travel with Pet (Pet Allowance)', price: 1200, description: 'Sanitized pet-friendly cab' },
  { id: 'addon-carrier', key: 'roofCarrier', name: 'Add Roof Carrier', price: 200, description: 'Luggage carrier' },
  { id: 'addon-lang', key: 'language', name: 'Preferred Driver Language', price: 250, description: 'Language' },
  { id: 'addon-new-vehicle', key: 'newVehicle', name: 'New Vehicle (2023+)', price: 300, description: '2023+ car' },
  { id: 'addon-sightseeing', key: 'sightseeing', name: 'Local sightseeing package', price: 850, description: 'Sightseeing' },
  { id: 'addon-refundable', key: 'refundable', name: 'Upgrade to Refundable booking', price: 800, description: 'Refundable' }
];

const body = JSON.stringify({ addons: testAddons });
const req = http.request({
  hostname: '127.0.0.1',
  port: 5004,
  path: '/api/addons',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let resBody = '';
  res.on('data', c => resBody += c);
  res.on('end', () => {
    console.log('Update Status:', res.statusCode);
    console.log('Response:', JSON.parse(resBody));
    
    // Now verify with GET
    http.get('http://127.0.0.1:5004/api/addons', (getRes) => {
      let getData = '';
      getRes.on('data', c => getData += c);
      getRes.on('end', () => {
        console.log('GET after update:', JSON.parse(getData));
        process.exit(0);
      });
    });
  });
});
req.write(body);
req.end();
