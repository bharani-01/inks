const { Resend } = require('resend');

// Domain configured for Inks by Trackify
const domain = process.env.RESEND_DOMAIN || 'mail.trackifyapp.co.in';

// Specific sender addresses tailored for Inks by Trackify
const SENDERS = {
  AUTH: process.env.RESEND_AUTH_FROM || `Inks Auth <auth@${domain}>`,
  INVOICE: process.env.RESEND_INVOICE_FROM || `Inks Invoice <billing@${domain}>`,
  ORDERS: process.env.RESEND_ORDERS_FROM || `Inks Orders <orders@${domain}>`,
  NOTIFICATIONS: process.env.RESEND_NOTIF_FROM || `Inks by Trackify <notifications@${domain}>`,
};

// Fallback sender when using default Resend test onboarding domain
const TEST_SENDER = 'Inks by Trackify <onboarding@resend.dev>';

// Dynamic Resend client getter
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  try {
    return new Resend(apiKey);
  } catch (err) {
    console.warn('  [WARN] Failed to create Resend client:', err.message);
    return null;
  }
}

/**
 * Generic email dispatcher with graceful fallback
 */
async function sendEmail({ from, to, subject, html, text, attachments = [] }) {
  const recipient = Array.isArray(to) ? to : [to];
  const sender = from || SENDERS.NOTIFICATIONS;
  const client = getResendClient();

  if (client) {
    try {
      const emailPayload = {
        from: sender,
        to: recipient,
        subject,
        html,
        text: text || subject,
      };

      if (attachments && attachments.length > 0) {
        emailPayload.attachments = attachments;
      }

      // First attempt with configured domain sender
      const response = await client.emails.send(emailPayload);

      if (response.error) {
        console.warn(`  [WARN] [Resend Primary Failed: ${response.error.message || response.error.name}]. Attempting fallback sandbox sender...`);
        const fallbackRes = await client.emails.send({
          ...emailPayload,
          from: TEST_SENDER,
        });

        if (fallbackRes.error) {
          console.error(`  [ERROR] [Resend Fallback Failed]`, fallbackRes.error);
        } else {
          console.log(`  [Email] [Resend Fallback Sent] ID: ${fallbackRes.data?.id} to ${to}`);
          return { success: true, id: fallbackRes.data?.id };
        }
      } else {
        console.log(`  [Email] [Resend Sent] ID: ${response.data?.id} to ${to} via ${sender}`);
        return { success: true, id: response.data?.id };
      }
    } catch (err) {
      console.error(`  [ERROR] [Resend Exception]`, err.message);
    }
  }

  // Local Console Fallback for instant development testing
  console.log('\n  ┌────────────────────────────────────────────────────────────────────────┐');
  console.log(`  │ [SIMULATED EMAIL LOG - RESEND READY]                                  │`);
  console.log(`  │ From:    ${sender.padEnd(58)}│`);
  console.log(`  │ To:      ${String(to).padEnd(58)}│`);
  console.log(`  │ Subject: ${subject.slice(0, 58).padEnd(58)}│`);
  if (text) {
    console.log(`  │ Text:    ${text.slice(0, 58).padEnd(58)}│`);
  }
  console.log('  └────────────────────────────────────────────────────────────────────────┘\n');
  return { success: true, simulated: true };
}

/* =========================================================================
 *  Shared email layout — Premium HTML shell for all Inks emails
 * ========================================================================= */
