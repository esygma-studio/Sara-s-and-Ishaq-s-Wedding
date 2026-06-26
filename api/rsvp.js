const https = require('https');
const { URL } = require('url');

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

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        }).on('error', reject);
    });
}

function postToAppsScript(body) {
    return new Promise((resolve, reject) => {
        const bodyStr = JSON.stringify(body);
        const u = new URL('https://script.google.com/macros/s/AKfycbyoOkuf2HmVQn5FelPZivyiLYV1BLM1DOA7vk9NlttRGuNtQ1wKLMckS7FIKRUGTVDnBg/exec');

        const options = {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', async () => {
                // Apps Script returns a 302 redirect — follow it to get the actual JSON response
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    try {
                        const result = await httpsGet(res.headers.location);
                        resolve(result);
                    } catch (e) { reject(e); }
                } else {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        req.write(bodyStr);
        req.end();
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

    try {
        const result = await postToAppsScript(body);
        console.log('Apps Script response:', result.status, result.body);

        let parsed = {};
        try { parsed = JSON.parse(result.body); } catch {}

        if (parsed.success) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(500).json({ error: 'Failed to record RSVP', detail: result.body });
        }
    } catch (err) {
        console.error('Error:', err.message);
        return res.status(500).json({ error: 'Failed to record RSVP', detail: err.message });
    }
};
