import { neon } from '@neondatabase/serverless';

function isAdmin(user) {
  if (!user || !user.id) return false;
  const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',');
  return adminIds.includes(user.id);
}

async function logAction(sql, adminUser, action_type, target_id, reason) {
  try {
    await sql`
      INSERT INTO audit_log (admin_discord_id, admin_username, action_type, target_id, reason)
      VALUES (${adminUser.id}, ${adminUser.username}, ${action_type}, ${target_id}, ${reason})
    `;
  } catch (error) {
    console.error("Audit logging failed:", error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { user, targetUser, action, duration_hours, reason } = req.body;

    if (!isAdmin(user)) {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
    if (!targetUser || !targetUser.discord_id || !targetUser.username || !action) {
      return res.status(400).json({ error: 'Target user object and action are required.' });
    }

    const sql = neon(process.env.POSTGRES_URL);
    const finalReason = reason || 'No reason provided.';

    switch (action) {
      case 'ban':
        await sql`
          INSERT INTO users (discord_id, username, is_banned, moderation_reason)
          VALUES (${targetUser.discord_id}, ${targetUser.username}, true, ${finalReason})
          ON CONFLICT (discord_id) DO UPDATE SET
            is_banned = true, suspension_expires_at = NULL,
            moderation_reason = EXCLUDED.moderation_reason, username = EXCLUDED.username;
        `;
        await logAction(sql, user, 'ban_user', targetUser.discord_id, finalReason);
        return res.status(200).json({ message: 'User has been banned.' });

      case 'suspend':
        if (!duration_hours || duration_hours <= 0) {
          return res.status(400).json({ error: 'A positive duration is required.' });
        }
        await sql`
          INSERT INTO users (discord_id, username, suspension_expires_at, is_banned, moderation_reason)
          VALUES (${targetUser.discord_id}, ${targetUser.username}, NOW() + (interval '1 hour' * ${duration_hours}), false, ${finalReason})
          ON CONFLICT (discord_id) DO UPDATE SET
            suspension_expires_at = NOW() + (interval '1 hour' * ${duration_hours}), is_banned = false,
            moderation_reason = EXCLUDED.moderation_reason, username = EXCLUDED.username;
        `;
        await logAction(sql, user, 'suspend_user', targetUser.discord_id, `Suspended for ${duration_hours}h. Reason: ${finalReason}`);
        return res.status(200).json({ message: `User suspended for ${duration_hours} hours.` });

      case 'unban':
        await sql`
          UPDATE users SET is_banned = false, suspension_expires_at = NULL, moderation_reason = NULL 
          WHERE discord_id = ${targetUser.discord_id}`;
        await logAction(sql, user, 'unban_user', targetUser.discord_id, 'Restrictions removed');
        return res.status(200).json({ message: 'User restrictions have been removed.' });

      case 'warn':
        await sql`
          INSERT INTO warns (user_id, admin_id, admin_username, reason)
          VALUES (${targetUser.discord_id}, ${user.id}, ${user.username}, ${finalReason})
        `;
        await logAction(sql, user, 'warn_user', targetUser.discord_id, `Warned user. Reason: ${finalReason}`);
        return res.status(200).json({ message: 'User has been warned.' });

      default:
        return res.status(400).json({ error: 'Invalid action specified.' });
    }

  } catch (error) {
    console.error('User Moderation API Error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
