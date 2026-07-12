export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { productName, qty, threshold } = req.body;

  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
  const ALERT_EMAIL = process.env.ALERT_EMAIL || GMAIL_USER;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return res.status(500).json({ error: 'Email not configured' });
  }

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.default.createTransporter({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: #fff; border-radius: 10px; padding: 24px; border: 1px solid #e0e0e0;">
        <h2 style="margin: 0 0 16px; color: #1a1a18;">⚠️ Low Stock Alert — Raj Agencies</h2>
        <div style="background: #FAEEDA; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="font-size: 15px; font-weight: 600; color: #854F0B;">${productName}</div>
          <div style="font-size: 13px; color: #854F0B; margin-top: 4px;">
            Current stock: <strong>${qty} units</strong> — below threshold of ${threshold} units
          </div>
        </div>
        <p style="font-size: 13px; color: #666;">This product needs restocking soon.</p>
        <a href="https://rajagencies-olive.vercel.app" style="display:inline-block; background:#cc0000; color:#fff; padding:10px 20px; border-radius:8px; text-decoration:none; font-weight:600; font-size:13px;">
          View Inventory →
        </a>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Raj Agencies" <${GMAIL_USER}>`,
      to: ALERT_EMAIL,
      subject: `⚠️ Low Stock: ${productName} (${qty} units left)`,
      html,
    });
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
