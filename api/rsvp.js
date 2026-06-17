const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { first_name, last_name, email, attending, guests, meal, message } = req.body;

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
        await resend.emails.send({
            from: 'Wedding RSVP <onboarding@resend.dev>',
            to: 'wieinvites@gmail.com',
            reply_to: email,
            subject: `RSVP: ${first_name} ${last_name} — ${isAttending ? 'Attending ✅' : 'Not Attending ❌'}`,
            html,
        });

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to send email' });
    }
};
