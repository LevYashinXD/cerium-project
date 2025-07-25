// File: api/check-admin.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    const adminIds = process.env.ADMIN_DISCORD_IDS ? process.env.ADMIN_DISCORD_IDS.split(',') : [];
    
    const isAdmin = adminIds.includes(userId);

    // Return a simple boolean response
    return res.status(200).json({ isAdmin: isAdmin });

  } catch (error) {
    console.error('Check Admin API Error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}