import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.POSTGRES_URL) {
    console.error("FATAL: POSTGRES_URL environment variable is not set.");
    return res.status(500).json({ 
      error: 'Server configuration error.',
      details: 'The database connection string is missing from the server environment.'
    });
  }

  try {
    const sql = neon(process.env.POSTGRES_URL);

    const games = await sql`
      SELECT 
        id, 
        name, 
        status, 
        loadstring, 
        topic_id, 
        roblox_url, 
        features_html,
        thumbnail_url,
        is_published,
        display_order
      FROM games 
      WHERE is_published = true 
      ORDER BY display_order ASC, name ASC`;

    return res.status(200).json(games);
  } catch (error) {
    console.error('Database Query Error:', error.message);
    return res.status(500).json({ 
      error: 'An error occurred while fetching data from the database.',
      details: error.message 
    });
  }
}
