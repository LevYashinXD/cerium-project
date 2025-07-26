// pages/api/admin-user-details.js

import { neon } from '@neondatabase/serverless';

// --- Add the re-usable security functions here ---
async function getVerifiedUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const response = await fetch('https://discord.com/api/users/@me', { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

function isAdmin(user) {
  if (!user || !user.id) return false;
  const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',');
  return adminIds.includes(user.id);
}
// --- End Functions ---

export default async function handler(req, res) {
  if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // FIXED: Authenticate using the standard Authorization header
    const user = await getVerifiedUser(req.headers.authorization);
    if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required.' });
    }

    const sql = neon(process.env.POSTGRES_URL);
    
    // Your query logic is fine, no changes needed here.
    const [userDetails] = await sql`SELECT * FROM users WHERE discord_id = ${userId}`;
    const comments = await sql`SELECT * FROM comments WHERE discord_id = ${userId} ORDER BY created_at DESC`;
    
    return res.status(200).json({ userDetails: userDetails || {}, comments });

  } catch (error) {
    console.error('Error fetching user details:', error);
    return res.status(500).json({ error: 'Failed to fetch user details.' });
  }
}