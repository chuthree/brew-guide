/** Shared image compression policy for all execution platforms. */
/** Shared by bean upload UI and MCP; keep the same compression policy. */
export const BEAN_IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.1,
  maxWidthOrHeight: 1200,
  initialQuality: 0.8,
} as const;
export const NOTE_IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.1,
  maxWidthOrHeight: 1200,
  initialQuality: 0.8,
};
export const NOTE_IMAGE_MAX_SIZE_BYTES =
  NOTE_IMAGE_COMPRESSION_OPTIONS.maxSizeMB * 1024 * 1024;
export const COFFEE_BEAN_IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 1024,
  initialQuality: 0.8,
};
export const COFFEE_BEAN_IMAGE_MAX_SIZE_BYTES =
  COFFEE_BEAN_IMAGE_COMPRESSION_OPTIONS.maxSizeMB * 1024 * 1024;
export const ROASTER_LOGO_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.12,
  maxWidthOrHeight: 512,
  initialQuality: 0.9,
};
export const ROASTER_LOGO_MAX_SIZE_BYTES =
  ROASTER_LOGO_COMPRESSION_OPTIONS.maxSizeMB * 1024 * 1024;
