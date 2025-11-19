/**
 * Email Provider Registry
 * Add/remove providers here to enable/disable them
 */

import ResendProvider from './ResendProvider.js';
import SmtpProvider from './SmtpProvider.js';
import SendGridProvider from './SendGridProvider.js';
import BrevoProvider from './BrevoProvider.js';

/**
 * Available email providers
 * Order matters: First configured provider will be used
 */
export default [
    ResendProvider,    // Recommended: Works everywhere, 3000/month free
    SendGridProvider,  // Popular: 100/day free (requires package install)
    BrevoProvider,     // Generous: 300/day free (requires package install)
    SmtpProvider       // Fallback: Gmail/custom SMTP (may be blocked on free hosting)
];

