import { createStripeProvider } from './stripeProvider.js';
import { createMockProvider } from './mockProvider.js';
import { badRequest } from '../lib/errors.js';
export function createMarketProvider({ config, db, logger }) {
  const profiles = config.payments.accountMode === 'per_market' ? ['DE', 'GB'] : ['primary'];
  const providers = new Map(
    profiles.map((id) => [
      id,
      config.payments.provider === 'mock'
        ? createMockProvider({ db, profileId: id, publicSiteUrl: config.publicSiteUrl })
        : createStripeProvider({
            ...config.payments.profiles[id],
            publicSiteUrl: config.publicSiteUrl,
            logger,
          }),
    ]),
  );
  const get = (id) => {
    const p = providers.get(id);
    if (!p) throw badRequest('invalid_payment_profile', 'Payment profile is not configured.');
    return p;
  };
  return {
    name: config.payments.provider,
    profileFor: (country) => (config.payments.accountMode === 'per_market' ? country : 'primary'),
    createCheckout: (args) => get(args.order.payment.profileId).createCheckout(args),
    retrieveCheckout: async (id, profileId) => ({
      ...(await get(profileId).retrieveCheckout(id)),
      profileId,
    }),
    expireCheckout: (id, profileId) => get(profileId).expireCheckout(id),
    refund: ({ profileId, ...args }) => get(profileId).refund(args),
    retrieveRefund: (id, profileId) => get(profileId).retrieveRefund(id),
    refundSnapshot: (id, profileId) => get(profileId).refundSnapshot(id),
    async parseWebhook(body, headers, profileId = 'primary') {
      return { ...(await get(profileId).parseWebhook(body, headers)), profileId };
    },
  };
}
