const MAX_ATTEMPTS = 8;
const backoffMs = (attempt) => Math.min(6 * 60 * 60000, 30000 * 2 ** (attempt - 1));

// Lease-based delivery is at least once. External refund calls use stable
// provider idempotency keys; email/WhatsApp can duplicate after a crash.
export function createDispatcher({
  outbox,
  channels,
  logger,
  now = () => new Date(),
  intervalMs = 3000,
}) {
  let timer = null,
    running = false;
  async function deliver(m) {
    const channel = channels[m.channel];
    if (!channel?.configured) {
      await outbox.markSkipped(m.id, m.leaseToken, `${m.channel} is not configured`);
      return;
    }
    try {
      const result = await channel.send(m);
      await outbox.markSent(m.id, m.leaseToken, now().toISOString(), result);
    } catch (e) {
      const description = `${e.name || 'Error'}: delivery failed`; // provider errors may contain customer data or tokens
      logger.error('delivery failed', { id: m.id, channel: m.channel, errorType: e.name });
      if (e.permanent || m.attempts >= MAX_ATTEMPTS)
        await outbox.markFailed(m.id, m.leaseToken, description);
      else
        await outbox.markRetry(
          m.id,
          m.leaseToken,
          new Date(now().getTime() + backoffMs(m.attempts)).toISOString(),
          description,
        );
    }
  }
  async function tick() {
    if (running) return 0;
    running = true;
    let processed = 0;
    try {
      for (let i = 0; i < 25; i++) {
        const m = await outbox.claimNext(now().toISOString());
        if (!m) break;
        await deliver(m);
        processed++;
      }
    } catch (e) {
      logger.error('dispatcher failed', { errorType: e.name });
    } finally {
      running = false;
    }
    return processed;
  }
  return {
    tick,
    start() {
      timer = setInterval(tick, intervalMs);
      timer.unref();
    },
    async stop() {
      clearInterval(timer);
      while (running) await new Promise((r) => setTimeout(r, 50));
    },
  };
}
