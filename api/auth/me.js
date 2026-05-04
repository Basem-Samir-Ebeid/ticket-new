import { authenticate, allowMethods } from '../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { password_hash, ...safeProfile } = auth.profile
  res.json(safeProfile)
}
