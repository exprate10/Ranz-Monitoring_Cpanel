// POST /api/generate
// Hanya owner yang bisa generate license

const { kv } = require('@vercel/kv');
const crypto = require('crypto');

const SECRET = 'RANZ-OFFC-SECRET-KEY-2026';
const ADMIN_PASSWORD = 'Ranz123Key';

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false });

    try {
        const { password, customer_id, bot_token, duration } = req.body || {};

        // Auth
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ ok: false, reason: 'Password salah' });
        }

        if (!customer_id || !bot_token || !duration) {
            return res.json({ ok: false, reason: 'Data tidak lengkap' });
        }

        // Cek apakah token sudah dipakai
        const existing = await kv.get(`token:${bot_token}`);
        if (existing) {
            return res.json({ ok: false, reason: 'Bot token sudah terdaftar dengan license lain' });
        }

        // Generate license
        const payload = {
            customer_id: customer_id.toUpperCase(),
            bot_token,
            created_at: Date.now(),
            expires_at: duration === 'lifetime' ? null : Date.now() + (duration * 86400000),
            duration_days: duration === 'lifetime' ? 'lifetime' : duration
        };

        const payloadStr = JSON.stringify(payload);
        const payloadB64 = Buffer.from(payloadStr).toString('base64');
        const signature = crypto.createHmac('sha256', SECRET).update(payloadB64).digest('hex').slice(0, 16);
        const licenseKey = `RANZ-${payloadB64}.${signature}`;

        // Simpan ke database
        const licenseData = {
            ...payload,
            license_key: licenseKey,
            status: 'active',
            last_validate: null,
            last_heartbeat: null,
            total_uptime: 0,
            created_by: 'admin'
        };

        await kv.set(`license:${licenseKey}`, licenseData);
        await kv.set(`token:${bot_token}`, licenseKey);

        // Tambah customer list
        const customers = await kv.get('customers') || [];
        if (!customers.includes(customer_id.toUpperCase())) {
            customers.push(customer_id.toUpperCase());
            await kv.set('customers', customers);
        }

        // Log
        const logs = await kv.get('logs') || [];
        logs.push({
            time: Date.now(),
            customer: customer_id.toUpperCase(),
            action: 'generate',
            status: 'ok',
            detail: `${duration} hari`
        });
        if (logs.length > 500) logs.shift();
        await kv.set('logs', logs);

        return res.json({
            ok: true,
            license_key: licenseKey,
            customer_id: customer_id.toUpperCase(),
            duration: duration === 'lifetime' ? 'Lifetime' : `${duration} hari`,
            expires_at: payload.expires_at
        });

    } catch (e) {
        return res.json({ ok: false, reason: 'Server error' });
    }
};