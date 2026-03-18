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
 * Generate a signed URL for secure uploads (e.g., direct browser uploads).
 */
export function generateSignedUploadUrl(folder = 'globexsky/general') {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET);
  return { timestamp, signature, cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY, folder };
}
