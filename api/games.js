import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const sql = neon(process.env.POSTGRES_URL);

    // UPDATED: Added 'thumbnail_url' to the query.
    // This is the cleanest approach. Store the full image URL in your database.
    const games = await sql`
        SELECT 
            id, 
            name, 
            status, 
            loadstring, 
            topic_id, 
            roblox_url, 
            features_html,
            thumbnail_url 
        FROM games 
        WHERE is_published = true 
        ORDER BY display_order ASC, name ASC`;
    
    return res.status(200).json(games);

  } catch (error) {
    console.error('Fetch Public Games API Error:', error);
    return res.status(500).json({ 
        error: 'An internal server error occurred while fetching games.',
        details: error.message 
    });
  }
}