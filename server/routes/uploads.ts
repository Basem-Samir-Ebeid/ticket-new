import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth } from '../auth'

const router = Router()

const uploadDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
])

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + path.extname(file.originalname))
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('File type not allowed. Accepted: images (JPG/PNG/GIF/WebP), PDF, Word, Excel, plain text, ZIP'))
    }
  },
})

router.post('/', requireAuth as any, (req: any, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'حجم الملف يتجاوز الحد المسموح (5MB)' })
      }
      return res.status(400).json({ error: err.message })
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'فشل رفع الملف' })
    }
    if (!req.file) return res.status(400).json({ error: 'لم يتم إرسال أي ملف' })
    const url = `/uploads/${req.file.filename}`
    res.json({ url, name: req.file.originalname })
  })
})

// ─── Multi-file upload (up to 5) ─────────────────────────────────────────────
router.post('/multiple', requireAuth as any, (req: any, res: Response, next: NextFunction) => {
  upload.array('files', 5)(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'حجم الملف يتجاوز الحد المسموح (5MB)' })
      }
      return res.status(400).json({ error: err.message })
    }
    if (err) return res.status(400).json({ error: err.message || 'فشل رفع الملفات' })
    const files = (req.files as Express.Multer.File[]) || []
    if (!files.length) return res.status(400).json({ error: 'لم يتم إرسال أي ملفات' })
    const results = files.map(f => ({ url: `/uploads/${f.filename}`, name: f.originalname, size: f.size, mime: f.mimetype }))
    res.json(results)
  })
})

export default router
