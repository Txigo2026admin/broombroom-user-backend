const PRP_DELIVERY_URL =
    'https://api.bulksmsadmin.com/BulkSMSapi/keyApiSendSMS/APIDeliveryReport';

const getDeliveryReport = async (messageId, mobile) => {
    const form = new FormData();

    // Search by mobile number only
    form.append('Msgid', '');
    form.append('searchMobile', mobile || '');
    form.append('isEncrypt', '0');

    const today = new Date();

    const toDate = today.toISOString().slice(0, 10);

    const from = new Date();
    from.setDate(today.getDate() - 30);

    const fromDate = from.toISOString().slice(0, 10);

    form.append('Fromdate', fromDate);
    form.append('Todate', toDate);
    form.append('isTeId', '1');

    console.log('========== PRP DELIVERY REQUEST ==========');
    console.log('Mobile:', mobile);
    console.log('Fromdate:', fromDate);
    console.log('Todate:', toDate);
    console.log('==========================================');

    const response = await fetch(PRP_DELIVERY_URL, {
        method: 'POST',
        headers: {
            apikey: process.env.PRP_SMS_API_KEY
        },
        body: form
    });

    const rawResponse = await response.text();

    console.log('========== PRP DELIVERY RESPONSE ==========');
    console.log('HTTP Status:', response.status);
    console.log('Response:', rawResponse || '[EMPTY RESPONSE]');
    console.log('===========================================');

    if (!response.ok) {
        throw new Error(
            `PRP Delivery API failed: ${response.status} ${rawResponse}`
        );
    }

    return rawResponse;
};

module.exports = {
    getDeliveryReport
};