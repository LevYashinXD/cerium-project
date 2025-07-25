// File: api/comments.js

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.POSTGRES_URL);

  // --- HANDLE GETTING COMMENTS ---
  if (req.method === 'GET') {
    try {
      const { topic } = req.query;
      if (!topic) {
        return res.status(400).json({ error: 'Topic is required' });
      }

      const allComments = await sql`
        SELECT id, topic_id, parent_id, user_id, user_name, user_avatar, content, created_at 
        FROM comments 
        WHERE topic_id = ${topic} 
        ORDER BY created_at ASC
      `;

      const commentsById = {};
      const rootComments = [];

      allComments.forEach(comment => {
        commentsById[comment.id] = { ...comment, replies: [] };
      });

      allComments.forEach(comment => {
        if (comment.parent_id && commentsById[comment.parent_id]) {
          commentsById[comment.parent_id].replies.push(commentsById[comment.id]);
        } else {
          rootComments.push(commentsById[comment.id]);
        }
      });
      
      return res.status(200).json(rootComments.reverse());

    } catch (error) {
      console.error('Error fetching comments:', error);
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }
  }

  // --- HANDLE POSTING A NEW COMMENT OR REPLY ---
  if (req.method === 'POST') {
    try {
      const { topic, content, user, parentId } = req.body;
      
      if (!topic || !content || !user || !user.id || !user.username) {
        return res.status(400).json({ error: 'Missing required fields for comment.' });
      }
      
      const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null;

      // ==========================================================
      // THIS IS THE FIX: Ensure parentId is an integer or null
      const parentIdInt = parentId ? parseInt(parentId, 10) : null;
      // ==========================================================

      const [newComment] = await sql`
        INSERT INTO comments (topic_id, user_id, user_name, user_avatar, content, parent_id) 
        VALUES (${topic}, ${user.id}, ${user.username}, ${avatarUrl}, ${content}, ${parentIdInt})
        RETURNING *
      `;

      return res.status(201).json(newComment);

    } catch (error) {
      console.error('Error posting comment:', error);
      return res.status(500).json({ error: 'Failed to post comment' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}