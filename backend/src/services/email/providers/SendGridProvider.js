/**
 * SendGrid Email Provider
 * Uses SendGrid API (HTTPS) - works on all platforms
 * 
 * To use: npm install @sendgrid/mail
 * Free tier: 100 emails/day
 */

import BaseProvider from './BaseProvider.js';

export default class SendGridProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.sendgrid = null;
    }

    getName() {
        return 'SendGrid';
    }

    isConfigured() {
        return !!(this.config.sendgridApiKey);
    }

    async initialize() {
        if (!this.isConfigured()) {
            return false;
        }

        try {
            // Dynamic import to avoid requiring the package if not used
            const sgMail = (await import('@sendgrid/mail')).default;
            sgMail.setApiKey(this.config.sendgridApiKey);
            this.sendgrid = sgMail;
            this.initialized = true;
            return true;
        } catch (error) {
            if (error.code === 'ERR_MODULE_NOT_FOUND') {
                console.error(`❌ ${this.getName()} package not installed. Run: npm install @sendgrid/mail`);
            } else {
                console.error(`❌ ${this.getName()} initialization failed:`, error.message);
            }
            return false;
        }
    }

    async send({ from, to, subject, html, text }) {
        if (!this.initialized) {
            throw new Error(`${this.getName()} provider not initialized`);
        }

        try {
            const result = await this.sendgrid.send({
                from,
                to,
                subject,
                html,
                text
            });

            return {
                success: true,
                messageId: result[0]?.headers['x-message-id'],
                provider: this.getName()
            };
        } catch (error) {
            throw new Error(`${this.getName()} send failed: ${error.message}`);
        }
    }
}

