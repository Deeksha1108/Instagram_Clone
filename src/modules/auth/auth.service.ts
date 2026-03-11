import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RedisService } from 'src/shared/redis/redis.service';
import { User } from '../user/entities/user.entity';
import { OtpType, SendOtpDto } from './dto/send-otp.dto';
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
  SendOtpResponse,
  VerifyOtpResponse,
} from './interfaces/auth-response.interface';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly redisService: RedisService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async sendOtp(dto: SendOtpDto): Promise<ApiResponse<SendOtpResponse>> {
    const identifier = this.getIdentifier(dto);
    this.logger.log(`OTP request received for ${identifier} [${dto.type}]`);

    if (dto.type === OtpType.SIGNUP) {
      const existingUser = await this.userRepo.findOne({
        where: dto.email ? { email: dto.email } : { phone: dto.phone },
      });

      if (existingUser) {
        this.logger.warn(`Signup attempt with existing user: ${identifier}`);
        throw new BadRequestException(MESSAGES.USER_ALREADY_EXISTS);
      }
    }

    if (dto.type === OtpType.FORGOT_PASSWORD) {
      const user = await this.userRepo.findOne({
        where: dto.email ? { email: dto.email } : { phone: dto.phone },
      });

      if (!user) {
        this.logger.warn(
          `Forgot password requested for non-existing user: ${identifier}`,
        );
        throw new NotFoundException(MESSAGES.USER_NOT_FOUND);
      }
    }

    const otp = '123456';
    const hashedOtp = await bcrypt.hash(otp, 10);

    await this.redisService.set(
      `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`,
      { otp: hashedOtp, verified: false, type: dto.type },
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

    const isMatch = await bcrypt.compare(dto.otp, session.otp);
    if (!isMatch) {
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

    if (!session?.verified)
      throw new UnauthorizedException(MESSAGES.OTP_NOT_VERIFIED);

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

  async login(dto: LoginDto): Promise<ApiResponse<LoginResponse>> {
    const user = await this.userRepo.findOne({
      where: dto.email
        ? { email: dto.email }
        : dto.phone
          ? { phone: dto.phone }
          : { username: dto.username },
    });

    if (!user || !user.isVerified) {
      throw new UnauthorizedException(MESSAGES.INVALID_CREDENTIALS);
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatch) {
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

    // await this.userRepo.update(user.id, {
    //   refreshToken: hashedRefreshToken,
    // });
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

  private getIdentifier(data: { email?: string; phone?: string }): string {
    const identifier = data.email || data.phone;
    if (!identifier) {
      throw new BadRequestException(MESSAGES.EMAIL_OR_PHONE_REQUIRED);
    }
    return identifier;
  }
}
