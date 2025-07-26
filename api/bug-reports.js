import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { game, description, user } = req.body;

    // 1. Validate that we have the necessary data from the front-end.
    if (!user || !user.id || !user.username) {
        return res.status(400).json({ error: 'User data is missing from the request.' });
    }
    if (!game || !description) {
      return res.status(400).json({ error: 'Game and description are required fields.' });
    }
    
    const sql = neon(process.env.POSTGRES_URL);

    // 2. SERVER-SIDE RATE LIMITER
    // Check when this user last submitted a report.
    const [lastReport] = await sql`
        SELECT created_at FROM bug_reports 
        WHERE user_id = ${user.id} 
        ORDER BY created_at DESC 
        LIMIT 1
    `;

    if (lastReport) {
        const timeSinceLastReport = new Date() - new Date(lastReport.created_at);
        const rateLimitMinutes = 60; // Set the cooldown period to 60 minutes
        const rateLimitMilliseconds = rateLimitMinutes * 60 * 1000;

        if (timeSinceLastReport < rateLimitMilliseconds) {
            const minutesRemaining = Math.ceil((rateLimitMilliseconds - timeSinceLastReport) / 60000);
            return res.status(429).json({ error: `You are submitting reports too quickly. Please wait ${minutesRemaining} more minutes.` });
        }
    }

    // 3. Get the secret webhook URL from environment variables.
    const webhookUrl = process.env.DISCORD_BUG_REPORT_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error("DISCORD_BUG_REPORT_WEBHOOK_URL is not set.");
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    // 4. Create a professional-looking embed for Discord.
    const embed = {
      author: {
        name: `${user.username} (${user.id})`,
        icon_url: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png',
      },
      title: 'New Bug Report Submitted',
      color: 16729421, // A red-ish color
      fields: [
        { name: 'Game', value: game, inline: true },
        { name: 'Submitted By', value: `<@${user.id}>`, inline: true },
        { name: 'Description', value: "```" + description.substring(0, 1020) + "```" },
      ],
      timestamp: new Date().toISOString(),
    };

    // 5. Send the report to your Discord channel.
    const discordResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Cerium Bug Reporter',
        embeds: [embed],
      }),
    });

    if (!discordResponse.ok) {
      throw new Error('Failed to send report to Discord.');
    }

    // 6. If successful, log this submission for rate limiting.
    await sql`INSERT INTO bug_reports (user_id) VALUES (${user.id})`;

    return res.status(200).json({ message: 'Report submitted successfully.' });

  } catch (error) {
    console.error('Bug Report API Error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}