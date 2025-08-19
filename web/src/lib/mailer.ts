// web/src/lib/mailer.ts
import nodemailer from "nodemailer"; // virker når esModuleInterop = true
// Hvis du IKKE vil slå esModuleInterop til, så brug:
// import * as nodemailer from "nodemailer";

const port = Number(process.env.SMTP_PORT || 587);
const secure = port === 465; // port 465 = TLS

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure,
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
});

export async function sendMail(opts: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}) {
  const from = opts.from ?? process.env.MAIL_FROM ?? "no-reply@example.com";
  return transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}
