export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // 2. Get the webhook URL from environment variables (this is secure)
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  // 3. Get the payload from the front-end request
  const { discordPayload } = req.body;
  if (!discordPayload) {
    return res.status(400).json({ error: 'Missing report payload.' });
  }

  try {
    // 4. Make the fetch request to Discord from the server
    const discordResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(discordPayload),
    });

    // 5. Check if the request to Discord was successful
    if (!discordResponse.ok) {
      console.error(`Discord API responded with ${discordResponse.status}`);
      const errorText = await discordResponse.text();
      console.error(errorText);
      return res.status(502).json({ error: 'Failed to send report to Discord.' });
    }

    // 6. Send a success response back to the front-end
    return res.status(200).json({ message: 'Report submitted successfully!' });

  } catch (error) {
    console.error('Error submitting bug report:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}