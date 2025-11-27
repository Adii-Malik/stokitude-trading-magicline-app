/**
 * Resend Email Provider
 * Uses Resend API (HTTPS) - works on all platforms
 */

import { Resend } from 'resend';
import BaseProvider from './BaseProvider.js';

export default class ResendProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.resend = null;
    }

    getName() {
        return 'Resend';
    }

    isConfigured() {
        return !!(this.config.resendApiKey);
    }

    async initialize() {
        if (!this.isConfigured()) {
            return false;
        }

        try {
            this.resend = new Resend(this.config.resendApiKey);
            this.initialized = true;
            return true;
        } catch (error) {
            console.error(`❌ ${this.getName()} initialization failed:`, error.message);
            return false;
        }
    }

    async send({ from, to, subject, html, text }) {
        if (!this.initialized) {
            throw new Error(`${this.getName()} provider not initialized`);
        }

        try {
            const result = await this.resend.emails.send({
                from,
                to,
                subject,
                html,
                text
            });

            // Resend returns { data: { id: '...' }, error: null }
            const messageId = result?.data?.id || result?.id || 'no-id';

            return {
                success: true,
                messageId: messageId,
                provider: this.getName()
            };
        } catch (error) {
            console.error(`❌ Resend API error:`, error);
            throw new Error(`${this.getName()} send failed: ${error.message}`);
        }
    }
}

