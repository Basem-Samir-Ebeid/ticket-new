import { Resend } from 'resend'

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to,
      subject,
      html,
    })
  } catch (err) {
    console.error('Email send error:', err)
  }
}
