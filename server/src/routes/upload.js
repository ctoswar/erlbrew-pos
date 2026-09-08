import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth.js';

const UPLOAD_DIR = path.resolve('server/uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `menu_${uuidv4().slice(0, 8)}${ext}`);
  },
});

// SECURITY FIX: Validate file types and MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Invalid file extension. Allowed: ' + ALLOWED_EXTENSIONS.join(', ')));
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Allowed: ' + ALLOWED_MIME_TYPES.join(', ')));
    }
    cb(null, true);
  },
});

export default function uploadRouter(pool) {
  const router = express.Router();

  router.post('/menu/:id/image', authMiddleware, (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
          }
          return res.status(400).json({ error: `Upload error: ${err.message}` });
        }
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, async (req, res) => {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    try {
      const imageUrl = `/uploads/${req.file.filename}`;
      await pool.query('UPDATE menu_items SET image = ? WHERE id = ?', [imageUrl, id]);
      res.json({ imageUrl });
    } catch (e) {
      console.error('Failed to save image:', e);
      fs.unlink(req.file.path).catch(() => {});
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}