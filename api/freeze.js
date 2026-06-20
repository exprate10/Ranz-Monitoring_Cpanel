// POST /api/freeze
// Freeze/unfreeze customer

const { kv } = require('@vercel/kv');

const ADMIN_PASSWORD = 'Ranz123Key';

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false });

    try {
        const { password, license, action } = req.body || {};

        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ ok: false, reason: 'Password salah' });
        }

        const data = await kv.get(`license:${license}`);
        if (!data) {
            return res.json({ ok: false, reason: 'License tidak ditemukan' });
        }

        if (action === 'freeze') {
            data.status = 'frozen';
        } else if (action === 'unfreeze') {
            data.status = 'active';
        } else if (action === 'delete') {
            data.status = 'deleted';
            await kv.del(`token:${data.bot_token}`);
        }

        await kv.set(`license:${license}`, data);

        const logs = await kv.get('logs') || [];
        logs.push({
            time: Date.now(),
            customer: data.customer_id,
            action: action,
            status: 'ok'
        });
        await kv.set('logs', logs);

        return res.json({ ok: true, status: data.status });

    } catch (e) {
        return res.json({ ok: false, reason: 'Server error' });
    }
};