import { neon } from '@neondatabase/serverless';

function isAdmin(user) {
  if (!user || !user.id) return false;
  const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',');
  return adminIds.includes(user.id);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const user = JSON.parse(req.headers['x-user-data'] || '{}');
    if (!isAdmin(user)) return res.status(403).json({ error: 'Forbidden' });

    const sql = neon(process.env.POSTGRES_URL);
    const logs = await sql`SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100`;
    res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log.' });
  }
}