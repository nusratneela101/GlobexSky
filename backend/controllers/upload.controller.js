import cloudinary from '../config/cloudinary.js';

export async function uploadFile(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });
    res.json({
      success: true,
      data: {
        url: req.file.path,
        public_id: req.file.filename,
        original_name: req.file.originalname,
        size: req.file.size,
        format: req.file.mimetype,
      },
    });
  } catch (err) { next(err); }
}

export async function uploadMultipleFiles(req, res, next) {
  try {
    if (!req.files?.length) return res.status(400).json({ success: false, error: 'No files uploaded.' });
    const files = req.files.map((f) => ({
      url: f.path,
      public_id: f.filename,
      original_name: f.originalname,
      size: f.size,
    }));
    res.json({ success: true, data: files });
  } catch (err) { next(err); }
}

export async function deleteFile(req, res, next) {
  try {
    const publicId = decodeURIComponent(req.params.publicId);
    await cloudinary.uploader.destroy(publicId);
    res.json({ success: true, message: 'File deleted.' });
  } catch (err) { next(err); }
}
