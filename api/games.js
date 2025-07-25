import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // This is a public endpoint, so we only allow GET requests.
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const sql = neon(process.env.POSTGRES_URL);

    // Fetch all games that are marked as published.
    // Ensure your 'games' table has 'roblox_url' and 'features_html' columns for this to work.
    const games = await sql`
        SELECT 
            id, 
            name, 
            status, 
            loadstring, 
            topic_id, 
            roblox_url, 
            features_html 
        FROM games 
        WHERE is_published = true 
        ORDER BY display_order ASC, name ASC`;
    
    return res.status(200).json(games);

  } catch (error) {
    console.error('Fetch Public Games API Error:', error);
    return res.status(500).json({ error: 'An internal server error occurred while fetching games.' });
  }
}