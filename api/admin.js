// File: api/admin.js
import { neon } from '@neondatabase/serverless';

// --- Security Middleware: Check if a user is an admin ---
function isAdmin(user) {
  if (!user || !user.id) {
    console.log("Admin check failed: No user object or user.id");
    return false;
  }
  const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',');
  const result = adminIds.includes(user.id);
  console.log(`Admin check for ${user.id}: ${result ? 'SUCCESS' : 'FAILURE'}`);
  return result;
}

export default async function handler(req, res) {
  let user;

  // For GET, user data is in a header. For others, it's in the body.
  if (req.method === 'GET') {
    try {
      user = JSON.parse(req.headers['x-user-data']);
    } catch (e) {
      user = null;
    }
  } else {
    user = req.body.user;
  }
  
  // Centralized Admin Check for all methods
  if (!isAdmin(user)) {
    return res.status(403).json({ error: 'Forbidden: You do not have admin privileges.' });
  }
  
  const sql = neon(process.env.POSTGRES_URL);

  try {
    // --- GET ALL GAMES (for admin panel) ---
    if (req.method === 'GET') {
        const games = await sql`SELECT * FROM games ORDER BY display_order ASC, name ASC`;
        return res.status(200).json(games);
    }
    
    // --- CREATE A NEW GAME ---
    if (req.method === 'POST') {
      const { gameData } = req.body;
      const [newGame] = await sql`
        INSERT INTO games (name, status, thumbnail_url, loadstring, topic_id, is_published, display_order)
        VALUES (${gameData.name}, ${gameData.status}, ${gameData.thumbnail_url}, ${gameData.loadstring}, ${gameData.topic_id}, ${gameData.is_published}, ${gameData.display_order})
        RETURNING *`;
      return res.status(201).json(newGame);
    }

    // --- UPDATE A GAME ---
    if (req.method === 'PUT') {
      const { gameId, gameData } = req.body;
      const [updatedGame] = await sql`
        UPDATE games
        SET name = ${gameData.name}, status = ${gameData.status}, thumbnail_url = ${gameData.thumbnail_url}, loadstring = ${gameData.loadstring}, topic_id = ${gameData.topic_id}, is_published = ${gameData.is_published}, display_order = ${gameData.display_order}
        WHERE id = ${gameId}
        RETURNING *`;
      return res.status(200).json(updatedGame);
    }

    // --- DELETE A GAME ---
    if (req.method === 'DELETE') {
      const { gameId } = req.body;
      await sql`DELETE FROM games WHERE id = ${gameId}`;
      return res.status(200).json({ message: 'Game deleted successfully' });
    }

    // --- Method Not Allowed ---
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

  } catch (error) {
      console.error('Admin API Error:', error);
      return res.status(500).json({ error: 'An internal server error occurred', details: error.message });
  }
}