import { neon } from '@neondatabase/serverless';

const WEBHOOK_URL = process.env.DISCORD_BUG_REPORT_WEBHOOK;

function isAdmin(user) { /* ... same isAdmin function ... */ }

async function logToDiscord(payload) {
  if (!WEBHOOK_URL) {
      console.log("Discord webhook URL not set. Skipping log.");
      return;
  }
  await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
  });
}

export default async function handler(req, res) {
  const sql = neon(process.env.POSTGRES_URL);

  // GET (Admin Only): Fetch all reports
  if (req.method === 'GET') {
    const user = JSON.parse(req.headers['x-user-data'] || '{}');
    if (!isAdmin(user)) return res.status(403).json({ error: 'Forbidden' });
    const reports = await sql`SELECT * FROM bug_reports ORDER BY timestamp DESC`;
    return res.status(200).json(reports);
  }

  // POST (Public): Submit a new report
  if (req.method === 'POST') {
    const { reportData, discordPayload } = req.body;
    await sql`
      INSERT INTO bug_reports (reporter_id, reporter_username, game_name, description)
      VALUES (${reportData.userId}, ${reportData.username}, ${reportData.game}, ${reportData.description})
    `;
    await logToDiscord(discordPayload); // Also send to Discord
    return res.status(201).json({ message: 'Report submitted successfully.' });
  }

  // PUT (Admin Only): Update a report's status
  if (req.method === 'PUT') {
    const { user, reportId, newStatus } = req.body;
    if (!isAdmin(user)) return res.status(403).json({ error: 'Forbidden' });
    await sql`UPDATE bug_reports SET status = ${newStatus} WHERE id = ${reportId}`;
    return res.status(200).json({ message: 'Report status updated.' });
  }
  
  return res.status(405).json({ error: 'Method Not Allowed' });
}

function isAdmin(user) {
  if (!user || !user.id) return false;
  const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',');
  return adminIds.includes(user.id);
}