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
  SendOtpResponse,
  VerifyOtpResponse,
} from './interfaces/auth-response.interface';
import { LoginDto } from './dto/login.dto';

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
    const identifier = dto.email || dto.phone;
    if (!identifier)
      throw new BadRequestException(MESSAGES.EMAIL_OR_PHONE_REQUIRED);

    const otp = '123456';
    const hashedOtp = await bcrypt.hash(otp, 10);

    await this.redisService.set(
      `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`,
      { otp: hashedOtp, verified: false },
      AUTH_CONSTANTS.OTP_TTL_SECONDS,
    );

    const token = this.jwtService.sign(
      {
        email: dto.email,
        phoneNumber: dto.phone,
        type: 'SIGNUP',
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
    const identifier = tempTokenData.email || tempTokenData.phoneNumber;
    const session = await this.redisService.get(
      `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`,
    );

    if (!session) throw new NotFoundException(MESSAGES.OTP_SESSION_EXPIRED);
    const isMatch = await bcrypt.compare(dto.otp, session.otp);
    if (!isMatch) throw new BadRequestException(MESSAGES.INVALID_OTP);

    await this.redisService.set(
      `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`,
      { ...session, verified: true },
      AUTH_CONSTANTS.OTP_TTL_SECONDS,
    );

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
    const identifier = tempTokenData.email || tempTokenData.phoneNumber;
    const session = await this.redisService.get(
      `${AUTH_CONSTANTS.OTP_REDIS_PREFIX}${identifier}`,
    );

    if (!session?.verified)
      throw new UnauthorizedException(MESSAGES.OTP_NOT_VERIFIED);

    const existingUser = await this.userRepo.findOne({
      where: { username: dto.username },
    });
    if (existingUser) throw new BadRequestException(MESSAGES.USERNAME_TAKEN);

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
      expiresIn: JWT_CONFIG.refreshExpiresIn, //
    });

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

    return {
      message: MESSAGES.LOGIN_SUCCESS,
      data: {
        userId: user.id,
        accessToken,
        refreshToken,
      },
    };
  }
}
