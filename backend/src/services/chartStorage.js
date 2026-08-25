/**
 * Where a trade's chart is kept.
 *
 * On disk, not in the document: a screenshot runs to hundreds of kilobytes and
 * every list query would carry it. The entry holds a path; the bytes stay here.
 *
 * The stored name is random rather than the one uploaded. An uploaded name is
 * attacker-controlled text, and one containing ../ would write outside the
 * directory; a UUID cannot, and cannot collide with another trade's chart.
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

/**
 * Resolved from this file, never from the working directory.
 *
 * It was cwd-relative, which is the same directory only by coincidence. `npm
 * run dev` starts in backend/, so writer and reader agreed and every upload
 * worked. The container starts in /app and runs `node backend/src/index.js`, so
 * charts were written to /app/uploads/journal while Express served
 * /app/backend/uploads - two directories, and the volume mounted on the second.
 * Every upload succeeded and every one of them 404'd.
 *
 * Exported so the static mount uses this same value rather than its own guess.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(HERE, '..', '..', 'uploads');
export const CHART_DIR = path.join(UPLOADS_DIR, 'journal');
export const URL_PREFIX = '/uploads/journal/';

const TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
export const MAX_BYTES = 6 * 1024 * 1024;

export function extensionFor(mimetype) {
    return TYPES[mimetype] || null;
}

export function accepts(mimetype) {
    return Object.prototype.hasOwnProperty.call(TYPES, mimetype);
}

export const chartUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            fs.mkdir(CHART_DIR, { recursive: true })
                .then(() => cb(null, CHART_DIR))
                .catch(cb);
        },
        filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${extensionFor(file.mimetype)}`)
    }),
    limits: { fileSize: MAX_BYTES },
    fileFilter: (req, file, cb) => {
        if (!accepts(file.mimetype)) {
            return cb(new Error('Charts must be a PNG, JPEG or WebP image'), false);
        }
        cb(null, true);
    }
});

/**
 * Delete the file behind a stored URL. Anything not under the chart prefix is
 * ignored rather than trusted: the value reaches here from a document, and a
 * path from a document must never be able to point at an arbitrary file.
 */
export async function removeChart(chartUrl) {
    if (typeof chartUrl !== 'string' || !chartUrl.startsWith(URL_PREFIX)) return false;

    const name = path.basename(chartUrl);
    const file = path.join(CHART_DIR, name);
    if (path.dirname(file) !== CHART_DIR) return false;

    // A leftover file is untidy; an entry that refuses to be deleted is a bug.
    return fs.unlink(file).then(() => true).catch(() => false);
}
