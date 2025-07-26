import { neon } from '@neondatabase/serverless';

// Helper function to get the verified user from a token
async function getVerifiedUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7); // Remove "Bearer " prefix
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

// Helper function to check if a user is an admin
function isAdmin(user) {
  if (!user || !user.id) return false;
  const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',');
  return adminIds.includes(user.id);
}

export default async function handler(req, res) {
  // This endpoint should only accept POST requests, as per the client-side code
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Get the real, verified user from the token in the request header.
    const user = await getVerifiedUser(req.headers.authorization);

    // 2. Check if the verified user is an admin.
    if (isAdmin(user)) {
      return res.status(200).json({ isAdmin: true });
    } else {
      // If the user is not an admin, or the token is invalid, deny access.
      return res.status(403).json({ isAdmin: false, error: 'Forbidden' });
    }
  } catch (error) {
    console.error('Check Admin API Error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}