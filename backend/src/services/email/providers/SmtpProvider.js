/**
 * SMTP Email Provider
 * Generic SMTP (Gmail, custom SMTP servers, etc.)
 * Note: May not work on platforms that block SMTP (Railway Free/Hobby)
 */

import nodemailer from 'nodemailer';
import BaseProvider from './BaseProvider.js';

export default class SmtpProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.transporter = null;
    }

    getName() {
        return `SMTP (${this.config.host})`;
    }

    isConfigured() {
        return !!(this.config.user && this.config.password);
    }

    async initialize() {
        if (!this.isConfigured()) {
            return false;
        }

        try {
            // Use Gmail service for Gmail, otherwise custom SMTP
            if (this.config.host === 'smtp.gmail.com') {
                this.transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: this.config.user,
                        pass: this.config.password
                    }
                });
            } else {
                this.transporter = nodemailer.createTransport({
                    host: this.config.host,
                    port: this.config.port,
                    secure: this.config.secure,
                    auth: {
                        user: this.config.user,
                        pass: this.config.password
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                });
            }

            // Verify connection (with timeout)
            try {
                const verifyPromise = this.transporter.verify();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Verification timeout')), 5000)
                );

                await Promise.race([verifyPromise, timeoutPromise]);
                this.initialized = true;
                return true;
            } catch (verifyError) {
                console.warn(`⚠️  ${this.getName()} verification failed: ${verifyError.message}`);
                console.warn('   SMTP may be blocked on this platform');
                return false;
            }
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
            const info = await this.transporter.sendMail({
                from,
                to,
                subject,
                html,
                text
            });

            return {
                success: true,
                messageId: info.messageId,
                previewUrl: nodemailer.getTestMessageUrl(info),
                provider: this.getName()
            };
        } catch (error) {
            throw new Error(`${this.getName()} send failed: ${error.message}`);
        }
    }
}

