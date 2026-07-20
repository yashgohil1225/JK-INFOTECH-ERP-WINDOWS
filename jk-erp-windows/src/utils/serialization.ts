// =============================================================
// JK INFOTECH ERP — JSON Serialization Sanitizer Utility
// File : src/utils/serialization.ts
// =============================================================

/**
 * Recursively sanitizes request payload objects to match UWP C++ JSON expectations:
 * - Empty strings ("") are converted to null.
 * - String values are trimmed.
 * - Null and undefined values are preserved as null.
 */
export function sanitizePayload(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data === "string") {
    const trimmed = data.trim();
    return trimmed === "" ? null : trimmed;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizePayload);
  }

  if (typeof data === "object") {
    const sanitized: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = sanitizePayload(data[key]);
      }
    }
    return sanitized;
  }

  return data;
}
