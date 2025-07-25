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
    
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    const sql = neon(process.env.POSTGRES_URL);
    
    const [userDetails] = await sql`SELECT * FROM users WHERE discord_id = ${userId}`;
    const comments = await sql`SELECT * FROM comments WHERE user_id = ${userId} ORDER BY created_at DESC`;
    
    res.status(200).json({ userDetails: userDetails || {}, comments });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details.' });
  }
}