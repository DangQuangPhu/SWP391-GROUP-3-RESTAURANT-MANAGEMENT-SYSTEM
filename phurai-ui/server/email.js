import nodemailer from "nodemailer";
import "./config.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export function sendVerificationEmail(toEmail, userId, token) {
  const verificationLink = `${process.env.APP_URL}/verify?uid=${userId}&token=${token}`;

  return transporter.sendMail({
    from: `"Phurai Restaurant" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Xac thuc tai khoan Phurai",
    html: `
      <p>Chao ban,</p>
      <p>Vui long nhan vao lien ket duoi day de kich hoat tai khoan cua ban:</p>
      <p><a href="${verificationLink}">Xac thuc tai khoan</a></p>
      <p>Ma xac thuc cua ban la: <strong>${token}</strong></p>
      <p>Lien ket va ma nay se het han trong 24 gio.</p>
      <p>Tran trong,</p>
      <p>Doi ngu Phurai</p>
    `,
  });
}
