// /api/submitBugReport.js
import fetch from 'node-fetch';

const WEBHOOK_URL = process.env.BUG_REPORT_WEBHOOK_URL;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const discordPayload = req.body;
        if (!discordPayload || !discordPayload.embeds || discordPayload.embeds.length === 0) {
            return res.status(400).json({ message: 'Invalid payload.' });
        }
        
        const discordResponse = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discordPayload)
        });

        if (!discordResponse.ok) {
            const errorText = await discordResponse.text();
            console.error("Discord Webhook Error:", errorText);
            return res.status(502).json({ message: 'Error sending to Discord.' });
        }
        
        return res.status(200).json({ message: 'Report submitted successfully.' });
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ message: 'An internal server error occurred.' });
    }
}