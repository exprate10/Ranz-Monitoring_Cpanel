// GET /api/status?password=xxx
// Dashboard data

const { kv } = require('@vercel/kv');

const ADMIN_PASSWORD = 'Ranz123Key';

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { password } = req.query || {};

        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ ok: false, reason: 'Unauthorized' });
        }

        const customers = await kv.get('customers') || [];
        const online = await kv.get('online') || {};
        const logs = await kv.get('logs') || [];

        // Ambil semua license
        const allLicenses = [];
        const allKeys = await kv.keys('license:');
        
        for (const key of allKeys) {
            const data = await kv.get(key);
            if (data) {
                allLicenses.push({
                    license_key: data.license_key,
                    customer_id: data.customer_id,
                    status: data.status,
                    created_at: data.created_at,
                    expires_at: data.expires_at,
                    last_heartbeat: data.last_heartbeat,
                    total_uptime: data.total_uptime,
                    is_online: data.last_heartbeat && (Date.now() - data.last_heartbeat < 60 * 60 * 1000)
                });
            }
        }

        const stats = {
            total_customers: customers.length,
            active_licenses: allLicenses.filter(l => l.status === 'active').length,
            expired_licenses: allLicenses.filter(l => l.status === 'expired').length,
            frozen_licenses: allLicenses.filter(l => l.status === 'frozen').length,
            online_now: Object.keys(online).length
        };

        return res.json({
            ok: true,
            stats,
            customers: allLicenses,
            logs: logs.slice(-50).reverse()
        });

    } catch (e) {
        return res.json({ ok: false, reason: 'Server error' });
    }
};