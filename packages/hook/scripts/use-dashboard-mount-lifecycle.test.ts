import assert from 'node:assert/strict';
import { getElementSize, shouldRemountOnTargetSwap } from '../src/sdk/useDashboardMountLifecycle';

function test(name: string, fn: () => void) {
  try {
    fn();
    // eslint-disable-next-line no-console -- test script output is allowed
    console.log(`✓ ${name}`);
  } catch (error) {
    // eslint-disable-next-line no-console -- test script output is allowed
    console.error(`✗ ${name}`);
    throw error;
  }
}

const createElementLike = (width: number, height: number): HTMLElement =>
  ({
    clientWidth: width,
    clientHeight: height,
  }) as HTMLElement;

test('getElementSize returns null for missing target', () => {
  assert.equal(getElementSize(null), null);
});

test('getElementSize returns width/height snapshot', () => {
  const target = createElementLike(320, 180);
  assert.deepEqual(getElementSize(target), { width: 320, height: 180 });
});

test('shouldRemountOnTargetSwap only remounts when mounted and target changed', () => {
  const prev = createElementLike(240, 120);
  const next = createElementLike(240, 120);

  assert.equal(shouldRemountOnTargetSwap(false, prev, next), false);
  assert.equal(shouldRemountOnTargetSwap(true, null, next), false);
  assert.equal(shouldRemountOnTargetSwap(true, prev, null), false);
  assert.equal(shouldRemountOnTargetSwap(true, prev, prev), false);
  assert.equal(shouldRemountOnTargetSwap(true, prev, next), true);
});
