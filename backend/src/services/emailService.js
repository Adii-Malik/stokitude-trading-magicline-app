import config from '../config/config.js';
import availableProviders from './email/providers/index.js';

/**
 * Email Service
 * Dynamic multi-provider email service
 * Automatically selects first available configured provider
 */

class EmailService {
  constructor() {
    this.provider = null;
    this.initialized = false;
  }

  /**
   * Initialize email service
   * Tries all configured providers in order until one succeeds
   */
  async initialize() {
    if (this.initialized) return;

    /**
     * A development box does not email you.
     *
     * The level watchers run every fifteen minutes against whatever data the
     * dev database happens to hold, and this machine has a working SMTP
     * provider configured - so a local run put a real "stop level reached" in
     * a real inbox for a position the developer was not in. Console output is
     * the honest behaviour outside production: you still see exactly what would
     * have been sent.
     *
     * EMAIL_FORCE_SEND=true is the way back in when the thing being tested is
     * the email itself.
     */
    if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_FORCE_SEND !== 'true') {
      console.log('✓ Email service: Console only (not production)');
      this.initialized = true;
      return;
    }

    // Try each provider in order
    for (const ProviderClass of availableProviders) {
      const provider = new ProviderClass(config.email);

      if (!provider.isConfigured()) {
        continue; // Skip unconfigured providers
      }

      const success = await provider.initialize();

      if (success) {
        this.provider = provider;
        this.initialized = true;
        console.log(`✓ Email service: ${provider.getName()}`);
        return;
      }
    }

    // No provider configured
    console.log('✓ Email service: Console only (no provider configured)');
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, username, resetToken) {
    const resetUrl = `${config.email.frontendUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"${config.email.fromName}" <${config.email.fromEmail}>`,
      to: email,
      subject: 'Password Reset Request - Financial Reading',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
            .button { display: inline-block; background: #0891b2; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .token-box { background: white; border: 2px solid #0891b2; padding: 15px; margin: 20px 0; border-radius: 6px; font-family: monospace; word-break: break-all; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${username}</strong>,</p>
              
              <p>We received a request to reset your password for your Financial Reading account.</p>
              
              <p>Click the button below to reset your password:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <div class="token-box">${resetUrl}</div>
              
              <div class="warning">
                <strong>⚠️ Security Note:</strong>
                <ul style="margin: 10px 0;">
                  <li>This link expires in <strong>1 hour</strong></li>
                  <li>If you didn't request this reset, please ignore this email</li>
                  <li>Your password won't change until you create a new one</li>
                </ul>
              </div>
              
              <p>If you have any questions, please contact support.</p>
              
              <p>Best regards,<br><strong>Financial Reading Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; ${new Date().getFullYear()} Financial Reading. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${username},

We received a request to reset your password for your Financial Reading account.

Reset your password by visiting this link:
${resetUrl}

This link expires in 1 hour.

If you didn't request this reset, please ignore this email. Your password won't change until you create a new one.

Best regards,
Financial Reading Team
      `
    };

    return await this.sendEmail(mailOptions);
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email, username) {
    const loginUrl = `${config.email.frontendUrl}/login`;

    const mailOptions = {
      from: `"${config.email.fromName}" <${config.email.fromEmail}>`,
      to: email,
      subject: 'Welcome to Financial Reading! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
            .button { display: inline-block; background: #0891b2; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to Financial Reading!</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${username}</strong>,</p>
              
              <p>Your account has been activated! You can now access all features of Financial Reading.</p>
              
              <div style="text-align: center;">
                <a href="${loginUrl}" class="button">Login Now</a>
              </div>
              
              <p>Start monitoring your stocks, managing trade plans, and more!</p>
              
              <p>Best regards,<br><strong>Financial Reading Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Financial Reading. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    return await this.sendEmail(mailOptions);
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(email, username, title, message, actionUrl = null, priority = 'medium') {
    const priorityColors = {
      low: '#6b7280',
      medium: '#0891b2',
      high: '#f59e0b',
      urgent: '#ef4444'
    };

    const priorityLabels = {
      low: 'Low Priority',
      medium: 'Medium Priority',
      high: 'High Priority',
      urgent: 'Urgent'
    };

    const color = priorityColors[priority] || priorityColors.medium;
    const priorityLabel = priorityLabels[priority] || priorityLabels.medium;

    const mailOptions = {
      from: `"${config.email.fromName}" <${config.email.fromEmail}>`,
      to: email,
      subject: `${title} - Financial Reading`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9fafb;">
          <div style="max-width: 600px; margin: 40px auto; padding: 20px;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="border-left: 4px solid ${color}; padding-left: 15px; margin-bottom: 20px;">
                <h2 style="color: #111827; margin: 0 0 10px 0;">${title}</h2>
                <span style="display: inline-block; padding: 4px 12px; background-color: ${color}; color: white; border-radius: 12px; font-size: 12px; font-weight: 600;">
                  ${priorityLabel}
                </span>
              </div>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Hello ${username},
              </p>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #111827; font-size: 15px; line-height: 1.6; margin: 0;">
                  ${message}
                </p>
              </div>

              ${actionUrl ? `
              <div style="margin: 30px 0; text-align: center;">
                <a href="${config.email.frontendUrl}${actionUrl}" 
                   style="background-color: ${color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 600;">
                  View Details
                </a>
              </div>
              ` : ''}
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 13px; margin: 5px 0;">
                  This notification was sent from Financial Reading
                </p>
                <p style="color: #6b7280; font-size: 13px; margin: 5px 0;">
                  <a href="${config.email.frontendUrl}/profile" style="color: #0891b2; text-decoration: none;">
                    Manage notification preferences
                  </a>
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    return await this.sendEmail(mailOptions);
  }

  /**
   * Generic send email method
   * Works with any configured provider
   */
  async sendEmail(mailOptions) {
    // If not initialized, just log.
    //
    // `delivered: false` matters. This used to return success, so the caller
    // stamped channels.email.sent = true and the notification record claimed an
    // email had gone out when it had only been printed to a console nobody
    // reads. A record that lies about delivery is worse than one that admits it.
    if (!this.initialized || !this.provider) {
      console.log('\n📧 Email would be sent (service not configured):');
      console.log(`   To: ${mailOptions.to}`);
      console.log(`   Subject: ${mailOptions.subject}`);
      console.log(`   Content: ${mailOptions.text?.substring(0, 200)}...`);
      return { success: true, delivered: false, messageId: 'console-only' };
    }

    try {
      const result = await this.provider.send(mailOptions);
      console.log(`✅ Email sent via ${this.provider.getName()}: ${result.messageId}`);

      if (result.previewUrl) {
        console.log(`   Preview: ${result.previewUrl}`);
      }

      return result;

    } catch (error) {
      console.error('❌ Email send failed:', error.message);

      // Fallback: log to console
      console.log('\n📧 Email failed to send, logging to console:');
      console.log(`   To: ${mailOptions.to}`);
      console.log(`   Subject: ${mailOptions.subject}`);

      return { success: false, error: error.message };
    }
  }
}

export default new EmailService();

