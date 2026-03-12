import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RedisService } from 'src/shared/redis/redis.service';
import { User } from '../user/entities/user.entity';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { TempTokenData } from 'src/common/types/auth.types';
import { AUTH_CONSTANTS } from 'src/common/constants/constants';
import { MESSAGES } from './response/auth.response';
import { JWT_CONFIG } from 'src/config/jwt.config';
import {
  ApiResponse,
  CreateProfileResponse,
  LoginResponse,
  RefreshTokenResponse,
  SendOtpResponse,
  VerifyOtpResponse,
} from './interfaces/auth-response.interface';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailerService } from 'src/shared/mailer/mailer.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthAttempt } from '../user/entities/auth_attempts.entity';
import { COMMON_CONFIG, NODE_ENV_TYPE } from 'src/config/common.config';
import { AttemptStatus, AttemptType, OtpType } from 'src/common/enum/enum.common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly redisService: RedisService,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(AuthAttempt)
    private readonly authAttemptRepo: Repository<AuthAttempt>,

    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Sends OTP for signup or forgot password.
   *
   * Flow:
   * 1. Validate user existence depending on OTP type
   * 2. Generate OTP (email/phone)
   * 3. Store hashed OTP in Redis with TTL
   * 4. Return temporary token for OTP verification
   * 5. Applies rate limiting using Redis to prevent OTP spam attacks.
   */
  async sendOtp(dto: SendOtpDto): Promise<ApiResponse<SendOtpResponse>> {
    const identifier = this.getIdentifier(dto);

    // Redis rate limit protection
    await this.checkOtpRateLimit(identifier);
    this.logger.log(`OTP request received for ${identifier} [${dto.type}]`);

    /**
     * Signup validation
     */
    if (dto.type === OtpType.SIGNUP) {
      const existingUser = await this.userRepo.findOne({
        where: dto.email ? { email: dto.email } : { phone: dto.phone },
      });

      if (existingUser) {
        this.logger.warn(`Signup attempt with existing user: ${identifier}`);
        await this.authAttemptRepo.save({
          email: dto.email,
          phone: dto.phone,
          attemptType: AttemptType.SIGNUP,
          status: AttemptStatus.USER_ALREADY_EXISTS,
        });
        throw new BadRequestException(MESSAGES.USER_ALREADY_EXISTS);
      }
    }

    /**
     * Forgot password validation
     */
    if (dto.type === OtpType.FORGOT_PASSWORD) {
      const user = await this.userRepo.findOne({
        where: dto.email ? { email: dto.email } : { phone: dto.phone },
      });

      if (!user) {
        this.logger.warn(
          `Forgot password requested for non-existing user: ${identifier}`,
        );
        await this.authAttemptRepo.save({
          email: dto.email,
          phone: dto.phone,
          attemptType: AttemptType.FORGOT_PASSWORD,
          status: AttemptStatus.INVALID_USER,
        });
        throw new NotFoundException(MESSAGES.USER_NOT_FOUND);
      }
    }

    /**
     * OTP bypass allowed only in dev or qa environment
     */
    const bypassAllowed = this.isOtpBypassAllowed();

    let otp: string;

    if (bypassAllowed) {
      otp = COMMON_CONFIG.otp.bypassCode;
      this.logger.warn(`OTP bypass active for ${identifier}`);
    } else {
      otp = this.generateRandomOtp();

      if (dto.email) {
        await this.mailerService.sendOtpEmail(dto.email, otp);
      }

      if (dto.phone) {
        // SMS integration here for future
      }
    }

    const hashedOtp = await bcrypt.hash(otp, 10);

    /**
     * Store OTP session in Redis
     */
    await this.redisService.set(
      `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`,
      {
        otp: hashedOtp,
        verified: false,
        type: dto.type,
        verifyAttempts: 0,
      },
      AUTH_CONSTANTS.OTP_TTL_SECONDS,
    );

    const token = this.jwtService.sign(
      {
        email: dto.email,
        phoneNumber: dto.phone,
        type: dto.type,
      },
      { expiresIn: AUTH_CONSTANTS.TEMP_TOKEN_EXPIRES_IN },
    );

    return {
      message: MESSAGES.OTP_SENT,
      data: {
        tempToken: token,
      },
    };
  }

  /**
   * Verifies OTP entered by the user.
   * Implements brute force protection using verify attempt count.
   */
  async verifyOtp(
    dto: VerifyOtpDto,
    tempTokenData: TempTokenData,
  ): Promise<ApiResponse<VerifyOtpResponse>> {
    const identifier = this.getIdentifier({
      email: tempTokenData.email,
      phone: tempTokenData.phoneNumber,
    });
    const session = await this.redisService.get(
      `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`,
    );

    if (!session) {
      this.logger.warn(`OTP session expired for ${identifier}`);
      throw new NotFoundException(MESSAGES.OTP_SESSION_EXPIRED);
    }

    if (session.verified) {
      this.logger.warn(`OTP already verified attempt for ${identifier}`);
      throw new BadRequestException(MESSAGES.OTP_ALREADY_VERIFIED);
    }
    /**
     * Brute force protection
     */
    if (session.verifyAttempts >= COMMON_CONFIG.otp.maxVerifyAttempts) {
      this.logger.warn(`OTP verify attempts exceeded for ${identifier}`);
      throw new ForbiddenException(MESSAGES.TOO_MANY_VERIFY_OTP_ATTEMPTS);
    }

    const bypassAllowed = this.isOtpBypassAllowed();

    let isMatch = false;

    if (bypassAllowed && dto.otp === COMMON_CONFIG.otp.bypassCode) {
      isMatch = true;
    } else {
      isMatch = await bcrypt.compare(dto.otp, session.otp);
    }
    if (!isMatch) {
      await this.redisService.set(
        `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`,
        {
          ...session,
          verifyAttempts: session.verifyAttempts + 1,
        },
        AUTH_CONSTANTS.OTP_TTL_SECONDS,
      );

      this.logger.warn(`Invalid OTP attempt for ${identifier}`);

      throw new BadRequestException(MESSAGES.INVALID_OTP);
    }

    await this.redisService.set(
      `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`,
      { ...session, verified: true },
      AUTH_CONSTANTS.OTP_TTL_SECONDS,
    );
    this.logger.log(`OTP verified successfully for ${identifier}`);
    return {
      message: MESSAGES.OTP_VERIFIED,
      data: {
        verified: true,
      },
    };
  }

  async createProfile(
    dto: CreateProfileDto,
    tempTokenData: TempTokenData,
  ): Promise<ApiResponse<CreateProfileResponse>> {
    const identifier = this.getIdentifier({
      email: tempTokenData.email,
      phone: tempTokenData.phoneNumber,
    });
    const session = await this.redisService.get(
      `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`,
    );

    if (!session) {
      throw new NotFoundException(MESSAGES.OTP_SESSION_EXPIRED);
    }

    if (session.type === OtpType.FORGOT_PASSWORD) {
      throw new BadRequestException(MESSAGES.INVALID_OTP_TYPE);
    }

    if (!session.verified) {
      throw new UnauthorizedException(MESSAGES.OTP_NOT_VERIFIED);
    }

    const existingUser = await this.userRepo.findOne({
      where: { username: dto.username },
    });
    if (existingUser) {
      this.logger.warn(`Username already taken: ${dto.username}`);
      throw new BadRequestException(MESSAGES.USERNAME_TAKEN);
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepo.create({
      ...(tempTokenData.email && { email: tempTokenData.email }),
      ...(tempTokenData.phoneNumber && { phone: tempTokenData.phoneNumber }),
      fullName: dto.fullName,
      username: dto.username,
      age: dto.age,
      gender: dto.gender,
      password: hashedPassword,
      isVerified: true,
    });

    await this.userRepo.save(user);
    await this.redisService.del(
      `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`,
    );

    const payload = { userId: user.id, username: user.username };
    const accessToken = this.jwtService.sign(payload, {
      secret: JWT_CONFIG.secret,
      expiresIn: JWT_CONFIG.expiresIn, // 10 min
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: JWT_CONFIG.refreshSecret,
      expiresIn: JWT_CONFIG.refreshExpiresIn,
    });

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.redisService.set(
      `refresh_token:${user.id}`,
      hashedRefreshToken,
      JWT_CONFIG.refreshExpiresIn,
    );
    this.logger.log(`User profile created: ${user.id}`);
    return {
      message: MESSAGES.PROFILE_CREATED,
      data: {
        userId: user.id,
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * Authenticates user using email/phone/username and password.
   *
   * Flow:
   * 1. Fetch user
   * 2. Validate password
   * 3. Generate access + refresh tokens
   * 4. Store refresh token hash in Redis
   */
  async login(dto: LoginDto): Promise<ApiResponse<LoginResponse>> {
    const query = this.userRepo.createQueryBuilder('user');

    if (dto.email) {
      query.where('user.email = :email', { email: dto.email });
    } else if (dto.phone) {
      query.where('user.phone = :phone', { phone: dto.phone });
    } else {
      query.where('user.username = :username', { username: dto.username });
    }
    const user = await query.addSelect('user.password').getOne();

    if (!user) {
      await this.authAttemptRepo.save({
        email: dto.email,
        phone: dto.phone,
        attemptType: AttemptType.LOGIN,
        status: AttemptStatus.INVALID_USER,
      });

      throw new UnauthorizedException(MESSAGES.INVALID_CREDENTIALS);
    }

    if (!user.isVerified) {
      throw new UnauthorizedException(MESSAGES.INVALID_CREDENTIALS);
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatch) {
      await this.authAttemptRepo.save({
        email: dto.email,
        phone: dto.phone,
        attemptType: AttemptType.LOGIN,
        status: AttemptStatus.WRONG_PASSWORD,
      });
      throw new UnauthorizedException(MESSAGES.INVALID_CREDENTIALS);
    }

    const payload = {
      userId: user.id,
      username: user.username,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: JWT_CONFIG.secret,
      expiresIn: JWT_CONFIG.expiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: JWT_CONFIG.refreshSecret,
      expiresIn: JWT_CONFIG.refreshExpiresIn,
    });

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.redisService.set(
      `refresh_token:${user.id}`,
      hashedRefreshToken,
      JWT_CONFIG.refreshExpiresIn,
    );
    this.logger.log(`User logged in: ${user.id}`);

    return {
      message: MESSAGES.LOGIN_SUCCESS,
      data: {
        userId: user.id,
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * Generates a new access token using a valid refresh token.
   *
   * Flow:
   * 1. Verify refresh token
   * 2. Compare with stored hash in Redis
   * 3. Rotate refresh token
   * 4. Return new tokens
   */
  async refreshToken(
    dto: RefreshTokenDto,
  ): Promise<ApiResponse<RefreshTokenResponse>> {
    const payload = this.jwtService.verify<{
      userId: string;
      username: string;
    }>(dto.refreshToken, {
      secret: JWT_CONFIG.refreshSecret,
    });

    const storedHashedToken = await this.redisService.get(
      `refresh_token:${payload.userId}`,
    );

    if (!storedHashedToken) {
      throw new UnauthorizedException(MESSAGES.INVALID_REFRESH_TOKEN);
    }

    const isValid = await bcrypt.compare(dto.refreshToken, storedHashedToken);

    if (!isValid) {
      throw new UnauthorizedException(MESSAGES.INVALID_REFRESH_TOKEN);
    }

    const newAccessToken = this.jwtService.sign(
      { userId: payload.userId, username: payload.username },
      {
        secret: JWT_CONFIG.secret,
        expiresIn: JWT_CONFIG.expiresIn,
      },
    );

    const newRefreshToken = this.jwtService.sign(
      { userId: payload.userId, username: payload.username },
      {
        secret: JWT_CONFIG.refreshSecret,
        expiresIn: JWT_CONFIG.refreshExpiresIn,
      },
    );

    const newHashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);

    await this.redisService.set(
      `refresh_token:${payload.userId}`,
      newHashedRefreshToken,
      JWT_CONFIG.refreshExpiresIn,
    );

    this.logger.log(`Refresh token rotated for user: ${payload.userId}`);

    return {
      message: MESSAGES.REFRESH_TOKEN_SUCCESS,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    tempTokenData: TempTokenData,
  ): Promise<ApiResponse<null>> {
    const identifier = this.getIdentifier({
      email: tempTokenData.email,
      phone: tempTokenData.phoneNumber,
    });
    const session = await this.redisService.get(
      `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`,
    );

    if (!session?.verified || session.type !== OtpType.FORGOT_PASSWORD) {
      throw new UnauthorizedException(MESSAGES.OTP_NOT_VERIFIED);
    }

    const user = await this.userRepo.findOne({
      where: tempTokenData.email
        ? { email: tempTokenData.email }
        : { phone: tempTokenData.phoneNumber },
    });

    if (!user) {
      this.logger.warn(
        `Password reset requested for non-existing user: ${identifier}`,
      );
      throw new NotFoundException(MESSAGES.USER_NOT_FOUND);
    }

    const samePassword = await bcrypt.compare(dto.newPassword, user.password);

    if (samePassword) {
      this.logger.warn(`User tried resetting same password: ${identifier}`);
      throw new BadRequestException(MESSAGES.PASSWORD_MUST_BE_DIFFERENT);
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.userRepo.update(user.id, {
      password: hashedPassword,
    });

    await this.redisService.del(
      `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`,
    );
    this.logger.log(`Password reset successful for user: ${user.id}`);
    return {
      message: MESSAGES.PASSWORD_RESET_SUCCESS,
      data: null,
    };
  }

  /**
   * Resends OTP to the user if the previous OTP session is still valid.
   * Applies rate limiting and respects OTP bypass rules for dev/qa environments.
   */
  async resendOtp(
    tempTokenData: TempTokenData,
  ): Promise<ApiResponse<SendOtpResponse>> {
    const identifier = this.getIdentifier({
      email: tempTokenData.email,
      phone: tempTokenData.phoneNumber,
    });
    // Rate limit protection
    await this.checkOtpRateLimit(identifier);
    const key = `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`;
    const session = await this.redisService.get(key);

    if (!session) {
      this.logger.warn(`Resend OTP failed: session expired for ${identifier}`);
      throw new NotFoundException(MESSAGES.OTP_SESSION_EXPIRED);
    }

    if (session.verified) {
      this.logger.warn(
        `Resend OTP attempted after verification for ${identifier}`,
      );
      throw new BadRequestException(MESSAGES.OTP_ALREADY_VERIFIED);
    }

    if (session.type !== tempTokenData.type) {
      this.logger.warn(`Resend OTP type mismatch for ${identifier}`);
      throw new BadRequestException(MESSAGES.INVALID_OTP_TYPE);
    }

    /**
     * Allow OTP bypass only in development or QA environment
     */
    const bypassAllowed = this.isOtpBypassAllowed();

    let otp: string;

    if (bypassAllowed) {
      otp = COMMON_CONFIG.otp.bypassCode;
      this.logger.warn(`OTP bypass active during resend for ${identifier}`);
    } else {
      otp = this.generateRandomOtp();

      if (tempTokenData.email) {
        await this.mailerService.sendOtpEmail(tempTokenData.email, otp);
      }

      if (tempTokenData.phoneNumber) {
        // Future SMS integration
      }
    }

    const hashedOtp = await bcrypt.hash(otp, 10);

    /**
     * Update OTP session in Redis and reset verify attempts
     */
    await this.redisService.set(
      key,
      {
        ...session,
        otp: hashedOtp,
        verifyAttempts: 0,
      },
      AUTH_CONSTANTS.OTP_TTL_SECONDS,
    );

    /**
     * Generate new temporary token
     */
    const token = this.jwtService.sign(
      {
        email: tempTokenData.email,
        phoneNumber: tempTokenData.phoneNumber,
        type: tempTokenData.type,
      },
      { expiresIn: AUTH_CONSTANTS.TEMP_TOKEN_EXPIRES_IN },
    );

    this.logger.log(`OTP resent successfully for ${identifier}`);

    return {
      message: MESSAGES.OTP_SENT,
      data: {
        tempToken: token,
      },
    };
  }

  // Helper functions
  private getIdentifier(data: { email?: string; phone?: string }): string {
    const identifier = data.email || data.phone;
    if (!identifier) {
      throw new BadRequestException(MESSAGES.EMAIL_OR_PHONE_REQUIRED);
    }
    return identifier;
  }

  private generateRandomOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async checkOtpRateLimit(identifier: string): Promise<void> {
    const key = `otp_rate_limit:${identifier}`;

    const attempts = await this.redisService.get(key);

    if (attempts && Number(attempts) >= COMMON_CONFIG.otp.rateLimitMax) {
      this.logger.warn(`OTP rate limit exceeded for ${identifier}`);
      throw new ForbiddenException(MESSAGES.TOO_MANY_OTP_REQUESTS);
    }

    if (!attempts) {
      await this.redisService.set(key, 1, COMMON_CONFIG.otp.rateLimitWindow);
    } else {
      await this.redisService.incr(key);
    }
  }

  private isOtpBypassAllowed() {
    return (
      COMMON_CONFIG.otp.bypassEnabled &&
      [NODE_ENV_TYPE.DEV, NODE_ENV_TYPE.QA].includes(COMMON_CONFIG.nodeEnv)
    );
  }
}
