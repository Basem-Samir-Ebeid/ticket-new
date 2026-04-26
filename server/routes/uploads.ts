import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth } from '../auth'

const router = Router()

const uploadDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + path.extname(file.originalname))
  },
})

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })

router.post('/', requireAuth as any, upload.single('file'), (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const url = `/uploads/${req.file.filename}`
  res.json({ url })
})

export default router
