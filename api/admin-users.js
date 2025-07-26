import { neon } from '@neondatabase/serverless';

function isAdmin(user) {
  if (!user || !user.id) return false;
  const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',');
  return adminIds.includes(user.id);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = JSON.parse(req.headers['x-user-data'] || '{}');
    if (!isAdmin(user)) {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid user data provided.' });
  }

  try {
    const sql = neon(process.env.POSTGRES_URL);
    const users = await sql`
      SELECT discord_id, username, avatar_url, join_date, comment_count, report_count, last_seen 
      FROM users 
      ORDER BY last_seen DESC NULLS LAST, join_date DESC
    `;
    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching admin users list:', error);
    return res.status(500).json({ error: 'Failed to fetch users list.' });
  }
}