export const LOG_PREFIX = 'log:';
export const MAX_LOG_ENTRIES = 200;
export const LOG_TTL_DAYS = 7;
export const LOG_TTL_SECONDS = LOG_TTL_DAYS * 24 * 60 * 60;
// Invert timestamps so KV.list() returns newest entries first when sorted lexicographically.
// Using Number.MAX_SAFE_INTEGER leaves millisecond headroom for many millennia before overflow would flatten ordering.
export const INVERT_BASE = Number.MAX_SAFE_INTEGER;
export const KV_READ_BATCH_SIZE = 20;
export const KV_DELETE_BATCH_SIZE = 100;
