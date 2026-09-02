import { checkWatchlistLevels } from '../../services/watchlistLevels.js';
import journalLevelHandler from '../../handlers/journalLevelHandler.js';

/**
 * Every price you named, on one clock.
 *
 * Both checks used to hang off the nightly bar sync, because that was the job
 * that produced the price they read. It no longer is - they read the live feed
 * now - and leaving them there meant a stop loss was watched once a day at five
 * while a shortlist trigger was watched every fifteen minutes. That is exactly
 * backwards: a stop going is more urgent than a setup arriving, and it is the
 * one you would want to hear about while the market is still open.
 *
 * The journal runs first for the same reason. Neither depends on the other, but
 * if a run is going to be cut short, the position you are already in is the one
 * that should have been checked.
 *
 * One failing must not silence the other. They answer different questions and a
 * scanner hiccup on one book is not a reason to skip the other.
 */
export default async function watchlistLevelJob(context) {
  const { logger } = context;

  let journal = null;
  try {
    journal = await journalLevelHandler.checkLevels();
  } catch (error) {
    logger.warn('Journal level check failed', { error: error.message });
  }

  const shortlist = await checkWatchlistLevels();
  if (shortlist.error) throw new Error(shortlist.error);

  /**
   * `missing` is the number this reports that nothing else would: a level
   * nobody could price is not a level that did not print, and a run of quiet
   * days is only good news if something was actually compared.
   */
  const missing = (shortlist.missing || 0) + (journal?.missing || 0);
  if (shortlist.triggered || shortlist.invalidated || journal?.updated || missing) {
    logger.info('Levels checked', { journal, shortlist });
  }

  const checked = (shortlist.checked || 0) + (journal?.checked || 0);
  return {
    success: true,
    message: `${checked} level(s) checked, ${shortlist.triggered} triggered, `
      + `${shortlist.invalidated} invalidated, ${journal?.updated ?? 0} journal level(s) hit`
      + (missing ? `, ${missing} could not be priced` : ''),
    metadata: { journal, shortlist }
  };
}
