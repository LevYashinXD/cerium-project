// /api/auth-callback.js
import { sql } from '@vercel/postgres';
import fetch from 'node-fetch';

// These secrets are pulled securely from Vercel's Environment Variables
const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, REDIRECT_URI } = process.env;

export default async function handler(req, res) {
    const { code } = req.query; // Get the temporary code from the URL

    if (!code) {
        return res.status(400).send('No code provided.');
    }

    try {
        // 1. Exchange the temporary code for an access token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI, // This needs to be set in Vercel
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const tokenData = await tokenResponse.json();

        // 2. Use the access token to get the user's profile from Discord
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();
        
        // 3. Save/update the user in our Neon database
        const { id, username, avatar } = userData;
        
        await sql`
            INSERT INTO users (id, username, avatar_hash, last_login_at)
            VALUES (${id}, ${username}, ${avatar}, NOW())
            ON CONFLICT (id) 
            DO UPDATE SET 
                username = EXCLUDED.username, 
                avatar_hash = EXCLUDED.avatar_hash,
                last_login_at = NOW();
        `;

        // 4. Redirect the user back to the homepage with their data
        const userJsonString = JSON.stringify(userData);
        const encodedUserData = Buffer.from(userJsonString).toString('base64');
        
        // Redirect to the root of your website
        res.redirect(`/?user=${encodedUserData}`);

    } catch (error) {
        console.error('Auth callback error:', error);
        res.redirect('/?error=auth_failed');
    }
}