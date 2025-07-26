import { neon } from '@neondatabase/serverless';

// --- Standard Security Helper Functions ---

async function getVerifiedUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
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

// --- Main API Handler ---

export default async function handler(req, res) {
  const sql = neon(process.env.POSTGRES_URL);

  try {
    // --- Handle GET requests ---
    if (req.method === 'GET') {
      const { topic } = req.query;
      
      // Case 1: A normal user is fetching comments for a specific game page.
      // This is public and does not need an admin check.
      if (topic) {
        const comments = await sql`
          SELECT * FROM comments 
          WHERE topic_id = ${topic} 
          ORDER BY created_at DESC
        `;
        return res.status(200).json(comments);
      }
      
      // Case 2: An admin is fetching ALL comments for the admin panel.
      // This part MUST be protected with the secure token check.
      const user = await getVerifiedUser(req.headers.authorization);
      if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Forbidden: Admin access required.' });
      }

      const allComments = await sql`SELECT * FROM comments ORDER BY created_at DESC`;
      return res.status(200).json(allComments);
    }

    // --- Handle POST request (a user posts a comment) ---
    if (req.method === 'POST') {
      const { topic, content, user } = req.body;
      if (!topic || !content || !user || !user.id || !user.username) {
        return res.status(400).json({ error: 'Missing required fields for comment.' });
      }
      const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
      
      const [newComment] = await sql`
        INSERT INTO comments (topic_id, user_id, user_name, user_avatar, content) 
        VALUES (${topic}, ${user.id}, ${user.username}, ${avatarUrl}, ${content})
        RETURNING *`;
      return res.status(201).json(newComment);
    }

    // --- Handle DELETE request (admin deletes a comment) ---
    if (req.method === 'DELETE') {
      // This is an admin-only action and MUST be protected.
      const user = await getVerifiedUser(req.headers.authorization);
      if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to delete comments.' });
      }

      const { commentId } = req.body;
      if (!commentId) {
        return res.status(400).json({ error: 'Comment ID is required for deletion.' });
      }

      const result = await sql`DELETE FROM comments WHERE id = ${commentId}`;

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Comment not found.' });
      }

      return res.status(200).json({ message: 'Comment deleted successfully.' });
    }

    // If the method is not one of the above, deny it.
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);

  } catch (error) {
    console.error('Comments API Error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}