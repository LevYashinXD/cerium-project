// File: /api/admin.js
import { neon } from '@neondatabase/serverless';

/**
 * Checks if a user object represents an authorized admin.
 * @param {object | null} user - The user object from the request.
 * @returns {boolean} - True if the user is an admin, false otherwise.
 */
function isAdmin(user) {
  if (!user || !user.id) {
    return false;
  }
  const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',');
  return adminIds.includes(user.id);
}

/**
 * Logs an administrative action to the audit_log table.
 * @param {object} sql - The neon sql object for database queries.
 * @param {object} adminUser - The user object of the admin performing the action.
 * @param {string} action_type - A short description of the action (e.g., 'create_game').
 * @param {string} target_id - The ID of the object being affected (e.g., a game's ID).
 * @param {string} reason - A more detailed description of the action for the log.
 */
async function logAction(sql, adminUser, action_type, target_id, reason) {
  try {
    await sql`
      INSERT INTO audit_log (admin_discord_id, admin_username, action_type, target_id, reason)
      VALUES (${adminUser.id}, ${adminUser.username}, ${action_type}, ${target_id}, ${reason})
    `;
  } catch (error) {
    // Log the error but don't crash the main request if logging fails.
    console.error("Audit logging failed:", error);
  }
}

export default async function handler(req, res) {
  // --- 1. AUTHENTICATION & AUTHORIZATION ---
  let user;

  // For GET requests, user data is expected in a header.
  // For POST, PUT, DELETE, it's expected in the body.
  if (req.method === 'GET') {
    try {
      user = JSON.parse(req.headers['x-user-data'] || '{}');
    } catch (e) {
      user = null;
    }
  } else {
    user = req.body.user;
  }
  
  // SECURITY GATE: If the user is not an admin, deny access immediately.
  if (!isAdmin(user)) {
    return res.status(403).json({ error: 'Forbidden: You do not have admin privileges.' });
  }
  
  // --- 2. DATABASE CONNECTION ---
  const sql = neon(process.env.POSTGRES_URL);

  try {
    // --- 3. METHOD ROUTING ---

    // --- GET ALL GAMES (for admin panel) ---
    if (req.method === 'GET') {
        const games = await sql`SELECT * FROM games ORDER BY display_order ASC, name ASC`;
        return res.status(200).json(games);
    }
    
    // --- CREATE A NEW GAME ---
    if (req.method === 'POST') {
      const { gameData } = req.body;
      const [newGame] = await sql`
        INSERT INTO games (name, status, thumbnail_url, loadstring, topic_id, is_published, display_order, features_html)
        VALUES (${gameData.name}, ${gameData.status}, ${gameData.thumbnail_url}, ${gameData.loadstring}, ${gameData.topic_id}, ${gameData.is_published}, ${gameData.display_order}, ${gameData.features_html})
        RETURNING *`;
      
      await logAction(sql, user, 'create_game', newGame.id, `Created game: ${gameData.name}`);
      return res.status(201).json(newGame);
    }

    // --- UPDATE AN EXISTING GAME ---
    if (req.method === 'PUT') {
      const { gameId, gameData } = req.body;
      const [updatedGame] = await sql`
        UPDATE games
        SET name = ${gameData.name}, status = ${gameData.status}, thumbnail_url = ${gameData.thumbnail_url}, loadstring = ${gameData.loadstring}, topic_id = ${gameData.topic_id}, is_published = ${gameData.is_published}, display_order = ${gameData.display_order}, features_html = ${gameData.features_html}
        WHERE id = ${gameId}
        RETURNING *`;

      if (!updatedGame) {
        return res.status(404).json({ error: 'Game not found.' });
      }

      await logAction(sql, user, 'update_game', gameId, `Updated game: ${gameData.name}`);
      return res.status(200).json(updatedGame);
    }

    // --- DELETE A GAME ---
    if (req.method === 'DELETE') {
      // NOTE: The frontend must send 'gameName' in the body for better logging.
      const { gameId, gameName } = req.body;
      if (!gameId) {
        return res.status(400).json({ error: 'Game ID is required for deletion.' });
      }

      const result = await sql`DELETE FROM games WHERE id = ${gameId}`;

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Game not found.' });
      }

      await logAction(sql, user, 'delete_game', gameId, `Deleted game: ${gameName || `(ID: ${gameId})`}`);
      return res.status(200).json({ message: 'Game deleted successfully' });
    }

    // --- If method is not handled ---
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

  } catch (error) {
      console.error('Admin API Error:', error);
      return res.status(500).json({ error: 'An internal server error occurred', details: error.message });
  }
}