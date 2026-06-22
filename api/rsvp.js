const nodemailer = require('nodemailer');

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

module.exports = async function handler(req, res) {
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

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
        },
    });

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
        await transporter.sendMail({
            from: `"Wedding RSVP" <${process.env.GMAIL_USER}>`,
            to: 'Kamawaal@yahoo.com',
            replyTo: email,
            subject: `RSVP: ${first_name} ${last_name} — ${isAttending ? 'Attending ✅' : 'Not Attending ❌'}`,
            html,
        });

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Mail error:', err.message);
        return res.status(500).json({ error: 'Failed to send email', detail: err.message });
    }
};
