import { checkWatchlistLevels } from '../../services/watchlistLevels.js';

/**
 * One call, and the reasons it might have done nothing.
 *
 * `missing` is the number this reports that nothing else would: a level nobody
 * could price is not a level that did not print, and a run of quiet days is only
 * good news if something was actually compared.
 */
export default async function watchlistLevelJob(context) {
  const { logger } = context;
  const result = await checkWatchlistLevels();

  if (result.error) throw new Error(result.error);

  const { checked, triggered, invalidated, missing } = result;
  if (triggered || invalidated || missing) {
    logger.info('Shortlist levels checked', result);
  }

  return {
    success: true,
    message: `${checked} level(s) checked, ${triggered} triggered, ${invalidated} invalidated`
      + (missing ? `, ${missing} could not be priced` : ''),
    metadata: result
  };
}
