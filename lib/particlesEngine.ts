/**
 * Shared tsParticles engine singleton.
 * Call initSharedEngine() once on app start.
 * Both AmbientParticles and TierEffectCanvas share this instance.
 */
import { initParticlesEngine } from '@tsparticles/react';
import { loadFull } from 'tsparticles';

let initPromise: Promise<void> | null = null;

export function getParticlesEngine(): Promise<void> {
  if (!initPromise) {
    initPromise = initParticlesEngine(async (engine) => {
      await loadFull(engine);
    });
  }
  return initPromise;
}
