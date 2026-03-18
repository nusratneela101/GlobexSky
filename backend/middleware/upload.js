import multer from 'multer';
import cloudinary from '../config/cloudinary.js';

/**
 * Custom Cloudinary storage engine for Multer (compatible with cloudinary v2).
 */
class CloudinaryStorage {
  constructor(folder) {
    this.folder = folder;
  }

  _handleFile(_req, file, cb) {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: `globexsky/${this.folder}`, transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
      (error, result) => {
        if (error) return cb(error);
        cb(null, { path: result.secure_url, filename: result.public_id, size: result.bytes });
      },
    );
    file.stream.pipe(uploadStream);
  }

  _removeFile(_req, file, cb) {
    cloudinary.uploader.destroy(file.filename, cb);
  }
}

const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10 MB

function createUploader(folder) {
  return multer({
    storage: new CloudinaryStorage(folder),
    limits: { fileSize: FILE_SIZE_LIMIT },
    fileFilter(_req, file, cb) {
      const allowed = /jpeg|jpg|png|webp|gif|pdf/;
      if (allowed.test(file.mimetype)) return cb(null, true);
      cb(new Error('Invalid file type. Allowed: jpg, jpeg, png, webp, gif, pdf'));
    },
  });
}

export const uploadProduct  = createUploader('products');
export const uploadAvatar   = createUploader('avatars');
export const uploadDocument = createUploader('documents');
export const uploadBanner   = createUploader('banners');
export const uploadGeneral  = createUploader('general');
