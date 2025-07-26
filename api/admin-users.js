import { neon } from '@neondatabase/serverless';

// --- Standard Security Helper Functions ---

async function getVerifiedUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `Bearer ${token}` },
    });
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

// --- Main API Handler ---

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Securely verify the user making the request from their token.
    const user = await getVerifiedUser(req.headers.authorization);

    // 2. Check if the verified user has admin privileges.
    if (!isAdmin(user)) {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }

    // 3. If they are an admin, proceed to fetch the user data.
    const sql = neon(process.env.POSTGRES_URL);
    // This query now includes the moderation status fields
    const users = await sql`
      SELECT 
        discord_id, 
        username, 
        avatar_url, 
        join_date, 
        last_seen, 
        is_banned, 
        suspension_expires_at, 
        moderation_reason 
      FROM users 
      ORDER BY join_date DESC
    `;

    return res.status(200).json(users);

  } catch (error) {
    console.error('Admin Users API Error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}