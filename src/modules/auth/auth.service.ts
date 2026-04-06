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
  AppleJwtPayload,
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
  BCRYPT_CONFIG,
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
import { GoogleLoginDto } from './dto/google.dto';
import { AppleLoginDto } from './dto/apple.dto';
import { SetUsernameDto } from './dto/setUsername.dto';
import { OAuth2Client } from 'google-auth-library';
import { verifyAppleToken } from 'src/common/utils/apple-jwt.util';
import { CreatePasswordDto } from './dto/create-password.dto';
import { CreateUsernameDto } from './dto/create-username.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient = new OAuth2Client(COMMON_CONFIG.GOOGLE.clientId);

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
  async sendOtp(dto: SendOtpDto): Promise<SendOtpResponse> {
    const identifier = this.getIdentifier({ email: dto.email, phone: dto.phone });
    const rateLimitKey = `otp_rate_limit:${identifier}:${dto.type}`;

    await this.checkOtpRateLimit(rateLimitKey);

    const user = await this.userRepo.exist({
      where: dto.email ? { email: dto.email } : { phone: dto.phone },
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

    await this.generateAndStoreOtp(identifier, dto.type, dto.email, dto.phone);

    const token = this.jwtService.sign(
      {
        email: dto.email,
        phoneNumber: dto.phone,
        type: dto.type,
      },
      { expiresIn: AUTH_CONSTANTS.TEMP_TOKEN_EXPIRES_IN },
    );

    return { tempToken: token, maskedContact: this.maskContact(dto.email, dto.phone) };
  }

  /**
   * Verifies OTP for signup/forgot-password flow.
   * - Prevents brute-force via attempt tracking in Redis
   * - Validates OTP (or bypass in dev/qa)
   * - Marks session as verified and extends TTL for onboarding
   */
  async verifyOtp(
    dto: VerifyOtpDto,
    tempTokenData: TempTokenData,
  ): Promise<VerifyOtpResponse> {
    const identifier = this.getIdentifier({
      email: tempTokenData.email,
      phone: tempTokenData.phoneNumber,
    });
    const redisKey = `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}:${tempTokenData.type}`;
    const attemptsKey = `${redisKey}:attempts`;
    const session = await this.redisService.get(redisKey);

    if (!session) {
      this.logger.warn(`OTP session expired for ${identifier}`);
      throw new NotFoundException(AUTH_MESSAGES.OTP_SESSION_EXPIRED);
    }

    if (session.verified) {
      this.logger.warn(`OTP already verified attempt for ${identifier}`);
      throw new BadRequestException(AUTH_MESSAGES.OTP_ALREADY_VERIFIED);
    }
    const attempts = Number(await this.redisService.get(attemptsKey));
    if (attempts >= COMMON_CONFIG.OTP.maxVerifyAttempts) {
      this.logger.warn(`OTP verify attempts exceeded for ${identifier}`);
      throw new ForbiddenException(AUTH_MESSAGES.TOO_MANY_VERIFY_OTP_ATTEMPTS);
    }

    const bypassAllowed = this.isOtpBypassAllowed();

    let isMatch = false;

    if (bypassAllowed && dto.otp === COMMON_CONFIG.OTP.bypassCode) {
      isMatch = true;
      isMatch = true;
    } else if (dto.otp.length !== OTP_CONFIG.LENGTH) {
      isMatch = false;
    } else {
      isMatch = await bcrypt.compare(dto.otp, session.otp);
    }
    if (!isMatch) {
      await this.redisService.incrWithExpire(
        attemptsKey,
        AUTH_CONSTANTS.OTP_TTL_SECONDS,
      );
      this.logger.warn(`Invalid OTP attempt for ${identifier}`);
      throw new BadRequestException(AUTH_MESSAGES.INVALID_OTP);
    }

    await this.redisService.set(
      redisKey,
      {
        ...session,
        verified: true,
      },
      AUTH_CONSTANTS.ONBOARDING_SESSION_TTL_SECONDS,
    );
    this.logger.log(`OTP verified successfully for ${identifier}`);
    return {
      verified: true,
    };
  }
  /**
   * Stores hashed password in Redis session after OTP verification (signup flow).
   */
  async createPassword(
    dto: CreatePasswordDto,
    tempTokenData: TempTokenData,
  ): Promise<void> {
    const identifier = this.getIdentifier({
      email: tempTokenData.email,
      phone: tempTokenData.phoneNumber,
    });

    if (tempTokenData.type === OtpType.FORGOT_PASSWORD) {
      throw new BadRequestException(AUTH_MESSAGES.INVALID_OTP_TYPE);
    }

    const redisKey = `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}:${tempTokenData.type}`;

    const session = await this.getValidatedSession(redisKey, {
      requireVerified: true,
    });
    if (session.password) {
      throw new BadRequestException(AUTH_MESSAGES.PASSWORD_ALREADY_SET);
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      BCRYPT_CONFIG.PASSWORD_SALT_ROUNDS,
    );

    session.password = hashedPassword;

    await this.redisService.set(
      redisKey,
      session,
      AUTH_CONSTANTS.ONBOARDING_SESSION_TTL_SECONDS,
    );

    this.logger.log(`Password created for ${identifier}`);
  }

  /* Validates uniqueness and stores username in Redis Session. */
  async createUsername(
    dto: CreateUsernameDto,
    tempTokenData: TempTokenData,
  ): Promise<void> {
    const identifier = this.getIdentifier({
      email: tempTokenData.email,
      phone: tempTokenData.phoneNumber,
    });

    const redisKey = `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}:${tempTokenData.type}`;

    const session = await this.getValidatedSession(redisKey, {
      requireVerified: true,
      requirePassword: true,
    });

    if (session.username) {
      throw new BadRequestException(AUTH_MESSAGES.USERNAME_ALREADY_SET);
    }

    const exists = await this.userRepo.exist({
      where: { username: dto.username },
    });

    if (exists) {
      throw new BadRequestException(AUTH_MESSAGES.USERNAME_TAKEN);
    }

    session.username = dto.username;

    await this.redisService.set(
      redisKey,
      session,
      AUTH_CONSTANTS.ONBOARDING_SESSION_TTL_SECONDS,
    );
  }

  /**
   * Creates a new user account after OTP verification; saves the user in DB and returns auth tokens.
   */
  async createProfile(
    dto: CreateProfileDto,
    tempTokenData: TempTokenData,
    device: string,
  ): Promise<CreateProfileResponse> {
    if (tempTokenData.type === OtpType.FORGOT_PASSWORD) {
      throw new BadRequestException(AUTH_MESSAGES.INVALID_OTP_TYPE);
    }
    const identifier = this.getIdentifier({
      email: tempTokenData.email,
      phone: tempTokenData.phoneNumber,
    });
    const redisKey = `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}:${tempTokenData.type}`;

    const session = await this.getValidatedSession(redisKey, {
      requireVerified: true,
      requirePassword: true,
      requireUsername: true,
    });

    const user = this.userRepo.create({
      ...(tempTokenData.email && { email: tempTokenData.email }),
      ...(tempTokenData.phoneNumber && { phone: tempTokenData.phoneNumber }),
      fullName: dto.fullName,
      bio: dto.bio,
      website: dto.website,
      pronouns: dto.pronouns,
      profilePicture: dto.profilePicture,
      username: session.username,
      password: session.password,
      isVerified: true,
      accountType: dto.accountType,
      interests: dto.interests ?? [],
    });

    await this.userRepo.save(user);

    // cleanup
    await this.redisService.del(redisKey);

    // session tokens
    const authSession = await this.createUserSessionAndTokens(
      user,
      AUTH_PROVIDERS.LOCAL,
      device,
    );
    this.logger.log(`User onboarding completed: ${user.id}`);
    return authSession;
  }

  /**
   * Sets a unique username for a user after social login.
   * Ensures username uniqueness before updating the record.
   */
  async setUsername(userId: string, dto: SetUsernameDto) {
    const existing = await this.userRepo.findOne({
      where: { username: dto.username },
    });

    if (existing) {
      throw new BadRequestException(AUTH_MESSAGES.USERNAME_TAKEN);
    }

    await this.userRepo.update(userId, {
      username: dto.username,
    });

    return { message: 'Username set successfully' };
  }

  /**
   * Validates credentials and returns session tokens.
   * Supports login via email or username.
   */
  async login(dto: LoginDto, device: string): Promise<LoginResponse> {
    const identifier = dto.email || dto.username;
    const query = dto.email ? { email: dto.email, isVerified: true } : { username: dto.username, isVerified: true };
    const user = await this.userRepo.findOne({
      where: query,
      select: ['id', 'password', 'username'],
    });

    if (!user) {
      this.authAttemptRepo
        .save({
          identifier,
          attemptType: AttemptType.LOGIN,
          status: AttemptStatus.INVALID_USER,
        })
        .catch(() => {});
      this.logger.warn(`Invalid login attempt (user not found): ${identifier}`);

      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }
    if (!user.password) {
      throw new UnauthorizedException(AUTH_MESSAGES.USE_SOCIAL_LOGIN);
    }
    const passwordMatch = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatch) {
      this.authAttemptRepo
        .save({
          identifier,
          attemptType: AttemptType.LOGIN,
          status: AttemptStatus.WRONG_PASSWORD,
        })
        .catch(() => {});
      this.logger.warn(`Invalid login attempt (wrong password): ${identifier}`);
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    const session = await this.createUserSessionAndTokens(
      user,
      AUTH_PROVIDERS.LOCAL,
      device,
    );

    this.logger.log(`User logged in successfully: ${user.id}`);

    return session;
  }

  /**
   * Handles Facebook OAuth login/signup and links existing accounts if needed.
   */
  async facebookLogin(
    dto: FacebookLoginDto,
    device: string,
  ): Promise<LoginResponse> {
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
    const whereConditions: any[] = [
      {
        provider: AUTH_PROVIDERS.FACEBOOK,
        providerId: profile.id,
      },
    ];
    if (profile.email) {
      whereConditions.push({ email: profile.email });
    }
    let user = await this.userRepo.findOne({
      where: whereConditions,
      select: ['id', 'email', 'providerId', 'provider'],
    });
    if (user && !user.providerId) {
      await this.userRepo.update(user.id, {
        providerId: profile.id,
        provider: AUTH_PROVIDERS.FACEBOOK,
      });
      user.providerId = profile.id;
      user.provider = AUTH_PROVIDERS.FACEBOOK;
    }
    if (!user) {
      user = this.userRepo.create({
        email: profile.email,
        fullName: profile.name,
        isVerified: true,
        providerId: profile.id,
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
    return session;
  }

  /**
   * Handles Google OAuth login/signup with token verification.
   */
  async googleLogin(
    dto: GoogleLoginDto,
    device: string,
  ): Promise<LoginResponse> {
    let ticket;

    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (error) {
      this.logger.error('Google token verification failed', error);
      throw new UnauthorizedException(AUTH_MESSAGES.GOOGLE_VERIFICATION_FAILED);
    }
    const payload = ticket.getPayload();

    if (!payload) {
      throw new UnauthorizedException(AUTH_MESSAGES.GOOGLE_USER_NOT_VERIFIED);
    }
    // Required validation
    if (!payload?.sub) {
      throw new UnauthorizedException(AUTH_MESSAGES.GOOGLE_USER_NOT_VERIFIED);
    }

    if (payload.email && payload.email_verified !== true) {
      throw new UnauthorizedException(AUTH_MESSAGES.GOOGLE_EMAIL_NOT_VERIFIED);
    }

    // Find user
    const whereConditions: any[] = [
      {
        provider: AUTH_PROVIDERS.GOOGLE,
        providerId: payload.sub,
      },
    ];

    if (payload.email) {
      whereConditions.push({ email: payload.email });
    }

    let user = await this.userRepo.findOne({
      where: whereConditions,
      select: ['id', 'email', 'providerId', 'provider', 'username'],
    });

    // Link existing user (email-based account)
    if (user && !user.providerId) {
      await this.userRepo.update(user.id, {
        providerId: payload.sub,
        provider: AUTH_PROVIDERS.GOOGLE,
      });

      user.providerId = payload.sub;
      user.provider = AUTH_PROVIDERS.GOOGLE;
    }

    // Create new user
    if (!user) {
      user = this.userRepo.create({
        email: payload.email,
        fullName: payload.name,
        isVerified: true,
        providerId: payload.sub,
        provider: AUTH_PROVIDERS.GOOGLE,
        profilePicture: payload.picture,
      });

      await this.userRepo.save(user);
    }

    // Create session + tokens
    const session = await this.createUserSessionAndTokens(
      user,
      AUTH_PROVIDERS.GOOGLE,
      device,
    );

    this.logger.log(`Google login successful for user: ${user.id}`);

    return {
      ...session,
      needsUsername: !user.username,
    };
  }

  /**
   * Handles Apple OAuth login/signup using identity token.
   */
  async appleLogin(dto: AppleLoginDto, device: string): Promise<LoginResponse> {
    let payload: AppleJwtPayload;

    try {
      payload = await verifyAppleToken(dto.identityToken);
    } catch (err) {
      this.logger.error('Apple token verification failed', err);
      throw new UnauthorizedException(AUTH_MESSAGES.APPLE_VERIFICATION_FAILED);
    }

    if (!payload?.sub) {
      throw new UnauthorizedException(AUTH_MESSAGES.APPLE_USER_NOT_VERIFIED);
    }

    const whereConditions: any[] = [
      {
        provider: AUTH_PROVIDERS.APPLE,
        providerId: payload.sub,
      },
    ];

    if (payload.email) {
      whereConditions.push({ email: payload.email });
    }

    let user = await this.userRepo.findOne({
      where: whereConditions,
      select: ['id', 'email', 'providerId', 'provider', 'username'],
    });

    // link existing
    if (user && !user.providerId) {
      await this.userRepo.update(user.id, {
        providerId: payload.sub,
        provider: AUTH_PROVIDERS.APPLE,
      });

      user.providerId = payload.sub;
      user.provider = AUTH_PROVIDERS.APPLE;
    }

    // create new
    if (!user) {
      user = this.userRepo.create({
        email: payload.email,
        // Apple sends fullName only on the very first sign-in via the client DTO
        fullName: dto.fullName,
        isVerified: true,
        providerId: payload.sub,
        provider: AUTH_PROVIDERS.APPLE,
      });

      await this.userRepo.save(user);
    }

    const session = await this.createUserSessionAndTokens(
      user,
      AUTH_PROVIDERS.APPLE,
      device,
    );

    return {
      ...session,
      needsUsername: !user.username,
    };
  }

  /**
   * Rotates the refresh token: verifies the existing one against Redis,
   * then issues a new access + refresh token pair.
   */
  async refreshToken(
    payload: RefreshTokenPayload,
  ): Promise<RefreshTokenResponse> {
    const session = await this.userSessionRepo.findOne({
      where: {
        sessionId: payload.sessionId,
        isActive: true,
      },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
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
      accessToken,
      refreshToken,
    };
  }

  /**
   * Updates user password after OTP verification (forgot-password flow).
   */
  async resetPassword(
    dto: ResetPasswordDto,
    tempTokenData: TempTokenData,
  ): Promise<void> {
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

    const hashedPassword = await bcrypt.hash(dto.newPassword, BCRYPT_CONFIG.PASSWORD_SALT_ROUNDS);

    await Promise.all([
      this.userRepo.update(user.id, { password: hashedPassword }),
      this.redisService.del(redisKey),
    ]);
    this.logger.log(`Password reset successful for user: ${user.id}`);
    return;
  }

  /**
   * Regenerates OTP if session is valid and not yet verfied.
   */
  async resendOtp(tempTokenData: TempTokenData): Promise<SendOtpResponse> {
    const identifier = this.getIdentifier({
      email: tempTokenData.email,
      phone: tempTokenData.phoneNumber,
    });
    const type = tempTokenData.type as OtpType;
    const redisKey = `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}:${type}`;
    await this.checkOtpRateLimit(redisKey);
    const session = await this.redisService.get(redisKey);

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

    if (session.type !== type) {
      this.logger.warn(`Resend OTP type mismatch for ${identifier}`);
      throw new BadRequestException(AUTH_MESSAGES.INVALID_OTP_TYPE);
    }

    await this.generateAndStoreOtp(
      identifier,
      type,
      tempTokenData.email,
      tempTokenData.phoneNumber,
    );
    const token = this.jwtService.sign(
      {
        email: tempTokenData.email,
        phoneNumber: tempTokenData.phoneNumber,
        type,
      },
      { expiresIn: AUTH_CONSTANTS.TEMP_TOKEN_EXPIRES_IN },
    );

    this.logger.log(`OTP resent successfully for ${identifier}`);

    return { tempToken: token, maskedContact: this.maskContact( tempTokenData.email, tempTokenData.phoneNumber ) };
  }

  /**
   * Invalidates a single session and removes its refresh token.
   */
  async logout(sessionId: string): Promise<void> {
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

    return;
  }

  /**
   * Logged out user from all devices by invalidating all sessions.
   */
  async logoutAll(userId: string): Promise<void> {
    const sessions = await this.userSessionRepo.find({
      where: { userId, isActive: true },
      select: ['sessionId'],
    });

    if (!sessions.length) {
      return;
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

    return;
  }

  // Helper functions
  /** Returns unique identifier (email or phone) */
  private getIdentifier(data: { email?: string; phone?: string }): string {
    const identifier = data.email || data.phone;
    if (!identifier) {
      throw new BadRequestException(AUTH_MESSAGES.EMAIL_OR_PHONE_REQUIRED);
    }
    return identifier;
  }

  /** Generates numeric OTP of configured length */
  private generateRandomOtp(): string {
    const length = OTP_CONFIG.LENGTH;
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;

    return Math.floor(min + Math.random() * (max - min)).toString();
  }

  /** Enforces OTP request rate limiting using Redis. */
  private async checkOtpRateLimit(identifier: string): Promise<void> {
    const key = `otp_rate_limit:${identifier}`;

    const attempts = await this.redisService.get(key);

    if (attempts && Number(attempts) >= COMMON_CONFIG.OTP.rateLimitMax) {
      this.logger.warn(`OTP rate limit exceeded for ${identifier}`);
      throw new ForbiddenException(AUTH_MESSAGES.TOO_MANY_OTP_REQUESTS);
    }

    if (!attempts) {
      await this.redisService.set(key, 1, COMMON_CONFIG.OTP.rateLimitWindow);
    } else {
      await this.redisService.incr(key);
    }
  }

  /** Checks if OTP bypass is enabled (dev/qa only) */
  private isOtpBypassAllowed() {
    return (
      COMMON_CONFIG.OTP.bypassEnabled &&
      [NODE_ENV_TYPE.DEV, NODE_ENV_TYPE.QA].includes(
        COMMON_CONFIG.nodeEnv as string,
      )
    );
  }

  /** Generate access + refresh JWT tokens. */
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
   * Creates session, stores refresh token, returns auth tokens
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
  /**
   * Masks contact info for secure display (OTP screen).
   * Email: a***@gmail.com / tes***@gmail.com
   * Phone (E.164): +919876543210 → +91****3210
   */
  private maskContact(email?: string, phone?: string): string {
    if (email) {
      const [local = '', domain = ''] = email.split('@');
      const visibleLength = Math.min(3, local.length);
      const visiblePart = local.slice(0, visibleLength);
      return `${visiblePart}***@${domain}`;
    }
    if (phone) {
      const normalized = phone.trim();
      const match = normalized.match(/^(\+\d{1,3})(\d{4,})$/);
      if (!match) return '';
      const [, countryCode, number] = match;
      return `${countryCode}****${number.slice(-4)}`;
    }
    return '';
  }

  /** Deletes refresh tokens for given session IDs */
  private async invalidateSessions(sessionIds: string[]): Promise<void> {
    if (!sessionIds.length) return;

    await Promise.all(
      sessionIds.map((id) =>
        this.redisService.del(`${REDIS_KEYS.REFRESH_TOKEN}:${id}`),
      ),
    );
  }

  /* TODO: Remove this function in future, it will not be needed. */
  private calculateAge(dob: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();

    if (
      today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
    ) {
      age--;
    }
    return age;
  }

  /**
   * Generates OTP, hashes it, and stores in Redis.
   * Sends email/SMS if not bypassed.
   */
  private async generateAndStoreOtp(
    identifier: string,
    type: OtpType,
    email?: string,
    phone?: string,
  ) {
    const bypassAllowed = this.isOtpBypassAllowed();

    const otp = bypassAllowed && COMMON_CONFIG.OTP.bypassCode
        ? COMMON_CONFIG.OTP.bypassCode
        : this.generateRandomOtp();

    const hashedOtp = await bcrypt.hash(otp, BCRYPT_CONFIG.OTP_SALT_ROUNDS);

    const redisKey = `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}:${type}`;

    await this.redisService.set(
      redisKey,
      {
        otp: hashedOtp,
        verified: false,
        type,
        verifyAttempts: 0,
      },
      AUTH_CONSTANTS.OTP_TTL_SECONDS,
    );

    if (email && !bypassAllowed) {
      this.mailerService.sendOtpEmail(email, otp).catch(() => {});
    }

    if (phone && !bypassAllowed) {
      // integrate SMS provider here
    }
  }

  private async getValidatedSession(
    redisKey: string,
    options?: {
      requireVerified?: boolean;
      requirePassword?: boolean;
      requireUsername?: boolean;
    },
  ) {
    const session = await this.redisService.get(redisKey);

    if (!session) {
      throw new NotFoundException(AUTH_MESSAGES.OTP_SESSION_EXPIRED);
    }
    if (options?.requireVerified && !session.verified) {
      throw new UnauthorizedException(AUTH_MESSAGES.OTP_NOT_VERIFIED);
    }
    if (options?.requirePassword && !session.password) {
      throw new BadRequestException(AUTH_MESSAGES.PASSWORD_NOT_SET);
    }
    if (options?.requireUsername && !session.username) {
      throw new BadRequestException(AUTH_MESSAGES.USERNAME_NOT_SET);
    }
    return session;
  }
}
