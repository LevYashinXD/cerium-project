// pages/api/admin-user-details.js

import { neon } from '@neondatabase/serverless';

// --- Re-usable Security Functions ---
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
    const user = await getVerifiedUser(req.headers.authorization);
    if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required.' });
    }

    const sql = neon(process.env.POSTGRES_URL);
    
    // This query is likely correct, assuming your 'users' table uses 'discord_id'
    const [userDetails] = await sql`SELECT * FROM users WHERE discord_id = ${userId}`;
    
    // ***** THIS IS THE FIXED LINE *****
    // The 'comments' table uses the 'user_id' column to reference the Discord ID.
    const comments = await sql`SELECT * FROM comments WHERE user_id = ${userId} ORDER BY created_at DESC`;
    
    // If the user has no details in the users table yet, it's not an error.
    // The modal can still show their comments. Return what we found.
    return res.status(200).json({ userDetails: userDetails || {}, comments });

  } catch (error) {
    // This catch block is triggered when a database query fails, like the one we just fixed.
    console.error('Error fetching user details:', error);
    return res.status(500).json({ error: 'Failed to fetch user details due to a server error.' });
  }
}