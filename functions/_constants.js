export const LOG_PREFIX = 'log:';
export const MAX_LOG_ENTRIES = 200;
export const LOG_TTL_DAYS = 7;
export const LOG_TTL_SECONDS = LOG_TTL_DAYS * 24 * 60 * 60;
// Invert timestamps so KV.list() returns newest entries first when sorted lexicographically.
export const INVERT_BASE = 9999999999999999;
export const KV_READ_BATCH_SIZE = 20;
export const KV_DELETE_BATCH_SIZE = 100;
