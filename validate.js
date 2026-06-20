const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
    // CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, reason: 'Method not allowed' });
    }

    try {
        const { license, token } = req.body || {};

        // Cek format
        if (!license || !license.startsWith('RANZ-')) {
            return res.json({ ok: false, reason: 'Format license tidak valid' });
        }

        if (!token || !token.includes(':')) {
            return res.json({ ok: false, reason: 'Bot token tidak valid' });
        }

        // Cek di database
        const data = await kv.get(`license:${license}`);
        
        if (!data) {
            return res.json({ ok: false, reason: 'License tidak ditemukan' });
        }

        // Cek status
        if (data.status === 'frozen') {
            return res.json({ ok: false, reason: 'License dibekukan oleh owner' });
        }

        if (data.status === 'deleted') {
            return res.json({ ok: false, reason: 'License telah dihapus' });
        }

        // Cek token cocok
        if (data.bot_token !== token) {
            return res.json({ ok: false, reason: 'Bot token tidak cocok dengan license' });
        }

        // Cek expired
        if (data.expires_at && Date.now() > data.expires_at) {
            // Update status ke expired
            data.status = 'expired';
            await kv.set(`license:${license}`, data);
            return res.json({ ok: false, reason: 'License expired', expired: true });
        }

        // Update last validate
        data.last_validate = Date.now();
        data.device = req.body.device || 'unknown';
        await kv.set(`license:${license}`, data);

        // Log
        const logs = await kv.get('logs') || [];
        logs.push({
            time: Date.now(),
            customer: data.customer_id,
            action: 'validate',
            status: 'ok'
        });
        if (logs.length > 500) logs.shift();
        await kv.set('logs', logs);

        return res.json({
            ok: true,
            customer_id: data.customer_id,
            created_at: data.created_at,
            expires_at: data.expires_at,
            remaining_days: data.expires_at 
                ? Math.ceil((data.expires_at - Date.now()) / 86400000)
                : 'Unlimited',
            status: data.status
        });

    } catch (e) {
        return res.json({ ok: false, reason: 'Server error' });
    }
};