function emailLayout(content, preheader = '') {
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Inks by Trackify</title>
  <!--[if mso]>
  <style>table,td,div,p,a,span{font-family:Arial,Helvetica,sans-serif!important;}</style>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f1f5f9;
      margin: 0;
      padding: 32px 16px;
      color: #0f172a;
      line-height: 1.6;
    }
    .wrapper {
      max-width: 600px;
      margin: 0 auto;
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.06);
    }
    .header {
      background: #ffffff;
      padding: 26px 32px 22px;
      text-align: center;
      border-bottom: 1px solid #f1f5f9;
    }
    .header-brand {
      margin: 0;
      font-size: 30px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
    }
    .header-sub {
      margin-top: 6px;
      font-size: 11px;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.75);
      font-weight: 500;
    }
    .body {
      padding: 36px 32px 28px;
      font-size: 15px;
      color: #334155;
      line-height: 1.7;
    }
    .body h2 {
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.3px;
      line-height: 1.3;
    }
    .body p { margin: 0 0 16px; }

    /* OTP card */
    .otp-card {
      background: #f8fafc;
      border: 2px dashed #cbd5e1;
      border-radius: 14px;
      padding: 28px 20px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-label {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .otp-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 10px;
      color: #4f46e5;
      margin: 8px 0 12px;
    }
    .otp-expiry {
      font-size: 12px;
      color: #94a3b8;
    }

    /* Info cards */
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin: 16px 0;
    }
    .info-card-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      margin-bottom: 12px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      font-size: 14px;
    }
    .info-row-label { color: #64748b; }
    .info-row-value { font-weight: 600; color: #1e293b; text-align: right; }

    /* Invoice table */
    .inv-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 20px 0;
      font-size: 14px;
    }
    .inv-table th {
      text-align: left;
      padding: 12px 14px;
      background: #eef2ff;
      color: #4f46e5;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .inv-table th:first-child { border-radius: 10px 0 0 10px; }
    .inv-table th:last-child { border-radius: 0 10px 10px 0; text-align: right; }
    .inv-table td {
      padding: 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
      vertical-align: top;
    }
    .inv-table td:last-child { text-align: right; }

    /* Totals */
    .totals {
      margin: 8px 0 0;
      padding: 0;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 14px;
      font-size: 14px;
    }
    .totals-row-label { color: #64748b; }
    .totals-row-value { font-weight: 600; color: #1e293b; }
    .totals-row.discount .totals-row-label,
    .totals-row.discount .totals-row-value { color: #16a34a; }
    .totals-grand {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #eef2ff;
      border-radius: 10px;
      padding: 14px 18px;
      margin-top: 8px;
    }
    .totals-grand-label {
      font-size: 15px;
      font-weight: 700;
      color: #3730a3;
    }
    .totals-grand-value {
      font-size: 20px;
      font-weight: 800;
      color: #4f46e5;
      letter-spacing: -0.5px;
    }

    /* Green notice */
    .notice-green {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 18px 22px;
      color: #166534;
      font-size: 14px;
      margin: 24px 0;
      line-height: 1.6;
    }
    .notice-green strong { font-size: 15px; }

    /* Indigo notice */
    .notice-indigo {
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 12px;
      padding: 18px 22px;
      color: #3730a3;
      font-size: 14px;
      margin: 24px 0;
      line-height: 1.6;
    }

    /* CTA button */
    .btn-primary {
      display: inline-block;
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.3px;
      margin-top: 8px;
      box-shadow: 0 2px 8px rgba(79,70,229,0.3);
    }
    .btn-primary:hover { opacity: 0.92; }

    /* Footer */
    .footer {
      padding: 28px 32px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.6;
    }
    .footer p { margin: 0 0 4px; }
    .footer a { color: #64748b; text-decoration: none; }

    /* Divider */
    .divider {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 24px 0;
    }
  </style>
</head>
<body>
  ${preheader ? `<span style="display:none;font-size:1px;color:#ffffff;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</span>` : ''}
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <img src="https://inks.trackifyapp.co.in/inks_logo.webp" alt="Inks by Trackify" width="180" style="max-width: 180px; height: auto; display: inline-block;" />
      </div>
      <div class="body">
        ${content}
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Inks by Trackify. All rights reserved.</p>
        <p>Instant Cloud Printing &amp; Document Management</p>
        <p style="margin-top:8px;"><a href="https://mail.trackifyapp.co.in">mail.trackifyapp.co.in</a></p>
      </div>
    </div>
    <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:16px;">
      You're receiving this email because you have an Inks by Trackify account.
    </p>
  </div>
</body>
</html>`;
}

/* =========================================================================
 *  OTP Login Email (Inks Auth)
 * ========================================================================= */
async function sendOtpLoginEmail({ to, name = 'there', code }) {
  const content = `
    <h2>Your Sign-In Passcode</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Use the 6-digit passcode below to sign in to your Inks account securely:</p>
    <div class="otp-card">
      <div class="otp-label">One-Time Passcode</div>
      <div class="otp-code">${code}</div>
      <div class="otp-expiry">Valid for 10 minutes &middot; Do not share this code with anyone</div>
    </div>
    <p style="font-size:13px; color:#64748b;">If you did not request this sign-in code, you can safely ignore this email. No action is needed.</p>
  `;

  return sendEmail({
    from: SENDERS.AUTH,
    to,
    subject: `[Inks Auth] Your Sign-In Code: ${code}`,
    html: emailLayout(content, `Your verification code is ${code}`),
    text: `Your Inks login OTP is: ${code}. Valid for 10 minutes.`,
  });
}

/* =========================================================================
 *  Password Reset Email (Inks Auth)
 * ========================================================================= */
async function sendPasswordResetEmail({ to, name = 'there', code }) {
  const content = `
    <h2>Reset Your Password</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>We received a request to reset the password for your Inks account. Enter the code below to set a new password:</p>
    <div class="otp-card">
      <div class="otp-label">Password Reset Code</div>
      <div class="otp-code">${code}</div>
      <div class="otp-expiry">Valid for 10 minutes</div>
    </div>
    <p style="font-size:13px; color:#64748b;">If you did not request a password reset, your password will remain unchanged and this code will expire automatically.</p>
  `;

  return sendEmail({
    from: SENDERS.AUTH,
    to,
    subject: `[Inks Auth] Reset Your Password (Code: ${code})`,
    html: emailLayout(content, `Your password reset code is ${code}`),
    text: `Your Inks password reset code is: ${code}. Valid for 10 minutes.`,
  });
}

/* =========================================================================
 *  Payment Invoice & Thank-You Email (Inks Invoice)
 * ========================================================================= */
function inr(v) {
  if (v == null || isNaN(v)) return '₹0.00';
  return '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function sendPaymentInvoiceEmail({ to, name = 'Customer', order }) {
  const isBatch = Boolean(order.orders && Array.isArray(order.orders) && order.orders.length > 0);
  const items = isBatch ? order.orders : [order];
  const mainOrderNumber = order.batchNumber || order.orderNumber || 'ORDER';
  const mainTotal = order.totalAmount || 0;
  const mainSubtotal = order.subtotal != null ? order.subtotal : mainTotal;
  const mainDiscount = order.discountAmount || 0;
  const mainTax = order.tax || 0;
  const paymentMethod = order.paymentMethod || 'Ink Wallet';

  const invoiceDate = new Date(order.createdAt || Date.now());
  const formattedDate = invoiceDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = invoiceDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const itemRowsHtml = items.map((item) => {
    const docName = item.document?.originalName || 'Document Print';
    const colorText = item.colorMode === 'COLOR' ? 'Full Color' : 'Black & White';
    const sideText = item.sides === 'DOUBLE' ? 'Double-sided (Duplex)' : 'Single-sided';
    const bindingText = item.binding && item.binding !== 'none'
      ? item.binding.charAt(0).toUpperCase() + item.binding.slice(1)
      : 'No Binding';
    return `
      <tr>
        <td>
          <strong style="color:#0f172a;">${docName}</strong>
          <div style="font-size:12px; color:#64748b; margin-top:4px;">
            ${item.totalPages || 1} page${(item.totalPages || 1) > 1 ? 's' : ''} &times; ${item.copies || 1} cop${(item.copies || 1) > 1 ? 'ies' : 'y'}
          </div>
        </td>
        <td style="font-size:13px; color:#475569; line-height:1.7;">
          ${item.paperSize || 'A4'} &middot; ${colorText}<br>
          ${sideText}<br>
          <span style="color:#94a3b8;">Binding:</span> ${bindingText}
        </td>
        <td style="text-align:right; font-weight:600; color:#0f172a; font-size:15px;">
          ${inr(item.subtotal || item.totalAmount)}
        </td>
      </tr>
    `;
  }).join('');

  const content = `
    <h2 style="margin-bottom:4px;">Payment Confirmed</h2>
    <p style="color:#64748b; font-size:13px; margin-top:0; margin-bottom:20px;">Invoice for Order #${mainOrderNumber}</p>

    <p>Dear <strong>${name}</strong>,</p>
    <p>Thank you for your order! Your payment has been successfully processed and your documents have been queued for high-speed printing.</p>

    <div class="notice-green">
      <strong>Payment of ${inr(mainTotal)} received successfully!</strong>
      <p style="margin:8px 0 0; line-height:1.6; font-size:13px;">Your print job is now in our queue. We'll notify you as soon as your documents are ready for collection.</p>
    </div>

    <hr class="divider">

    <!-- Order Summary Card -->
    <div class="info-card">
      <div class="info-card-label">Order Summary</div>
      <div class="info-row">
        <span class="info-row-label">Order Number</span>
        <span class="info-row-value" style="font-family:monospace; color:#4f46e5; font-size:13px;">${mainOrderNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-row-label">Date &amp; Time</span>
        <span class="info-row-value" style="font-weight:400;">${formattedDate} at ${formattedTime}</span>
      </div>
      <div class="info-row">
        <span class="info-row-label">Payment Status</span>
        <span class="info-row-value" style="color:#16a34a;">● Paid</span>
      </div>
      <div class="info-row">
        <span class="info-row-label">Payment Method</span>
        <span class="info-row-value" style="font-weight:400;">${paymentMethod}</span>
      </div>
    </div>

    <!-- Items Table -->
    <table class="inv-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Configuration</th>
          <th style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRowsHtml}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <div class="totals-row">
        <span class="totals-row-label">Subtotal</span>
        <span class="totals-row-value">${inr(mainSubtotal)}</span>
      </div>
      ${mainDiscount > 0 ? `
      <div class="totals-row discount">
        <span class="totals-row-label">Coupon Discount</span>
        <span class="totals-row-value">- ${inr(mainDiscount)}</span>
      </div>` : ''}
      <div class="totals-row">
        <span class="totals-row-label">Service Charge (18%)</span>
        <span class="totals-row-value">${inr(mainTax)}</span>
      </div>
      <div class="totals-grand">
        <span class="totals-grand-label">Total Paid</span>
        <span class="totals-grand-value">${inr(mainTotal)}</span>
      </div>
    </div>

    <hr class="divider">

    <!-- What's Next -->
    <div class="notice-indigo">
      <strong>What happens next?</strong>
      <ul style="margin:10px 0 0; padding-left:20px; line-height:1.8; font-size:13px;">
        <li>Your documents are being processed and sent to our high-speed printers.</li>
        <li>You'll receive an email notification when your order is ready for pickup.</li>
        <li>Present your Order ID (<strong style="font-family:monospace;">${mainOrderNumber}</strong>) at the Inks counter to collect.</li>
      </ul>
    </div>

    <div style="text-align:center; margin:32px 0 8px;">
      <a href="${process.env.APP_URL || 'http://localhost:5173'}/user/orders?track=${mainOrderNumber}" class="btn-primary">
        Track Your Order &rarr;
      </a>
    </div>

    <p style="text-align:center; font-size:12px; color:#94a3b8; margin-top:16px;">
      A PDF copy of this invoice is attached to this email for your records.
    </p>
  `;

  // Generate attached PDF invoice
  let attachments = [];
  try {
    const { generateInvoicePdfBuffer } = require('./invoicePdf.service');
    const pdfBuffer = await generateInvoicePdfBuffer(order, { name, email: to });
    attachments.push({
      filename: `Invoice-${mainOrderNumber}.pdf`,
      content: pdfBuffer,
    });
  } catch (pdfErr) {
    console.warn('Failed to generate PDF invoice attachment:', pdfErr.message);
  }

  return sendEmail({
    from: SENDERS.INVOICE,
    to,
    subject: `Your Inks Invoice — Order #${mainOrderNumber} (${inr(mainTotal)})`,
    html: emailLayout(content, `Invoice and receipt for order ${mainOrderNumber} — ${inr(mainTotal)} paid`),
    text: `Thank you for your order #${mainOrderNumber}!\n\nTotal paid: ${inr(mainTotal)}\nDate: ${formattedDate}\n\nYour documents are being printed. Present your Order ID at the Inks counter to collect.\n\nA PDF invoice is attached to this email.`,
    attachments,
  });
}

/* =========================================================================
 *  Order Status Update Email (Inks Orders)
 * ========================================================================= */
async function sendOrderStatusEmail({ to, name = 'Customer', order }) {
  const isReady = order.orderStatus === 'PRINTED' || order.orderStatus === 'DELIVERED';
  const statusHeadline = isReady
    ? 'Your Print Order is Ready!'
    : `Order Status: ${order.orderStatus}`;

  const content = `
    <h2>${statusHeadline}</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Here's an update on your print order:</p>

    <div class="info-card">
      <div class="info-card-label">Order Update</div>
      <div class="info-row">
        <span class="info-row-label">Order Number</span>
        <span class="info-row-value" style="font-family:monospace; color:#4f46e5;">#${order.orderNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-row-label">Document</span>
        <span class="info-row-value" style="font-weight:400;">${order.document?.originalName || 'Print Job'}</span>
      </div>
      <div class="info-row">
        <span class="info-row-label">Current Status</span>
        <span class="info-row-value" style="color:${isReady ? '#16a34a' : '#d97706'}; font-weight:700;">${order.orderStatus}</span>
      </div>
    </div>

    ${isReady ? `
    <div class="notice-green">
      <strong>Ready for Collection!</strong>
      <p style="margin:8px 0 0; line-height:1.6; font-size:13px;">
        Your documents are printed and waiting for you. Visit the Inks printing counter and present your Order ID
        (<strong style="font-family:monospace;">${order.orderNumber}</strong>) to collect your freshly printed documents.
      </p>
    </div>` : ''}

    <div style="text-align:center; margin:28px 0 8px;">
      <a href="${process.env.APP_URL || 'http://localhost:5173'}/user/orders?track=${order.orderNumber}" class="btn-primary">
        View Live Status &rarr;
      </a>
    </div>
  `;

  return sendEmail({
    from: SENDERS.ORDERS,
    to,
    subject: `Order #${order.orderNumber} — ${statusHeadline}`,
    html: emailLayout(content, `Order ${order.orderNumber} is now ${order.orderStatus}`),
    text: `Order ${order.orderNumber} is now ${order.orderStatus}.${isReady ? ' Your documents are ready for collection at the Inks counter.' : ''}`,
  });
}

/* =========================================================================
 *  Payment Verification Failed & Reinitiate Email (Inks Invoice)
 * ========================================================================= */
async function sendPaymentFailedReinitiateEmail({ to, name = 'Customer', order, reason = 'Payment not received in merchant account' }) {
  const payUrl = `${process.env.APP_URL || 'http://localhost:5173'}/user/pay/${order.id}`;

  const content = `
    <h2 style="color:#e11d48; margin-bottom:4px;">Payment Verification Update</h2>
    <p style="color:#64748b; font-size:13px; margin-top:0; margin-bottom:20px;">Action Required for Order #${order.orderNumber}</p>

    <p>Hi <strong>${name}</strong>,</p>
    <p>We reviewed your payment submission for print order <strong style="font-family:monospace; color:#4f46e5;">#${order.orderNumber}</strong> (Amount: <strong>${inr(order.totalAmount)}</strong>).</p>

    <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:12px; padding:18px 22px; color:#9f1239; font-size:14px; margin:20px 0; line-height:1.6;">
      <strong>Payment could not be verified</strong>
      <p style="margin:6px 0 0; font-size:13px;">Reason: <strong>${reason}</strong></p>
      ${order.upiRefNumber ? `<p style="margin:4px 0 0; font-size:12px; color:#be123c;">Submitted Reference / UTR: <code style="background:#ffe4e6; padding:2px 6px; border-radius:4px;">${order.upiRefNumber}</code></p>` : ''}
    </div>

    <p>Your document print settings are safely saved. Please click the button below to reinitiate payment via UPI or re-submit your transaction reference number:</p>

    <div style="text-align:center; margin:32px 0 16px;">
      <a href="${payUrl}" class="btn-primary" style="background:linear-gradient(135deg, #e11d48, #f43f5e); box-shadow:0 2px 8px rgba(225,29,72,0.3);">
        Reinitiate Payment (${inr(order.totalAmount)}) &rarr;
      </a>
    </div>

    <p style="font-size:12px; color:#64748b; text-align:center;">
      If you already paid at the printing desk, please show your Order ID <strong style="font-family:monospace;">${order.orderNumber}</strong> to the staff.
    </p>
  `;

  return sendEmail({
    from: SENDERS.INVOICE,
    to,
    subject: `[Action Required] Reinitiate Payment for Inks Order #${order.orderNumber}`,
    html: emailLayout(content, `Payment could not be verified for order ${order.orderNumber}. Please click to reinitiate payment.`),
    text: `Your payment for Inks order #${order.orderNumber} (₹${order.totalAmount}) could not be verified: ${reason}. Please reinitiate payment at: ${payUrl}`,
  });
}

/* =========================================================================
 *  Account Approved Email (Inks by Trackify)
 * ========================================================================= */
async function sendAccountApprovedEmail({ to, name = 'there' }) {
  const content = `
    <h2 style="color:#16a34a;">Your Account is Approved!</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Great news — an administrator has reviewed and activated your account on <strong>Inks by Trackify</strong>.</p>
    <p>You now have full access to our cloud printing platform. Upload documents, customize your print settings, and get notified when your order is ready.</p>

    <div class="notice-indigo">
      <strong>What you can do now:</strong>
      <ul style="margin:10px 0 0; padding-left:20px; line-height:1.8; font-size:13px;">
        <li>Upload PDF, DOCX, PPTX, XLSX, and image files</li>
        <li>Choose Black &amp; White or Full Color with duplex options</li>
        <li>Select from spiral, stapled, thermal, or hardcover binding</li>
        <li>Track your orders in real-time and collect when ready</li>
      </ul>
    </div>

    <div style="text-align:center; margin:32px 0 8px;">
      <a href="${process.env.APP_URL || 'http://localhost:5173'}/login" class="btn-primary">
        Sign In &amp; Start Printing &rarr;
      </a>
    </div>
  `;

  return sendEmail({
    from: SENDERS.NOTIFICATIONS,
    to,
    subject: `Welcome to Inks! Your Account is Approved`,
    html: emailLayout(content, 'Your account has been approved by the administrator.'),
    text: 'Your Inks account has been approved by an administrator! You can now sign in and start printing.',
  });
}

module.exports = {
  SENDERS,
  sendEmail,
  sendOtpLoginEmail,
  sendPasswordResetEmail,
  sendPaymentInvoiceEmail,
  sendOrderStatusEmail,
  sendAccountApprovedEmail,
  sendPaymentFailedReinitiateEmail,
};
