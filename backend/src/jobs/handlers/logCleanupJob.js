import JobExecution from '../../models/JobExecution.js';

/**
 * Keeps the execution history from growing without bound.
 *
 * Two rules, and a document has to fail both to be deleted: it must be older
 * than the retention window *and* outside the newest hundred for its job. The
 * second rule is what protects a job that runs weekly - thirty days of a
 * fortnightly job is two rows, and losing them would leave nothing to answer
 * "has this ever worked".
 *
 * This used to load every execution a job had ever produced into memory and
 * slice the array. Level Watch now writes one every fifteen minutes, so that
 * loop was reading a growing collection in full, once a week, forever. The same
 * rule is now two queries per job: find the hundredth-newest, then delete by
 * date. Both ride {jobId, createdAt} and neither returns more than one document.
 *
 * The ServiceLog half was removed rather than fixed. Nothing had written to that
 * collection since it was created - zero documents, no callers - so the job
 * spent a query every week deleting nothing from a table that existed only to
 * be cleaned. The model and its wrapper went with it.
 *
 * Note this is a stricter rule laid over the TTL index the model already
 * carries. If this job is disabled, ninety days is still the ceiling.
 */
export default async function logCleanupJob(context) {
  const { logger, config } = context;

  const retentionDays = config.retentionDays || 30;
  const keepPerJob = config.keepPerJob || 100;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const jobIds = await JobExecution.distinct('jobId');
  let deleted = 0;

  for (const jobId of jobIds) {
    /**
     * The boundary, as one document.
     *
     * Sorted newest first, the row at index keepPerJob-1 is the oldest one being
     * kept on count alone. Anything strictly older than it has already lost the
     * count rule, so the two rules collapse into a single date - the earlier of
     * that row's timestamp and the retention cutoff.
     */
    const [boundary] = await JobExecution.find({ jobId })
      .sort({ createdAt: -1 })
      .skip(keepPerJob - 1)
      .limit(1)
      .select('createdAt')
      .lean();

    // Fewer rows than we keep. Nothing to do, and no query worth spending.
    if (!boundary) continue;

    const before = boundary.createdAt < cutoff ? boundary.createdAt : cutoff;
    const { deletedCount } = await JobExecution.deleteMany({ jobId, createdAt: { $lt: before } });
    deleted += deletedCount || 0;
  }

  if (deleted) logger.info('Execution history trimmed', { deleted, jobs: jobIds.length });

  return {
    success: true,
    message: `Cleaned up ${deleted} execution record(s) across ${jobIds.length} job(s)`,
    metadata: { deleted, jobs: jobIds.length, retentionDays, keepPerJob, cutoff }
  };
}
