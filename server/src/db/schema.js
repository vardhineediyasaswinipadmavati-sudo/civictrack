/**
 * Schema & Initialization Re-export Module for CivicTrack MongoDB Architecture.
 * Migrated completely from legacy SQLite to Mongoose ODM models.
 */

export { DEFAULT_DEPARTMENTS, initDefaultData } from './mongoInit.js';
export { initDefaultData as initSchema } from './mongoInit.js';
