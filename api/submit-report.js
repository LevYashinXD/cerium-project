export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const { discordPayload } = req.body;
  if (!discordPayload) {
    return res.status(400).json({ error: 'Missing report payload.' });
  }

  try {
    const discordResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(discordPayload),
    });

    if (!discordResponse.ok) {
      console.error(`Discord API responded with ${discordResponse.status}`);
      const errorText = await discordResponse.text();
      console.error(errorText);
      return res.status(502).json({ error: 'Failed to send report to Discord.' });
    }

    return res.status(200).json({ message: 'Report submitted successfully!' });

  } catch (error) {
    console.error('Error submitting bug report:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
