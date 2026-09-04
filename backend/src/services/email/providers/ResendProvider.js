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
            const { data, error } = await this.resend.emails.send({
                from,
                to,
                subject,
                html,
                text
            });

            /**
             * Resend's SDK does not throw on a rejected send.
             *
             * It resolves with { data: null, error: { name, message } }, and
             * this only ever looked at the id - which fell back to the string
             * 'no-id' and was returned as success. A send from an unverified
             * domain came back "sent via Resend: no-id" and the notification
             * was stamped delivered, which is the one thing this whole layer is
             * careful not to do: a record that lies about delivery is worse
             * than one that admits it.
             *
             * So the error is read, and an id is required. Thrown rather than
             * returned, because every caller here already treats a throw as a
             * failure to retry.
             */
            if (error) {
                throw new Error(`${error.name || 'error'}: ${error.message || 'send rejected'}`);
            }
            if (!data?.id) {
                throw new Error('accepted with no message id, so delivery cannot be confirmed');
            }

            return {
                success: true,
                messageId: data.id,
                provider: this.getName()
            };
        } catch (error) {
            console.error(`❌ Resend API error:`, error);
            throw new Error(`${this.getName()} send failed: ${error.message}`);
        }
    }
}

