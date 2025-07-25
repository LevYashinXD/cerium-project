import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = req.body.user;

    // Validate that we have the necessary user data
    if (!user || !user.id || !user.username) {
      return res.status(400).json({ error: 'Valid user data is required.' });
    }

    const sql = neon(process.env.POSTGRES_URL);
    const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null;

    // Use an "UPSERT" command:
    // INSERT a new user if their discord_id doesn't exist.
    // ON CONFLICT (if they do exist), UPDATE their details.
    await sql`
      INSERT INTO users (discord_id, username, avatar_url, last_seen)
      VALUES (${user.id}, ${user.username}, ${avatarUrl}, CURRENT_TIMESTAMP)
      ON CONFLICT (discord_id) DO UPDATE
      SET
        username = EXCLUDED.username,
        avatar_url = EXCLUDED.avatar_url,
        last_seen = CURRENT_TIMESTAMP;
    `;

    return res.status(200).json({ message: 'User presence recorded.' });

  } catch (error) {
    console.error('Record Login API Error:', error);
    return res.status(500).json({ error: 'Failed to record user presence.' });
  }
}