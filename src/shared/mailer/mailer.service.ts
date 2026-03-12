import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter;

  async onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.logger.log(
      `SMTP transporter initialized for ${process.env.SMTP_USER}`,
    );
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: `"Instagram Clone" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Your OTP for Instagram Clone',
        text: `Your OTP is: ${otp}. It will expire in 10 minutes.`,
      });

      this.logger.log(`OTP email sent to: ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send OTP email to ${to}: ${err.message}`);
      throw err;
    }
  }
}
