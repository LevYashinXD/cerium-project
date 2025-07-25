import { neon } from '@neondatabase/serverless';

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
    const { user, target_discord_id, action, duration_hours, reason } = req.body;

    if (!isAdmin(user)) {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
    if (!target_discord_id || !action) {
        return res.status(400).json({ error: 'Target user ID and action are required.' });
    }

    const sql = neon(process.env.POSTGRES_URL);
    const finalReason = reason || 'No reason provided.'; // Default reason

    switch (action) {
      case 'ban':
        await sql`UPDATE users SET is_banned = true, suspension_expires_at = NULL, moderation_reason = ${finalReason} WHERE discord_id = ${target_discord_id}`;
        return res.status(200).json({ message: 'User has been banned.' });
      
      case 'suspend':
        if (!duration_hours || duration_hours <= 0) {
            return res.status(400).json({ error: 'A positive duration in hours is required for suspension.' });
        }
        await sql`UPDATE users SET suspension_expires_at = NOW() + (interval '1 hour' * ${duration_hours}), is_banned = false, moderation_reason = ${finalReason} WHERE discord_id = ${target_discord_id}`;
        return res.status(200).json({ message: `User has been suspended for ${duration_hours} hours.` });

      case 'unban':
        // Unbanning also clears the reason
        await sql`UPDATE users SET is_banned = false, suspension_expires_at = NULL, moderation_reason = NULL WHERE discord_id = ${target_discord_id}`;
        return res.status(200).json({ message: 'User has been unbanned and unsuspended.' });

      default:
        return res.status(400).json({ error: 'Invalid action specified.' });
    }

  } catch (error) {
    console.error('User Moderation API Error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}