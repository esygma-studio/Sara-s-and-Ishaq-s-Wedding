const https = require('https');

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', chunk => { raw += chunk.toString(); });
        req.on('end', () => {
            try { resolve(JSON.parse(raw)); }
            catch { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}

function sendToResend(payload, apiKey) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const options = {
            hostname: 'api.resend.com',
            path: '/emails',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

module.exports = async function handler(req, res) {
    if (req.method === 'GET') {
        const key = process.env.RESEND_API_KEY;
        return res.status(200).json({
            keyPresent: !!key,
            keyStart: key ? key.substring(0, 8) : 'none',
            keyLength: key ? key.length : 0,
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let body;
    try {
        body = await parseBody(req);
    } catch {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    const { first_name, last_name, email, attending, guests, meal, message } = body;
    const isAttending = attending === 'yes';

    const html = `
        <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#3A2410;">
            <h2 style="color:#9A7840;border-bottom:1px solid #D9C4A8;padding-bottom:12px;">
                New Wedding RSVP
            </h2>
            <p><strong>Name:</strong> ${first_name} ${last_name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Attending:</strong> ${isAttending ? '✅ Joyfully Accepts' : '❌ Regretfully Declines'}</p>
            ${isAttending ? `
            <p><strong>Number of Guests:</strong> ${guests}</p>
            <p><strong>Meal Preference:</strong> ${meal}</p>
            ` : ''}
            ${message ? `<p><strong>Note:</strong> ${message}</p>` : ''}
            <hr style="border:none;border-top:1px solid #D9C4A8;margin-top:24px;">
            <p style="font-size:12px;color:#7A6250;">Ishaaq &amp; Sara — August 22, 2026</p>
        </div>
    `;

    try {
        const result = await sendToResend({
            from: 'Wedding RSVP <onboarding@resend.dev>',
            to: ['wieinvites@gmail.com'],
            reply_to: email,
            subject: `RSVP: ${first_name} ${last_name} — ${isAttending ? 'Attending ✅' : 'Not Attending ❌'}`,
            html,
        }, process.env.RESEND_API_KEY);

        console.log('Resend response:', result.status, result.body);

        if (result.status >= 200 && result.status < 300) {
            return res.status(200).json({ success: true });
        } else {
            const key = process.env.RESEND_API_KEY;
            const keyHint = key ? `${key.slice(0,6)}... (len:${key.length})` : 'undefined';
            return res.status(500).json({ error: 'Failed to send email', detail: result.body, keyHint });
        }
    } catch (err) {
        console.error('Handler error:', err.message);
        return res.status(500).json({ error: 'Failed to send email' });
    }
};
