// pages/api/admin-moderate-user.js

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

async function logAction(sql, adminUser, action_type, target_id, reason) {
  // ... (Your logAction function is fine, no changes needed)
  try {
    await sql`
      INSERT INTO audit_log (admin_discord_id, admin_username, action_type, target_id, reason)
      VALUES (${adminUser.id}, ${adminUser.username}, ${action_type}, ${target_id}, ${reason})
    `;
  } catch (error) {
    console.error("Audit logging failed:", error);
  }
}
// --- End Functions ---


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // FIXED: Get the admin user from the auth header, not the body
    const adminUser = await getVerifiedUser(req.headers.authorization);
    if (!isAdmin(adminUser)) {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }

    // REMOVED: `user` is no longer needed from the body
    const { targetUser, action, duration_hours, reason } = req.body;
    
    if (!targetUser || !targetUser.discord_id || !action) {
      return res.status(400).json({ error: 'Target user object and action are required.' });
    }

    const sql = neon(process.env.POSTGRES_URL);
    const finalReason = reason || 'No reason provided.';

    // Your switch statement logic is excellent and doesn't need changes,
    // just make sure to pass the verified `adminUser` to logAction.
    switch (action) {
      case 'ban':
        await sql`
          UPDATE users SET is_banned = TRUE, suspension_expires_at = NULL, moderation_reason = ${finalReason}
          WHERE discord_id = ${targetUser.discord_id}
        `;
        await logAction(sql, adminUser, 'ban_user', targetUser.discord_id, finalReason);
        return res.status(200).json({ message: `${targetUser.username} has been banned.` });

      case 'suspend':
        const suspension_expires_at = new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString();
        await sql`
            UPDATE users SET is_banned = FALSE, suspension_expires_at = ${suspension_expires_at}, moderation_reason = ${finalReason}
            WHERE discord_id = ${targetUser.discord_id}
        `;
        await logAction(sql, adminUser, 'suspend_user', targetUser.discord_id, `Suspended for ${duration_hours}h. Reason: ${finalReason}`);
        return res.status(200).json({ message: `${targetUser.username} has been suspended for ${duration_hours} hours.` });

      case 'unban':
        await sql`
          UPDATE users SET is_banned = false, suspension_expires_at = NULL, moderation_reason = NULL 
          WHERE discord_id = ${targetUser.discord_id}`;
        await logAction(sql, adminUser, 'unban_user', targetUser.discord_id, 'Restrictions removed');
        return res.status(200).json({ message: 'User restrictions have been removed.' });
      
      // Removed the 'warn' case as it was not in the previous code and might be confusing.
      // If you need it, ensure the 'warns' table exists.

      default:
        return res.status(400).json({ error: 'Invalid action specified.' });
    }

  } catch (error) {
    console.error('User Moderation API Error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}