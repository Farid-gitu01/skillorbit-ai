import nodemailer, { type Transporter } from 'nodemailer';
import {
  CLIENT_URL,
  EMAIL_FROM,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
} from '../../config/constants.js';

type MailTransport = Pick<Transporter, 'sendMail'>;

export class EmailDeliveryUnavailableError extends Error {
  constructor() {
    super('Email delivery is not configured');
    this.name = 'EmailDeliveryUnavailableError';
  }
}

const configuredTransport: MailTransport | null =
  SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    : null;

const defaultFrom = EMAIL_FROM;
const frontendBaseUrl = CLIENT_URL.replace(/\/$/, '');

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character]!;
  });

export interface EmailService {
  isConfigured(): boolean;
  sendVerificationEmail(to: string, token: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
}

export const createEmailService = (
  transport: MailTransport | null,
  from: string | undefined,
  frontendUrl = frontendBaseUrl
): EmailService => {
  const send = async (to: string, subject: string, text: string, html: string): Promise<void> => {
    if (!transport || !from) throw new EmailDeliveryUnavailableError();
    await transport.sendMail({ from, to, subject, text, html });
  };

  return {
    isConfigured: () => Boolean(transport && from),
    async sendVerificationEmail(to, token) {
      const link = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
      const safeLink = escapeHtml(link);
      await send(
        to,
        'Verify your SkillOrbit AI email',
        `Verify your email using this link: ${link}\nThis link expires in 24 hours.`,
        `<p>Verify your SkillOrbit AI email address.</p><p><a href="${safeLink}">Verify email</a></p><p>This link expires in 24 hours.</p>`
      );
    },
    async sendPasswordResetEmail(to, token) {
      const link = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
      const safeLink = escapeHtml(link);
      await send(
        to,
        'Reset your SkillOrbit AI password',
        `Reset your password using this link: ${link}\nThis link expires in 15 minutes.`,
        `<p>A password reset was requested for your SkillOrbit AI account.</p><p><a href="${safeLink}">Reset password</a></p><p>This link expires in 15 minutes. If you did not request this, ignore this email.</p>`
      );
    },
  };
};

export const emailService = createEmailService(configuredTransport, defaultFrom);
