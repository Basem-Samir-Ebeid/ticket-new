import { authenticate, allowMethods } from '../_lib/helpers.js'
import multer from 'multer'

export const config = {
  api: { bodyParser: false },
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result)
      return resolve(result)
    })
  })
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  await runMiddleware(req, res, upload.single('file'))

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const base64 = req.file.buffer.toString('base64')
  const mimeType = req.file.mimetype
  const url = `data:${mimeType};base64,${base64}`

  res.json({ url })
}
