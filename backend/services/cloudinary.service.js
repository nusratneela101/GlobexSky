import cloudinary from '../config/cloudinary.js';

/**
 * Upload a file buffer/stream to Cloudinary.
 * @param {Buffer|string} file - Buffer or file path
 * @param {string} folder
 * @param {object} options
 */
export async function uploadToCloudinary(file, folder = 'globexsky/general', options = {}) {
  return cloudinary.uploader.upload(file, {
    folder,
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    ...options,
  });
}

/**
 * Delete a file from Cloudinary by its public_id.
 */
export async function deleteCloudinaryFile(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

/**
 * Upload a file from a remote URL to Cloudinary.
 * Useful for importing product images from external sources.
 * @param {string} url    - Remote image URL
 * @param {string} publicId - Desired public_id (without folder prefix)
 * @param {string} folder
 */
export async function uploadFromUrl(url, publicId, folder = 'globexsky/products') {
  return cloudinary.uploader.upload(url, {
    folder,
    public_id: publicId,
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    overwrite: false,
  });
}

/**
 * Generate a signed URL for secure uploads (e.g., direct browser uploads).
 */
export function generateSignedUploadUrl(folder = 'globexsky/general') {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET);
  return { timestamp, signature, cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY, folder };
}
