import { neon } from '@neondatabase/serverless';

// Helper function to get the verified user from their token
async function getVerifiedUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Securely verify the user making the request. This prevents spam.
    const user = await getVerifiedUser(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing token.' });
    }

    const { game, description } = req.body;

    // 2. Validate the incoming data.
    if (!game || !description) {
      return res.status(400).json({ error: 'Game and description are required fields.' });
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
        {
          name: 'Game',
          value: game,
          inline: true,
        },
        {
          name: 'Submitted By',
          value: `<@${user.id}>`, // This will ping the user in Discord
          inline: true,
        },
        {
          name: 'Description',
          value: "```" + description.substring(0, 1020) + "```", // Limit length and format as code block
        },
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

    return res.status(200).json({ message: 'Report submitted successfully.' });

  } catch (error) {
    console.error('Bug Report API Error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}