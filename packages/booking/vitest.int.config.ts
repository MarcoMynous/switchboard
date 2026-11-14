import { integration } from '@switchboard/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

// silent: false so `pnpm test:int` prints the "100 parallel holds → 1 success, 99 SLOT_TAKEN"
// line the P1 exit criterion asks to see.
export default mergeConfig(integration, defineConfig({ test: { silent: false } }));
