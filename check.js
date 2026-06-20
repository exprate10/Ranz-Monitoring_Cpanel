// POST /api/check
// Script customer cek apakah di-freeze/expired

const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false });

    try {
        const { license } = req.body || {};

        if (!license || !license.startsWith('RANZ-')) {
            return res.json({ frozen: true, reason: 'Invalid' });
        }

        const data = await kv.get(`license:${license}`);
        
        if (!data) {
            return res.json({ frozen: true, reason: 'Not found' });
        }

        // Cek frozen
        if (data.status === 'frozen') {
            return res.json({ frozen: true, reason: 'Dibekukan owner' });
        }

        // Cek deleted
        if (data.status === 'deleted') {
            return res.json({ frozen: true, reason: 'License dihapus' });
        }

        // Cek expired
        if (data.expires_at && Date.now() > data.expires_at) {
            data.status = 'expired';
            await kv.set(`license:${license}`, data);
            return res.json({ frozen: true, reason: 'Expired', expired: true });
        }

        return res.json({ frozen: false });

    } catch (e) {
        return res.json({ frozen: false });
    }
};