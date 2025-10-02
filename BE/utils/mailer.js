const nodemailer = require('nodemailer');

// Simple transporter using environment variables. If not configured, fallback to console log only.
// Required envs for real sending: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

let transporter = null;

function buildTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465, // true for 465, false for other ports
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  } else {
    transporter = {
      sendMail: async (opts) => {
        console.log('[MAIL:FALLBACK] Would send email:', { to: opts.to, subject: opts.subject, text: opts.text, html: opts.html });
        return { messageId: 'fallback-' + Date.now() };
      }
    };
  }
  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || 'no-reply@example.com';
  const tx = buildTransporter();
  return tx.sendMail({ from, to, subject, text, html });
}

module.exports = { sendEmail };
