// Gmail integration via Replit connector (google-mail)
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

async function getUncachableGmailClient() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildWelcomeEmail(toEmail: string, userName: string): string {
  const subject = "Entra nel mondo Vibra";
  const safeName = escapeHtml(userName);
  const safeEmail = escapeHtml(toEmail);

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0b0d1a;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0d1a;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:16px;overflow:hidden;max-width:600px;">
          
          <tr>
            <td style="padding:40px 30px 20px;text-align:center;">
              <h1 style="color:#a78bfa;font-size:32px;margin:0 0 5px;">VIBRA</h1>
              <p style="color:#6ee7b7;font-size:14px;margin:0;letter-spacing:2px;">CONNESSIONI COSMICHE</p>
            </td>
          </tr>

          <tr>
            <td style="padding:10px 30px 30px;">
              <h2 style="color:#ffffff;font-size:24px;margin:0 0 15px;">Ciao ${safeName},</h2>
              <p style="color:#d1d5db;font-size:16px;line-height:1.6;margin:0 0 20px;">
                grazie davvero per esserti unito alla galassia <strong style="color:#a78bfa;">Vibra</strong>.<br>
                Qui le cose funzionano un po' diversamente dalle solite app di incontri&hellip; e l'avventura &egrave; appena iniziata. &#128640;
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(139,92,246,0.15);border-radius:12px;padding:20px;">
                    <p style="color:#c4b5fd;font-size:14px;margin:0 0 12px;font-weight:bold;">Su Vibra potresti imbatterti in:</p>
                    <p style="color:#d1d5db;font-size:14px;line-height:2;margin:0;">
                      &#128125; <strong>Radar Alieno</strong> che scansiona chi vibra vicino a te<br>
                      &#10024; <strong>Match Cosmici</strong> quando due energie si allineano<br>
                      &#128172; <strong>Chat intergalattica</strong> per iniziare subito la conversazione<br>
                      &#127748; <strong>Segnali misteriosi</strong> che possono portarti a nuove connessioni<br>
                      &#9889; <strong>Eventi cosmici</strong> che cambiano l'esperienza ogni giorno
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 30px 20px;">
              <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 10px;">
                In poche parole: <strong style="color:#a78bfa;">meno noia, pi&ugrave; sorpresa.</strong>
              </p>
              <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 10px;">
                Il progetto Vibra &egrave; in continua evoluzione e il tuo parere conta davvero.<br>
                Se hai idee, suggerimenti o anche qualche critica costruttiva, scrivici quando vuoi:
              </p>
              <p style="margin:0 0 15px;">
                <a href="mailto:privacyvibra@gmail.com" style="color:#8b5cf6;text-decoration:none;font-size:15px;">privacyvibra@gmail.com</a>
              </p>
              <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 10px;">
                Grazie per essere parte di questa nuova galassia.<br>
                Ora accendi il radar&hellip; potresti ricevere un segnale proprio adesso. &#127776;
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 30px 30px;text-align:center;">
              <a href="https://vibraalienmatch.com/" 
                 style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#6366f1);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:30px;font-size:16px;font-weight:bold;letter-spacing:0.5px;">
                Entra nella Galassia
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:10px 30px 30px;text-align:center;">
              <p style="color:#a78bfa;font-size:14px;font-weight:bold;margin:0 0 8px;">Team Vibra</p>
              <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;">
                <a href="https://vibraalienmatch.com" style="color:#8b5cf6;text-decoration:none;">https://vibraalienmatch.com</a><br>
                Vibra - Connessioni Cosmiche<br>
                Questa email &egrave; stata inviata a ${safeEmail}<br>
                da: <a href="mailto:privacyvibra@gmail.com" style="color:#8b5cf6;text-decoration:none;">privacyvibra@gmail.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const raw = [
    `From: Vibra <privacyvibra@gmail.com>`,
    `To: ${toEmail}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
  ].join('\r\n');

  return Buffer.from(raw).toString('base64url');
}

export async function sendWelcomeEmail(toEmail: string, userName: string): Promise<boolean> {
  if (!toEmail || toEmail.endsWith('@vibra.com')) return false;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const gmail = await getUncachableGmailClient();
      const raw = buildWelcomeEmail(toEmail, userName);

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });

      console.log(`[welcome-email] Sent to ${toEmail}`);
      return true;
    } catch (error: any) {
      if (attempt === 0 && (error.code === 401 || error.message?.includes('invalid_grant'))) {
        console.log(`[welcome-email] Token expired, refreshing...`);
        connectionSettings = null;
        continue;
      }
      console.error(`[welcome-email] Failed to send to ${toEmail}:`, error.message);
      return false;
    }
  }
  return false;
}

export async function sendBulkWelcomeEmails(
  userList: { email: string; name: string }[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const user of userList) {
    const success = await sendWelcomeEmail(user.email, user.name);
    if (success) sent++;
    else failed++;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[welcome-email] Bulk send complete: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}
