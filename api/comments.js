// File: api/comments.js

import { neon } from '@neondatabase/serverless';

// This function will be your handler for all /api/comments requests
export default async function handler(req, res) {
  // Initialize the database connection.
  // The 'POSTGRES_URL' is automatically set by the Vercel-Neon integration.
  const sql = neon(process.env.POSTGRES_URL);

  // --- HANDLE GETTING COMMENTS ---
  if (req.method === 'GET') {
    try {
      const { topic } = req.query;
      if (!topic) {
        return res.status(400).json({ error: 'Topic is required' });
      }

      // Fetch comments for a specific topic, newest first
      const comments = await sql`
        SELECT id, topic_id, user_id, user_name, user_avatar, content, created_at 
        FROM comments 
        WHERE topic_id = ${topic} 
        ORDER BY created_at DESC
      `;
      
      return res.status(200).json(comments);

    } catch (error) {
      console.error('Error fetching comments:', error);
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }
  }

  // --- HANDLE POSTING A NEW COMMENT ---
  if (req.method === 'POST') {
    try {
      // Get the data sent from the front-end
      const { topic, content, user } = req.body;
      
      // Basic validation
      if (!topic || !content || !user || !user.id || !user.username) {
        return res.status(400).json({ error: 'Missing required fields for comment.' });
      }
      
      // IMPORTANT SECURITY NOTE: In a real-world, high-security application, 
      // you would not trust the 'user' object sent from the client.
      // You would require an Authorization token, verify it with Discord's API on the server,
      // and then get the user info. For this project's scope, we are trusting the 
      // logged-in user data stored in the client's localStorage.

      const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null;

      // Insert the new comment into the database
      const [newComment] = await sql`
        INSERT INTO comments (topic_id, user_id, user_name, user_avatar, content) 
        VALUES (${topic}, ${user.id}, ${user.username}, ${avatarUrl}, ${content})
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