/**
 * Base Email Provider
 * All email providers must extend this class
 */

export default class BaseProvider {
    constructor(config) {
        this.config = config;
        this.initialized = false;
    }

    /**
     * Initialize the provider
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        throw new Error('initialize() must be implemented by provider');
    }

    /**
     * Send email
     * @param {Object} options - Email options
     * @param {string} options.from - From address
     * @param {string} options.to - To address
     * @param {string} options.subject - Email subject
     * @param {string} options.html - HTML content
     * @param {string} options.text - Plain text content
     * @returns {Promise<Object>} Result object
     */
    async send(options) {
        throw new Error('send() must be implemented by provider');
    }

    /**
     * Get provider name
     * @returns {string}
     */
    getName() {
        throw new Error('getName() must be implemented by provider');
    }

    /**
     * Check if provider is configured
     * @returns {boolean}
     */
    isConfigured() {
        throw new Error('isConfigured() must be implemented by provider');
    }
}

