// File: api/comments.js

import { neon } from '@neondatabase/serverless';

// This function will be your handler for all /api/comments requests
export default async function handler(req, res) {
  // Initialize the database connection.
  const sql = neon(process.env.POSTGRES_URL);

  // --- HANDLE GETTING COMMENTS (Updated for Replies) ---
  if (req.method === 'GET') {
    try {
      const { topic } = req.query;
      if (!topic) {
        return res.status(400).json({ error: 'Topic is required' });
      }

      // 1. Fetch ALL comments for the topic, including the new parent_id column.
      // We order by oldest first to make building the reply tree easier.
      const allComments = await sql`
        SELECT id, topic_id, parent_id, user_id, user_name, user_avatar, content, created_at 
        FROM comments 
        WHERE topic_id = ${topic} 
        ORDER BY created_at ASC
      `;
      
      // 2. Process the flat list into a nested structure (a tree)
      const commentsById = {}; // A map for quick lookups
      const rootComments = []; // Only top-level comments go here

      // First pass: create a lookup map and add a 'replies' array to each comment
      allComments.forEach(comment => {
        commentsById[comment.id] = { ...comment, replies: [] };
      });

      // Second pass: link replies to their parents
      allComments.forEach(comment => {
        if (comment.parent_id && commentsById[comment.parent_id]) {
          // This is a reply, so add it to its parent's 'replies' array
          commentsById[comment.parent_id].replies.push(commentsById[comment.id]);
        } else {
          // This is a top-level (root) comment
          rootComments.push(commentsById[comment.id]);
        }
      });
      
      // 3. Return the nested structure, reversing the root comments to show newest first.
      return res.status(200).json(rootComments.reverse());

    } catch (error) {
      console.error('Error fetching comments:', error);
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }
  }

  // --- HANDLE POSTING A NEW COMMENT (Updated for Replies) ---
  if (req.method === 'POST') {
    try {
      // Get the data, now including an optional 'parentId' for replies
      const { topic, content, user, parentId } = req.body;
      
      if (!topic || !content || !user || !user.id || !user.username) {
        return res.status(400).json({ error: 'Missing required fields for comment.' });
      }
      
      const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null;

      // =================================================================
      // THIS IS THE FIX: Convert parentId from a string to an integer
      // If parentId doesn't exist, it will correctly become null.
      const parentIdInt = parentId ? parseInt(parentId, 10) : null;
      // =================================================================

      // Update the INSERT statement to include the parent_id column
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

  // If the request is not GET or POST, return Method Not Allowed
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}