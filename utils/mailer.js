const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "430a513c20788f",   // ✅ من الصورة متاعك
    pass: "6ee5afe2c861c3"          // ✅ نفس Password متاع Mailtrap
  }
});

const sendEmail = async (toEmail, subject, htmlContent) => {
  try {
    await transporter.sendMail({
      from: '"Swafy" <no-reply@swafy.com>',
      to: toEmail,
      subject: subject,
      html: htmlContent
    });

    console.log("✅ Email envoyé (Mailtrap)");

  } catch (err) {
    console.error("❌ Email error:", err);
  }
};

module.exports = { sendEmail };
