import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    const sql = neon(process.env.POSTGRES_URL);
    const [user] = await sql`SELECT is_banned, suspension_expires_at, moderation_reason FROM users WHERE discord_id = ${userId}`;

    if (!user) {
      return res.status(200).json({ status: 'ok' });
    }

    if (user.is_banned) {
      return res.status(200).json({ status: 'banned', reason: user.moderation_reason });
    }

    if (user.suspension_expires_at && new Date(user.suspension_expires_at) > new Date()) {
      return res.status(200).json({ status: 'suspended', expires: user.suspension_expires_at, reason: user.moderation_reason });
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Check User Status API Error:', error);
    return res.status(200).json({ status: 'ok' });
  }
}
