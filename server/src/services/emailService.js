import nodemailer from 'nodemailer';

/**
 * Validates and retrieves current SMTP configuration from environment variables.
 */
export function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const from = process.env.SMTP_FROM || user || 'noreply@civictrack.org';

  if (!host || !user || !pass) {
    return {
      configured: false,
      missingFields: [
        !host ? 'SMTP_HOST' : null,
        !process.env.SMTP_PORT ? 'SMTP_PORT' : null,
        !user ? 'SMTP_USER' : null,
        !pass ? 'SMTP_PASS' : null
      ].filter(Boolean)
    };
  }

  return {
    configured: true,
    host,
    port,
    secure,
    auth: { user, pass },
    from
  };
}

/**
 * Returns canonical frontend application base URL.
 * Strictly uses APP_URL environment variable to prevent Host header poisoning.
 */
export function getCanonicalAppUrl() {
  const appUrl = process.env.APP_URL || 'https://civictrack-7gf8.onrender.com';
  return appUrl.replace(/\/+$/, '');
}

/**
 * Constructs and delivers a password-reset email via configured SMTP transport.
 * Never logs raw tokens, passwords, or credentials.
 */
export async function sendPasswordResetEmail({ to, resetUrl }) {
  const config = getSmtpConfig();
  if (!config.configured) {
    return {
      success: false,
      error: 'SMTP service is not configured on this server environment.'
    };
  }

  try {
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth
    });

    const mailOptions = {
      from: config.from,
      to,
      subject: 'CivicTrack — Password Reset Request',
      text: [
        'Hello,',
        '',
        'A request was received to reset the password for your CivicTrack account.',
        '',
        `Use the following link to set a new password:`,
        resetUrl,
        '',
        'This single-use link will expire in 1 hour. If you did not request a password reset, you can safely ignore this message.',
        '',
        'CivicTrack Infrastructure Lifecycle Management'
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #0369a1; margin-top: 0;">CivicTrack Password Reset</h2>
          <p style="font-size: 14px; color: #334155; line-height: 1.5;">Hello,</p>
          <p style="font-size: 14px; color: #334155; line-height: 1.5;">A request was received to reset the password for your CivicTrack account.</p>
          <div style="margin: 28px 0;">
            <a href="${resetUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;">Reset Password</a>
          </div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5;">Or copy and paste this secure URL into your browser:<br/><a href="${resetUrl}" style="color: #0284c7; word-break: break-all;">${resetUrl}</a></p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; line-height: 1.4; margin-bottom: 0;">This single-use link expires in 1 hour. If you did not request this change, no action is needed.</p>
        </div>
      `
    };

    const info = await transport.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('SMTP transmission error:', err.message);
    return { success: false, error: err.message };
  }
}
