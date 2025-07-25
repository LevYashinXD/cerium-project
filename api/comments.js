// File: api/comments.js

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.POSTGRES_URL);

    // --- HANDLE GETTING COMMENTS ---
    if (req.method === 'GET') {
      const { topic } = req.query;
      if (!topic) {
        return res.status(400).json({ error: 'Topic is required' });
      }

      // 1. Fetch ALL comments for the topic, including the new parent_id column.
      const allComments = await sql`
        SELECT id, topic_id, parent_id, user_id, user_name, user_avatar, content, created_at 
        FROM comments 
        WHERE topic_id = ${topic} 
        ORDER BY created_at ASC
      `;
      
      // 2. Process the flat list into a nested structure (a tree)
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
      
      // 3. Return the nested structure, reversing the root comments to show newest first.
      return res.status(200).json(rootComments.reverse());
    }

    // --- HANDLE POSTING A NEW COMMENT OR REPLY ---
    if (req.method === 'POST') {
      const { topic, content, user, parentId } = req.body;
      
      if (!topic || !content || !user || !user.id || !user.username) {
        return res.status(400).json({ error: 'Missing required fields for comment.' });
      }
      
      const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null;

      // FIX: Ensure parentId is an integer or null
      const parentIdInt = parentId ? parseInt(parentId, 10) : null;

      const [newComment] = await sql`
        INSERT INTO comments (topic_id, user_id, user_name, user_avatar, content, parent_id) 
        VALUES (${topic}, ${user.id}, ${user.username}, ${avatarUrl}, ${content}, ${parentIdInt})
        RETURNING *
      `;

      return res.status(201).json(newComment);
    }

    // If the method is not GET or POST
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);

  } catch (error) {
    // This will catch database errors (like missing columns) and other unexpected issues.
    console.error('API Error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}