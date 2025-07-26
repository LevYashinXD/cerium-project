import { neon } from '@neondatabase/serverless';

async function getVerifiedUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await getVerifiedUser(req.headers.authorization);

    if (isAdmin(user)) {
      return res.status(200).json({ isAdmin: true });
    } else {
      return res.status(403).json({ isAdmin: false, error: 'Forbidden' });
    }
  } catch (error) {
    console.error('Check Admin API Error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
