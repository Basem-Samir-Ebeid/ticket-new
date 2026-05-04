import { setCors, allowMethods } from '../_lib/helpers.js'

export default function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null })
}
