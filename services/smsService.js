const PRP_SMS_URL =
    'https://api.prpsms.biz/BulkSMSapi/keyApiSendSMS/SendSmsTemplateName';

const sendOtpSms = async (phone, otp) => {
    const cleanPhone = String(phone).replace(/\D/g, '');

    const receiver =
        cleanPhone.startsWith('91') && cleanPhone.length === 12
            ? cleanPhone.substring(2)
            : cleanPhone;

    const templateName =
        process.env.PRP_CABS_TEMPLATE_NAME || 'for Cab';

    /*
     * DLT Template "for Cab" (Template ID: 1207173693843944629):
     * "{#var#} is the OTP to validate your phone number with the BroomBoom Cabs App. Please do not share the OTP with anyone, BroomBoom Cabs Thanks."
     *
     * There is exactly ONE template variable ({#var#}) at the beginning,
     * which must be the OTP itself (e.g. 5821).
     */
    const templateParams = String(otp);

    const payload = {
        sender: process.env.PRP_SENDER_ID || 'BBCABS',
        templateName,

        smsReciever: [
            {
                mobileNo: receiver,
                templateParams
            }
        ]
    };

    console.log('\n========== PRP SMS REQUEST ==========');
    console.log('Sender:', payload.sender);
    console.log('Template:', payload.templateName);

    console.log('=====================================\n');

    const response = await fetch(PRP_SMS_URL, {
        method: 'POST',

        headers: {
            apikey: process.env.PRP_SMS_API_KEY,
            'Content-Type': 'application/json'
        },

        body: JSON.stringify(payload)
    });

    const rawResponse = await response.text();

    console.log('PRP HTTP Status:', response.status);
    console.log('PRP Raw Response:', rawResponse);

    let data;

    try {
        data = JSON.parse(rawResponse);
    } catch {
        throw new Error(
            `PRP returned non-JSON response: ${rawResponse}`
        );
    }

    console.log('PRP SMS Response:', data);

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.returnMessage ||
            `PRP SMS failed with HTTP ${response.status}`
        );
    }

    if (
        data.isSuccess === false ||
        data.status === 'error'
    ) {
        throw new Error(
            data.message ||
            data.returnMessage ||
            'PRP rejected the SMS'
        );
    }

    const messageId = data.data;

    if (!messageId) {
        throw new Error(
            'PRP accepted the request but did not return a message ID'
        );
    }

    console.log('PRP MESSAGE ID:', messageId);

    return {
        success: true,
        messageId,
        raw: data
    };
};

module.exports = {
    sendOtpSms
};