import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { COMMON_CONFIG } from 'src/config/common.config';
import { otpTemplate } from './templates/otp.template';

@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter!: Transporter;

  async onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: COMMON_CONFIG.SMTP.host,
      port: COMMON_CONFIG.SMTP.port,
      secure: COMMON_CONFIG.SMTP.secure,
      auth: {
        user: COMMON_CONFIG.SMTP.user,
        pass: COMMON_CONFIG.SMTP.pass,
      },
    });

    this.logger.log(`SMTP initialized for ${COMMON_CONFIG.SMTP.user}`);
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    try {
      const expiryMinutes = COMMON_CONFIG.OTP.expiryMinutes;
      await this.transporter.sendMail({
        from: `"${COMMON_CONFIG.APP.name}" <${COMMON_CONFIG.SMTP.user}>`,
        to,
        subject: COMMON_CONFIG.MAIL.otpSubject,
        html: otpTemplate(otp, expiryMinutes),
      });

      this.logger.log(`OTP email sent to: ${to}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Failed to send OTP email to ${to}: ${errorMessage}`);
      throw err;
    }
  }
}
