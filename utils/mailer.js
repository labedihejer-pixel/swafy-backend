const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "430a513c20788f",     // من Mailtrap
    pass: "6ee5afe2c861c3" // حط password الحقيقي
  }
});

const sendEmail = async (toEmail, subject, htmlContent) => {
  try {
    await transporter.sendMail({
      from: "swafy@test.com",
      to: toEmail,
      subject: subject,
      html: htmlContent
    });

    console.log(" Email envoyé via Mailtrap");
  } catch (err) {
    console.error("❌ Mailtrap error:", err);
  }
};

module.exports = { sendEmail };