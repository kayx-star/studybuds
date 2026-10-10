import "server-only";
import nodemailer from "nodemailer";

// 通过 SMTP 发邮件（Gmail / QQ 邮箱 / Outlook 等都支持），在 .env.local 里配置
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

/** 返回是否发送成功；未配置邮件服务时返回 false */
export async function sendMail(to: string, subject: string, text: string) {
  if (!transport) return false;
  try {
    await transport.sendMail({ from: MAIL_FROM ?? SMTP_USER, to, subject, text });
    return true;
  } catch (err) {
    console.error("[mail] 发送失败：", err);
    return false;
  }
}
