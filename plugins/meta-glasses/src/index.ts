// FILE: plugins/meta-glasses/src/index.ts
import { registerPlugin } from '@capacitor/core';
import type { MetaGlassesPlugin } from './definitions';

const MetaGlasses = registerPlugin<MetaGlassesPlugin>('MetaGlasses', {
  web: () => import('./web').then(m => new m.MetaGlassesWeb()),
});

export * from './definitions';
export { MetaGlasses };