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
import { JWT_CONFIG } from 'src/config/jwt.config';
import {
  ApiResponse,
  CreateProfileResponse,
  LoginResponse,
  RefreshTokenPayload,
  RefreshTokenResponse,
  SendOtpResponse,
  VerifyOtpResponse,
} from './interfaces/auth-response.interface';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailerService } from 'src/shared/mailer/mailer.service';
import { AuthAttempt } from '../user/entities/auth_attempts.entity';
import {
  COMMON_CONFIG,
  NODE_ENV_TYPE,
  OTP_CONFIG,
} from 'src/config/common.config';
import {
  AttemptStatus,
  AttemptType,
  OtpType,
} from 'src/common/enum/enum.common';
import { UserSession } from '../user/entities/user_sessions.entity';
import { v4 as uuidv4 } from 'uuid';
import { FacebookLoginDto } from './dto/facebook-login.dto';
import { AUTH_MESSAGES } from './response/auth.response';

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
    const redisKey = `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}:${dto.type}`;

    await this.checkOtpRateLimit(redisKey);

    const user = await this.userRepo.findOne({
      where: dto.email ? { email: dto.email } : { phone: dto.phone },
      select: ['id'],
    });

    if (dto.type === OtpType.SIGNUP && user) {
      this.authAttemptRepo
        .save({
          email: dto.email,
          phone: dto.phone,
          attemptType: AttemptType.SIGNUP,
          status: AttemptStatus.USER_ALREADY_EXISTS,
        })
        .catch(() => {});

      throw new BadRequestException(AUTH_MESSAGES.USER_ALREADY_EXISTS);
    }

    if (dto.type === OtpType.FORGOT_PASSWORD && !user) {
      this.authAttemptRepo
        .save({
          email: dto.email,
          phone: dto.phone,
          attemptType: AttemptType.FORGOT_PASSWORD,
          status: AttemptStatus.INVALID_USER,
        })
        .catch(() => {});

      throw new NotFoundException(AUTH_MESSAGES.USER_NOT_FOUND);
    }

    const bypassAllowed = this.isOtpBypassAllowed();

    const otp = bypassAllowed
      ? COMMON_CONFIG.otp.bypassCode
      : this.generateRandomOtp();

    const hashedOtp = await bcrypt.hash(otp, 6);

    await this.redisService.set(
      redisKey,
      {
        otp: hashedOtp,
        verified: false,
        type: dto.type,
        verifyAttempts: 0,
      },
      AUTH_CONSTANTS.OTP_TTL_SECONDS,
    );

    if (dto.email && !bypassAllowed) {
      this.mailerService.sendOtpEmail(dto.email, otp).catch(() => {});
    }

    const token = this.jwtService.sign(
      {
        email: dto.email,
        phoneNumber: dto.phone,
        type: dto.type,
      },
      { expiresIn: AUTH_CONSTANTS.TEMP_TOKEN_EXPIRES_IN },
    );

    return {
      message: AUTH_MESSAGES.OTP_SENT,
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
    const redisKey = `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}:${tempTokenData.type}`;
    const session = await this.redisService.get(redisKey);

    if (!session) {
      this.logger.warn(`OTP session expired for ${identifier}`);
      throw new NotFoundException(AUTH_MESSAGES.OTP_SESSION_EXPIRED);
    }

    if (session.verified) {
      this.logger.warn(`OTP already verified attempt for ${identifier}`);
      throw new BadRequestException(AUTH_MESSAGES.OTP_ALREADY_VERIFIED);
    }
    if (session.verifyAttempts >= COMMON_CONFIG.otp.maxVerifyAttempts) {
      this.logger.warn(`OTP verify attempts exceeded for ${identifier}`);
      throw new ForbiddenException(AUTH_MESSAGES.TOO_MANY_VERIFY_OTP_ATTEMPTS);
    }

    const bypassAllowed = this.isOtpBypassAllowed();

    let isMatch = false;

    if (bypassAllowed && dto.otp === COMMON_CONFIG.otp.bypassCode) {
      isMatch = true;
    } else if (dto.otp.length !== OTP_CONFIG.LENGTH) {
      isMatch = false;
    } else {
      isMatch = await bcrypt.compare(dto.otp, session.otp);
    }
    if (!isMatch) {
      session.verifyAttempts += 1;

      await this.redisService.set(
        redisKey,
        session,
        AUTH_CONSTANTS.OTP_TTL_SECONDS,
      );

      this.logger.warn(`Invalid OTP attempt for ${identifier}`);

      throw new BadRequestException(AUTH_MESSAGES.INVALID_OTP);
    }
    session.verified = true;

    await this.redisService.set(
      redisKey,
      session,
      AUTH_CONSTANTS.OTP_TTL_SECONDS,
    );
    this.logger.log(`OTP verified successfully for ${identifier}`);
    return {
      message: AUTH_MESSAGES.OTP_VERIFIED,
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
    device: string,
  ): Promise<ApiResponse<CreateProfileResponse>> {
    const identifier = this.getIdentifier({
      email: tempTokenData.email,
      phone: tempTokenData.phoneNumber,
    });
    const redisKey = `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}:${tempTokenData.type}`;

    const otpSession = await this.redisService.get(redisKey);

    if (!otpSession) {
      throw new NotFoundException(AUTH_MESSAGES.OTP_SESSION_EXPIRED);
    }

    if (otpSession.type === OtpType.FORGOT_PASSWORD) {
      throw new BadRequestException(AUTH_MESSAGES.INVALID_OTP_TYPE);
    }

    if (!otpSession.verified) {
      throw new UnauthorizedException(AUTH_MESSAGES.OTP_NOT_VERIFIED);
    }

    const existingUser = await this.userRepo.exist({
      where: { username: dto.username },
    });
    if (existingUser) {
      this.logger.warn(`Username already taken: ${dto.username}`);
      throw new BadRequestException(AUTH_MESSAGES.USERNAME_TAKEN);
    }
    const hashedPassword = await bcrypt.hash(dto.password, 8);

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
    await this.redisService.del(redisKey);

    const session = await this.createUserSessionAndTokens(
      user,
      AUTH_PROVIDERS.LOCAL,
      device,
    );
    this.logger.log(`User profile created: ${user.id}`);
    return {
      message: AUTH_MESSAGES.PROFILE_CREATED,
      data: session,
    };
  }

  /**
   * Authenticates a user with email/phone/username + password and returns auth tokens.
   */
  async login(
    dto: LoginDto,
    device: string,
  ): Promise<ApiResponse<LoginResponse>> {
    let query;
    if (dto.email) {
      query = { email: dto.email, isVerified: true };
    } else if (dto.phone) {
      query = { phone: dto.phone, isVerified: true };
    } else {
      query = { username: dto.username, isVerified: true };
    }
    const user = await this.userRepo.findOne({
      where: query,
      select: ['id', 'password', 'username'],
    });

    if (!user) {
      this.authAttemptRepo
        .save({
          email: dto.email,
          phone: dto.phone,
          attemptType: AttemptType.LOGIN,
          status: AttemptStatus.INVALID_USER,
        })
        .catch(() => {});

      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatch) {
      this.authAttemptRepo
        .save({
          email: dto.email,
          phone: dto.phone,
          attemptType: AttemptType.LOGIN,
          status: AttemptStatus.WRONG_PASSWORD,
        })
        .catch(() => {});
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    const session = await this.createUserSessionAndTokens(
      user,
      AUTH_PROVIDERS.LOCAL,
      device,
    );

    this.logger.log(`User logged in: ${user.id}`);

    return {
      message: AUTH_MESSAGES.LOGIN_SUCCESS,
      data: session,
    };
  }

  /**
   * Logs in or registers a user via Facebook access token;
   * links to an existing account by email if found, otherwise creates a new one.
   */
  async facebookLogin(
    dto: FacebookLoginDto,
    device: string,
  ): Promise<ApiResponse<LoginResponse>> {
    let response: Response;

    try {
      response = await fetch(
        `${process.env.FACEBOOK_GRAPH_URL}?fields=${process.env.FACEBOOK_FIELDS}&access_token=${dto.accessToken}`,
      );
    } catch (e) {
      throw new UnauthorizedException(
        AUTH_MESSAGES.FACEBOOK_VERIFICATION_FAILED,
      );
    }

    if (!response.ok) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_FACEBOOK_TOKEN);
    }

    const profile = await response.json();

    if (!profile?.id) {
      throw new UnauthorizedException(AUTH_MESSAGES.FACEBOOK_USER_NOT_VERIFIED);
    }
    const whereConditions: any[] = [{ facebookId: profile.id }];
    if (profile.email) {
      whereConditions.push({ email: profile.email });
    }
    let user = await this.userRepo.findOne({
      where: whereConditions,
      select: ['id', 'email', 'facebookId', 'provider'],
    });
    if (user && !user.facebookId) {
      await this.userRepo.update(user.id, {
        facebookId: profile.id,
        provider: AUTH_PROVIDERS.FACEBOOK,
      });
      user.facebookId = profile.id;
      user.provider = AUTH_PROVIDERS.FACEBOOK;
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
      device,
    );
    this.logger.log(`Facebook login successful for user: ${user.id}`);
    return {
      message: AUTH_MESSAGES.LOGIN_SUCCESS,
      data: session,
    };
  }

  /**
   * Rotates the refresh token: verifies the existing one against Redis,
   * then issues a new access + refresh token pair.
   */
  async refreshToken(
    payload: RefreshTokenPayload,
  ): Promise<ApiResponse<RefreshTokenResponse>> {
    const session = await this.userSessionRepo.findOne({
      where: {
        sessionId: payload.sessionId,
        isActive: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException(AUTH_MESSAGES.SESSION_EXPIRED);
    }

    const key = `${REDIS_KEYS.REFRESH_TOKEN}:${payload.sessionId}`;

    await this.redisService.del(key);
    const cleanPayload = {
      userId: session.userId,
      username: payload.username,
      sessionId: payload.sessionId,
    };
    const { accessToken, refreshToken } = this.generateJwtTokens(cleanPayload);

    await this.redisService.set(key, refreshToken, JWT_CONFIG.refreshExpiresIn);

    await this.userSessionRepo.update(session.id, {
      expiresAt: new Date(Date.now() + JWT_CONFIG.refreshExpiresIn * 1000),
    });

    this.logger.log(`Refresh token rotated for user: ${session.userId}`);

    return {
      message: AUTH_MESSAGES.REFRESH_TOKEN_SUCCESS,
      data: {
        accessToken,
        refreshToken,
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
    const redisKey = `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}:${tempTokenData.type}`;

    const session = await this.redisService.get(redisKey);

    if (!session?.verified || session.type !== OtpType.FORGOT_PASSWORD) {
      throw new UnauthorizedException(AUTH_MESSAGES.OTP_NOT_VERIFIED);
    }

    const user = await this.userRepo.findOne({
      where: tempTokenData.email
        ? { email: tempTokenData.email }
        : { phone: tempTokenData.phoneNumber },
      select: ['id', 'password'],
    });

    if (!user) {
      this.logger.warn(
        `Password reset requested for non-existing user: ${identifier}`,
      );
      throw new NotFoundException(AUTH_MESSAGES.USER_NOT_FOUND);
    }

    const samePassword = user.password
      ? await bcrypt.compare(dto.newPassword, user.password)
      : false;

    if (samePassword) {
      this.logger.warn(`User tried resetting same password: ${identifier}`);
      throw new BadRequestException(AUTH_MESSAGES.PASSWORD_MUST_BE_DIFFERENT);
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 8);

    await Promise.all([
      this.userRepo.update(user.id, { password: hashedPassword }),
      this.redisService.del(redisKey),
    ]);
    this.logger.log(`Password reset successful for user: ${user.id}`);
    return {
      message: AUTH_MESSAGES.PASSWORD_RESET_SUCCESS,
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
      throw new NotFoundException(AUTH_MESSAGES.OTP_SESSION_EXPIRED);
    }

    if (session.verified) {
      this.logger.warn(
        `Resend OTP attempted after verification for ${identifier}`,
      );
      throw new BadRequestException(AUTH_MESSAGES.OTP_ALREADY_VERIFIED);
    }

    if (session.type !== tempTokenData.type) {
      this.logger.warn(`Resend OTP type mismatch for ${identifier}`);
      throw new BadRequestException(AUTH_MESSAGES.INVALID_OTP_TYPE);
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
      message: AUTH_MESSAGES.OTP_SENT,
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
      select: ['id', 'sessionId'],
    });
    if (!session) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_SESSION);
    }
    await Promise.all([
      this.userSessionRepo.update(session.id, { isActive: false }),
      this.invalidateSessions([session.sessionId]),
    ]);

    this.logger.log(`Session logged out: ${sessionId}`);

    return {
      message: AUTH_MESSAGES.LOGOUT_SUCCESS,
      data: null,
    };
  }

  /**
   * Deactivates all active sessions for a user and clears their refresh tokens from Redis.
   */
  async logoutAll(userId: string): Promise<ApiResponse<null>> {
    const sessions = await this.userSessionRepo.find({
      where: { userId, isActive: true },
      select: ['sessionId'],
    });

    if (!sessions.length) {
      return {
        message: AUTH_MESSAGES.LOGOUT_SUCCESS,
        data: null,
      };
    }

    const sessionIds = sessions.map((s) => s.sessionId);

    await Promise.all([
      this.userSessionRepo.update(
        { userId, isActive: true },
        { isActive: false },
      ),
      this.invalidateSessions(sessionIds),
    ]);
    this.logger.log(`All sessions logged out for user: ${userId}`);

    return { message: AUTH_MESSAGES.LOGOUT_SUCCESS, data: null };
  }

  // Helper functions
  /** Returns email or phone as a single identifier string; throws if neither is provided. */
  private getIdentifier(data: { email?: string; phone?: string }): string {
    const identifier = data.email || data.phone;
    if (!identifier) {
      throw new BadRequestException(AUTH_MESSAGES.EMAIL_OR_PHONE_REQUIRED);
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
      throw new ForbiddenException(AUTH_MESSAGES.TOO_MANY_OTP_REQUESTS);
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
    device: string,
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
      device,
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

  private async invalidateSessions(sessionIds: string[]): Promise<void> {
    if (!sessionIds.length) return;

    await Promise.all(
      sessionIds.map((id) =>
        this.redisService.del(`${REDIS_KEYS.REFRESH_TOKEN}:${id}`),
      ),
    );
  }
}
