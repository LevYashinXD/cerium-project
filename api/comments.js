import { neon } from '@neondatabase/serverless';

function isAdmin(user) {
  if (!user || !user.id) return false;
  const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',');
  return adminIds.includes(user.id);
}

export default async function handler(req, res) {
  const sql = neon(process.env.POSTGRES_URL);

  if (req.method === 'GET') {
    try {
      const { topic } = req.query;

      if (!topic) {
        const user = JSON.parse(req.headers['x-user-data'] || '{}');
        if (!isAdmin(user)) {
          return res.status(403).json({ error: 'Forbidden: Admin access required.' });
        }
        const comments = await sql`
          SELECT id, topic_id, user_id, user_name, user_avatar, content, created_at 
          FROM comments ORDER BY created_at DESC`;
        return res.status(200).json(comments);
      }

      const comments = await sql`
        SELECT id, topic_id, user_id, user_name, user_avatar, content, created_at 
        FROM comments WHERE topic_id = ${topic} ORDER BY created_at DESC`;
      return res.status(200).json(comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { topic, content, user } = req.body;
      if (!topic || !content || !user || !user.id || !user.username) {
        return res.status(400).json({ error: 'Missing required fields for comment.' });
      }
      const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null;
      const [newComment] = await sql`
        INSERT INTO comments (topic_id, user_id, user_name, user_avatar, content) 
        VALUES (${topic}, ${user.id}, ${user.username}, ${avatarUrl}, ${content})
        RETURNING *`;
      return res.status(201).json(newComment);
    } catch (error) {
      console.error('Error posting comment:', error);
      return res.status(500).json({ error: 'Failed to post comment' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { user, commentId } = req.body;

      if (!isAdmin(user)) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to delete comments.' });
      }

      if (!commentId) {
        return res.status(400).json({ error: 'Comment ID is required for deletion.' });
      }

      const result = await sql`DELETE FROM comments WHERE id = ${commentId}`;

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Comment not found.' });
      }

      return res.status(200).json({ message: 'Comment deleted successfully.' });
    } catch (error) {
      console.error('Error deleting comment:', error);
      return res.status(500).json({ error: 'Failed to delete comment.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
