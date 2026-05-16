const https = require('https');

const sendEmail = async (toEmail, subject, htmlContent) => {
  console.log('🔑 API KEY:', process.env.BREVO_API_KEY?.substring(0, 10) + '...');
  const data = JSON.stringify({
  sender: { name: "Swafy", email: process.env.SENDER_EMAIL },
  to: [{ email: toEmail }],
  subject: subject,
  htmlContent: htmlContent,

  headers: {
    "X-Mailin-custom": "SwafyApp"
  }

});


  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 201) {
          console.log('✅ Email envoyé avec succès');
          resolve(body);
        } else {
          console.error('❌ Erreur Brevo:', body);
          reject(new Error(`Status: ${res.statusCode} - Body: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

module.exports = { sendEmail };