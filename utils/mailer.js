const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "labedihejer@gmail.com",      // ✅ ايميلك
    pass: "cehmbsxzqpeusaha"            // ✅ app password بدون spaces
  }
});

const sendEmail = async (toEmail, subject, htmlContent) => {
  try {
    await transporter.sendMail({
      from: '"Swafy" <labedihejer@gmail.com>',
      to: toEmail,
      subject: subject,
      html: htmlContent
    });

    console.log("✅ Email envoyé avec Gmail");

  } catch (err) {
    console.error("❌ Email error:", err);
  }
};

module.exports = { sendEmail };
