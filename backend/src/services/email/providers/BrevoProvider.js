/**
 * Brevo (formerly SendInBlue) Email Provider
 * Uses Brevo API (HTTPS) - works on all platforms
 * 
 * To use: npm install @sendinblue/client
 * Free tier: 300 emails/day
 */

import BaseProvider from './BaseProvider.js';

export default class BrevoProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.brevo = null;
    }

    getName() {
        return 'Brevo';
    }

    isConfigured() {
        return !!(this.config.brevoApiKey);
    }

    async initialize() {
        if (!this.isConfigured()) {
            return false;
        }

        try {
            // Dynamic import to avoid requiring the package if not used
            const SibApiV3Sdk = await import('@sendinblue/client');
            const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
            apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, this.config.brevoApiKey);
            this.brevo = apiInstance;
            this.initialized = true;
            return true;
        } catch (error) {
            if (error.code === 'ERR_MODULE_NOT_FOUND') {
                console.error(`❌ ${this.getName()} package not installed. Run: npm install @sendinblue/client`);
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
            const sendSmtpEmail = {
                sender: { email: from },
                to: [{ email: to }],
                subject,
                htmlContent: html,
                textContent: text
            };

            const result = await this.brevo.sendTransacEmail(sendSmtpEmail);

            return {
                success: true,
                messageId: result.messageId,
                provider: this.getName()
            };
        } catch (error) {
            throw new Error(`${this.getName()} send failed: ${error.message}`);
        }
    }
}

