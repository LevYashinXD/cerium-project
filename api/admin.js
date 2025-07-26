import { neon } from '@neondatabase/serverless';

// Helper function to get the verified user from a token
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

// Helper function to check if a user is an admin
function isAdmin(user) {
  if (!user || !user.id) return false;
  const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',');
  return adminIds.includes(user.id);
}

export default async function handler(req, res) {
  try {
    // 1. Authenticate the user from the token on EVERY request.
    const user = await getVerifiedUser(req.headers.authorization);

    // 2. Check for admin privileges using the VERIFIED user object.
    if (!isAdmin(user)) {
      return res.status(403).json({ error: 'Forbidden: You do not have admin privileges.' });
    }

    const sql = neon(process.env.POSTGRES_URL);

    // Handle GET request to fetch all games
    if (req.method === 'GET') {
      const games = await sql`SELECT * FROM games ORDER BY display_order ASC, name ASC`;
      return res.status(200).json(games);
    }

    // Handle POST request to create a new game
    if (req.method === 'POST') {
      const { gameData } = req.body;
      const [newGame] = await sql`
        INSERT INTO games (name, status, thumbnail_url, loadstring, "key", topic_id, is_published, display_order, features_html)
        VALUES (${gameData.name}, ${gameData.status}, ${gameData.thumbnail_url}, ${gameData.loadstring}, ${gameData.key}, ${gameData.topic_id}, ${gameData.is_published}, ${gameData.display_order}, ${gameData.features_html})
        RETURNING *`;
      return res.status(201).json(newGame);
    }

    // Handle PUT request to update an existing game
    if (req.method === 'PUT') {
      const { gameId, gameData } = req.body;
      const [updatedGame] = await sql`
        UPDATE games
        SET 
          name = ${gameData.name}, status = ${gameData.status}, thumbnail_url = ${gameData.thumbnail_url}, 
          loadstring = ${gameData.loadstring}, "key" = ${gameData.key}, topic_id = ${gameData.topic_id}, 
          is_published = ${gameData.is_published}, display_order = ${gameData.display_order},
          features_html = ${gameData.features_html}
        WHERE id = ${gameId}
        RETURNING *`;
      return res.status(200).json(updatedGame);
    }

    // Handle DELETE request to remove a game
    if (req.method === 'DELETE') {
      const { gameId } = req.body;
      await sql`DELETE FROM games WHERE id = ${gameId}`;
      return res.status(200).json({ message: 'Game deleted successfully' });
    }

    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

  } catch (error) {
    console.error('Admin API Error:', error);
    return res.status(500).json({ error: 'An internal server error occurred', details: error.message });
  }
}