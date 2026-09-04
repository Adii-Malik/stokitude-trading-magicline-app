/**
 * Which provider would send, and - on request - actually send one.
 *
 * Email is the one path that fails silently by design: emailService swallows a
 * send error so a failed notification never takes the request down with it. So
 * "is email working" cannot be answered by using the app; it has to be asked
 * directly, on the box the app runs on.
 *
 * The registry picks the first *configured* provider, in the order Resend,
 * SendGrid, Brevo, SMTP - so adding a Resend key silently takes over from SMTP
 * settings that are still sitting in the file, and removing it hands them back.
 * Worth seeing rather than assuming, in either direction.
 *
 * Outside production nothing is sent unless EMAIL_FORCE_SEND=true - the guard
 * that exists because a fifteen-minute level watcher on a dev database once put
 * a real stop-loss alert in a real inbox.
 *
 *   node src/scripts/checkEmail.js                 # what is configured
 *   EMAIL_FORCE_SEND=true node src/scripts/checkEmail.js you@example.com
 */
import 'dotenv/config';
import config from '../config/config.js';
import providers from '../services/email/providers/index.js';
import emailService from '../services/emailService.js';

const to = process.argv[2];

async function main() {
    console.log(`NODE_ENV=${config.nodeEnv}  EMAIL_FORCE_SEND=${process.env.EMAIL_FORCE_SEND || 'unset'}\n`);

    // Names only. A key printed to a terminal is a key in a scrollback buffer.
    console.log('Providers, in the order they are tried:');
    let first = null;
    for (const ProviderClass of providers) {
        const provider = new ProviderClass(config.email);
        const ready = provider.isConfigured();
        if (ready && !first) first = provider.getName();
        console.log(`  ${ready ? '✓' : '·'} ${provider.getName().padEnd(10)} ${ready ? 'configured' : 'not configured'}`);
    }

    console.log(`\nWould send via: ${first || 'nothing - console output only'}`);
    console.log(`From:           ${config.email.fromName} <${config.email.fromEmail}>`);
    // Every link in every email is built from this. Unset in production it is
    // localhost, so mail arrives looking fine and every link in it is dead.
    console.log(`Links point at: ${config.email.frontendUrl}`);

    if (!to) {
        console.log('\nPass an address to send a real test to it.');
        return;
    }

    await emailService.initialize();
    const result = await emailService.sendEmail({
        to,
        subject: 'Financial Reading — email check',
        html: '<p>If you are reading this, outgoing email works.</p>',
        text: 'If you are reading this, outgoing email works.'
    });
    console.log(`\nSend to ${to}:`, result);
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
