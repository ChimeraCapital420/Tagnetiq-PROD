// FILE: src/lib/hydra/category-detection/detectors/index.ts
// Re-exports all detection functions

export { checkNamePatternOverrides } from './override-check.js';
export { detectCategoryFromName } from './name-patterns.js';
export { detectCategoryByKeywords } from './keyword-scoring.js';