import { Resend } from 'resend'

const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resendClient) return
  try {
    await resendClient.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to,
      subject,
      html,
    })
  } catch (err) {
    console.error('Email send error:', err)
  }
}
