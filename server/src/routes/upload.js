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

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default function uploadRouter(pool) {
  const router = express.Router();

  router.post('/menu/:id/image', authMiddleware, upload.single('image'), async (req, res) => {
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