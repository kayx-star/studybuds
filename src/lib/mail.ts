import "server-only";
import nodemailer from "nodemailer";

// Sends email via SMTP (works with Gmail, QQ Mail, Outlook, etc.); configure in .env.local
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

export const mailConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transport = mailConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 465),
      secure: Number(SMTP_PORT ?? 465) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

/** Returns whether the email was sent; false when no mail service is configured */
export async function sendMail(to: string, subject: string, text: string) {
  if (!transport) return false;
  try {
    await transport.sendMail({ from: MAIL_FROM ?? SMTP_USER, to, subject, text });
    return true;
  } catch (err) {
    console.error("[mail] send failed:", err);
    return false;
  }
}
