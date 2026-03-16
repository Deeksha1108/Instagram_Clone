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
import {
  AUTH_CONSTANTS,
  AUTH_PROVIDERS,
  REDIS_KEYS,
} from 'src/common/constants/constants';
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
import { UserSession } from '../user/entities/user_sessions.entity';
import { v4 as uuidv4 } from 'uuid';
import { FacebookLoginDto } from './dto/facebook-login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly redisService: RedisService,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(AuthAttempt)
    private readonly authAttemptRepo: Repository<AuthAttempt>,

    @InjectRepository(UserSession)
    private readonly userSessionRepo: Repository<UserSession>,

    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Sends an OTP for signup or forgot-password; validates user existence, applies rate limiting,
   * hashes & stores the OTP in Redis, and returns a short-lived temp token.
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
   * Verifies the OTP for a given identifier; tracks attempts to prevent brute force
   * and marks the Redis session as verified on success.
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

  /**
   * Creates a new user account after OTP verification; saves the user in DB and returns auth tokens.
   */
  async createProfile(
    dto: CreateProfileDto,
    tempTokenData: TempTokenData,
  ): Promise<ApiResponse<CreateProfileResponse>> {
    const identifier = this.getIdentifier({
      email: tempTokenData.email,
      phone: tempTokenData.phoneNumber,
    });
    const otpSsession = await this.redisService.get(
      `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`,
    );

    if (!otpSsession) {
      throw new NotFoundException(MESSAGES.OTP_SESSION_EXPIRED);
    }

    if (otpSsession.type === OtpType.FORGOT_PASSWORD) {
      throw new BadRequestException(MESSAGES.INVALID_OTP_TYPE);
    }

    if (!otpSsession.verified) {
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

    const session = await this.createUserSessionAndTokens(
      user,
      AUTH_PROVIDERS.LOCAL,
    );
    this.logger.log(`User profile created: ${user.id}`);
    return {
      message: MESSAGES.PROFILE_CREATED,
      data: session,
    };
  }

  /**
   * Authenticates a user with email/phone/username + password and returns auth tokens.
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

    const session = await this.createUserSessionAndTokens(user, 'local');

    this.logger.log(`User logged in: ${user.id}`);

    return {
      message: MESSAGES.LOGIN_SUCCESS,
      data: session,
    };
  }

  /**
   * Logs in or registers a user via Facebook access token;
   * links to an existing account by email if found, otherwise creates a new one.
   */
  async facebookLogin(
    dto: FacebookLoginDto,
  ): Promise<ApiResponse<LoginResponse>> {
    let response: Response;

    try {
      response = await fetch(
        `${process.env.FACEBOOK_GRAPH_URL}?fields=${process.env.FACEBOOK_FIELDS}&access_token=${dto.accessToken}`,
      );
    } catch (e) {
      throw new UnauthorizedException(MESSAGES.FACEBOOK_VERIFICATION_FAILED);
    }

    if (!response.ok) {
      throw new UnauthorizedException(MESSAGES.INVALID_FACEBOOK_TOKEN);
    }

    const profile = await response.json();

    if (!profile?.id) {
      throw new UnauthorizedException(MESSAGES.FACEBOOK_USER_NOT_VERIFIED);
    }
    let user = await this.userRepo.findOne({
      where: { facebookId: profile.id },
    });
    if (!user && profile.email) {
      user = await this.userRepo.findOne({
        where: { email: profile.email },
      });

      if (user) {
        user.facebookId = profile.id;
        user.provider = AUTH_PROVIDERS.FACEBOOK;

        await this.userRepo.save(user);
      }
    }
    if (!user) {
      user = this.userRepo.create({
        email: profile.email,
        fullName: profile.name,
        isVerified: true,
        facebookId: profile.id,
        provider: AUTH_PROVIDERS.FACEBOOK,
      });

      await this.userRepo.save(user);
    }
    const session = await this.createUserSessionAndTokens(
      user,
      AUTH_PROVIDERS.FACEBOOK,
    );
    this.logger.log(`Facebook login successful for user: ${user.id}`);
    return {
      message: MESSAGES.LOGIN_SUCCESS,
      data: session,
    };
  }

  /**
   * Rotates the refresh token: verifies the existing one against Redis,
   * then issues a new access + refresh token pair.
   */
  async refreshToken(
    dto: RefreshTokenDto,
  ): Promise<ApiResponse<RefreshTokenResponse>> {
    const payload = this.jwtService.verify<{
      userId: string;
      username: string;
      sessionId: string;
    }>(dto.refreshToken, {
      secret: JWT_CONFIG.refreshSecret,
    });

    const session = await this.userSessionRepo.findOne({
      where: {
        sessionId: payload.sessionId,
        isActive: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException(MESSAGES.INVALID_REFRESH_TOKEN);
    }

    const storedToken = await this.redisService.get(
      `${REDIS_KEYS.REFRESH_TOKEN}:${payload.sessionId}`,
    );

    if (!storedToken) {
      throw new UnauthorizedException(MESSAGES.INVALID_REFRESH_TOKEN);
    }

    const isValid = dto.refreshToken === storedToken;

    if (!isValid) {
      throw new UnauthorizedException(MESSAGES.INVALID_REFRESH_TOKEN);
    }
    await this.redisService.del(
      `${REDIS_KEYS.REFRESH_TOKEN}:${payload.sessionId}`,
    );

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      this.generateJwtTokens({
        userId: payload.userId,
        username: payload.username,
        sessionId: payload.sessionId,
      });

    // const newHashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);

    await this.redisService.set(
      `${REDIS_KEYS.REFRESH_TOKEN}:${payload.sessionId}`,
      newRefreshToken,
      JWT_CONFIG.refreshExpiresIn,
    );

    await this.userSessionRepo.update(
      { sessionId: payload.sessionId, isActive: true },
      { expiresAt: new Date(Date.now() + JWT_CONFIG.refreshExpiresIn * 1000) },
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

  /**
   * Resets the user's password after verifying the forgot-password OTP;
   * rejects if the new password is the same as the current one.
   */
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
   * Resends OTP if the previous session is still valid; rate-limited and
   * respects the OTP bypass setting in dev/qa environments.
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

  /**
   * Deactivates the given session in DB and removes its refresh token from Redis.
   */
  async logout(sessionId: string): Promise<ApiResponse<null>> {
    const session = await this.userSessionRepo.findOne({
      where: { sessionId, isActive: true },
    });
    if (!session) {
      throw new UnauthorizedException(MESSAGES.INVALID_SESSION);
    }
    await this.userSessionRepo.update({ sessionId }, { isActive: false });

    await this.redisService.del(`${REDIS_KEYS.REFRESH_TOKEN}:${sessionId}`);

    this.logger.log(`Session logged out: ${sessionId}`);

    return {
      message: MESSAGES.LOGOUT_SUCCESS,
      data: null,
    };
  }

  /**
   * Deactivates all active sessions for a user and clears their refresh tokens from Redis.
   */
  async logoutAll(userId: string): Promise<ApiResponse<null>> {
    const sessions = await this.userSessionRepo.find({
      where: { userId, isActive: true },
    });

    for (const session of sessions) {
      await this.redisService.del(
        `${REDIS_KEYS.REFRESH_TOKEN}:${session.sessionId}`,
      );
    }

    await this.userSessionRepo.update(
      { userId, isActive: true },
      { isActive: false },
    );
    this.logger.log(`All sessions logged out for user: ${userId}`);

    return { message: MESSAGES.LOGOUT_SUCCESS, data: null };
  }

  // Helper functions
  /** Returns email or phone as a single identifier string; throws if neither is provided. */
  private getIdentifier(data: { email?: string; phone?: string }): string {
    const identifier = data.email || data.phone;
    if (!identifier) {
      throw new BadRequestException(MESSAGES.EMAIL_OR_PHONE_REQUIRED);
    }
    return identifier;
  }

  /** Generates a 6-digit random OTP string. */
  private generateRandomOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /** Enforces per-identifier OTP request rate limiting via Redis; throws if the limit is exceeded. */
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

  /** Returns true if OTP bypass is enabled and the current environment is dev or QA. */
  private isOtpBypassAllowed() {
    return (
      COMMON_CONFIG.otp.bypassEnabled &&
      [NODE_ENV_TYPE.DEV, NODE_ENV_TYPE.QA].includes(COMMON_CONFIG.nodeEnv)
    );
  }

  /**
   * Signs and returns access + refresh JWT tokens for the given session payload.
   */
  private generateJwtTokens(payload: {
    userId: string;
    username: string;
    sessionId: string;
  }) {
    const accessToken = this.jwtService.sign(payload, {
      secret: JWT_CONFIG.secret,
      expiresIn: JWT_CONFIG.expiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: JWT_CONFIG.refreshSecret,
      expiresIn: JWT_CONFIG.refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Persists a new session record in DB, stores the refresh token in Redis,
   * and returns the access + refresh token pair.
   */
  private async createUserSessionAndTokens(
    user: User,
    provider: AUTH_PROVIDERS = AUTH_PROVIDERS.LOCAL,
  ): Promise<LoginResponse> {
    const sessionId = uuidv4();

    const payload = {
      userId: user.id,
      username: user.username,
      sessionId,
    };

    const { accessToken, refreshToken } = this.generateJwtTokens(payload);

    const newSession = this.userSessionRepo.create({
      userId: user.id,
      sessionId,
      loginProvider: provider,
      loginAt: new Date(),
      expiresAt: new Date(Date.now() + JWT_CONFIG.refreshExpiresIn * 1000),
      device: AUTH_CONSTANTS.UNKNOWN_DEVICE,
      isActive: true,
    });

    await this.userSessionRepo.save(newSession);

    await this.redisService.set(
      `${REDIS_KEYS.REFRESH_TOKEN}:${sessionId}`,
      refreshToken,
      JWT_CONFIG.refreshExpiresIn,
    );

    return {
      userId: user.id,
      accessToken,
      refreshToken,
    };
  }
}
