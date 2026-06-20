// POST /api/heartbeat
// Script customer lapor status tiap 30 menit

const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false });

    try {
        const { license, uptime, memory, platform, pid } = req.body || {};

        if (!license || !license.startsWith('RANZ-')) {
            return res.json({ ok: false });
        }

        const data = await kv.get(`license:${license}`);
        
        if (!data) {
            return res.json({ ok: false, reason: 'License not found' });
        }

        // Update heartbeat
        data.last_heartbeat = Date.now();
        data.uptime = uptime || 0;
        data.memory = memory || 0;
        data.platform = platform || 'unknown';
        data.pid = pid || 0;

        // Hitung total uptime
        data.total_uptime = (data.total_uptime || 0) + 1800; // +30 menit

        await kv.set(`license:${license}`, data);

        // Update online status
        const online = await kv.get('online') || {};
        online[data.customer_id] = {
            license,
            last_seen: Date.now(),
            uptime: data.total_uptime
        };
        await kv.set('online', online);

        return res.json({ ok: true });

    } catch (e) {
        return res.json({ ok: false });
    }
};