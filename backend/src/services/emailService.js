import nodemailer from 'nodemailer';
import config from '../config/config.js';

/**
 * Email Service
 * Handles sending emails for password reset, notifications, etc.
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  /**
   * Initialize email transporter
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Check if email credentials are configured
      const hasEmailConfig = config.email.user && config.email.password;

      if (!hasEmailConfig) {
        console.log('📧 Email service: No credentials configured');
        console.log('   Emails will be logged to console only');
        console.log('   Configure EMAIL_USER and EMAIL_PASSWORD in .env to send real emails');
        return;
      }

      // Use configured SMTP
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.password
        }
      });

      // Verify connection
      await this.transporter.verify();
      this.initialized = true;
      console.log('✅ Email service initialized successfully');
      console.log(`   SMTP: ${config.email.host}:${config.email.port}`);
    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
      console.log('   Emails will be logged to console only');
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, username, resetToken) {
    const resetUrl = `${config.email.frontendUrl}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"${config.email.fromName}" <${config.email.fromEmail}>`,
      to: email,
      subject: 'Password Reset Request - PSX SmartDesk',
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
              
              <p>We received a request to reset your password for your PSX SmartDesk account.</p>
              
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
              
              <p>Best regards,<br><strong>PSX SmartDesk Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; ${new Date().getFullYear()} PSX SmartDesk. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${username},

We received a request to reset your password for your PSX SmartDesk account.

Reset your password by visiting this link:
${resetUrl}

This link expires in 1 hour.

If you didn't request this reset, please ignore this email. Your password won't change until you create a new one.

Best regards,
PSX SmartDesk Team
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
      subject: 'Welcome to PSX SmartDesk! 🎉',
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
              <h1>🎉 Welcome to PSX SmartDesk!</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${username}</strong>,</p>
              
              <p>Your account has been activated! You can now access all features of PSX SmartDesk.</p>
              
              <div style="text-align: center;">
                <a href="${loginUrl}" class="button">Login Now</a>
              </div>
              
              <p>Start monitoring your stocks, managing trade plans, and more!</p>
              
              <p>Best regards,<br><strong>PSX SmartDesk Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} PSX SmartDesk. All rights reserved.</p>
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
   */
  async sendEmail(mailOptions) {
    // If not initialized or no transporter, just log
    if (!this.initialized || !this.transporter) {
      console.log('\n📧 Email would be sent (service not configured):');
      console.log(`   To: ${mailOptions.to}`);
      console.log(`   Subject: ${mailOptions.subject}`);
      console.log(`   Content: ${mailOptions.text?.substring(0, 200)}...`);
      return { success: true, messageId: 'console-only' };
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent: ${info.messageId}`);
      
      // If using Ethereal (development), show preview URL
      if (nodemailer.getTestMessageUrl(info)) {
        console.log(`   Preview: ${nodemailer.getTestMessageUrl(info)}`);
      }
      
      return { 
        success: true, 
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info)
      };
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

