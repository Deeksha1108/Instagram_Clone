import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn(),
}));

jest.mock('src/config/common.config', () => ({
  COMMON_CONFIG: {
    nodeEnv: 'test',
    otp: {
      bypassEnabled: false,
      bypassCode: '123456',
      rateLimitMax: 5,
      rateLimitWindow: 300,
      maxVerifyAttempts: 5,
    },
    redis: { host: '', port: 0 },
  },
  NODE_ENV_TYPE: { DEV: 'development', QA: 'qa', UAT: 'uat', PROD: 'production' },
}));

const bcrypt = require('bcrypt');
import { RedisService } from 'src/shared/redis/redis.service';
import { MailerService } from 'src/shared/mailer/mailer.service';
import { User } from '../user/entities/user.entity';
import { AuthAttempt } from '../user/entities/auth_attempts.entity';
import { UserSession } from '../user/entities/user_sessions.entity';
import { OtpType } from 'src/common/enum/enum.common';
import { AUTH_MESSAGES } from './response/auth.response';
import { Gender } from 'src/common/enum/enum.common';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock; createQueryBuilder: jest.Mock };
  let authAttemptRepo: { save: jest.Mock };
  let userSessionRepo: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let redisService: { get: jest.Mock; set: jest.Mock; del: jest.Mock; incr: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let mailerService: { sendOtpEmail: jest.Mock };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };
    authAttemptRepo = { save: jest.fn() };
    userSessionRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    redisService = { get: jest.fn(), set: jest.fn(), del: jest.fn(), incr: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('signed-token') };
    mailerService = { sendOtpEmail: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(AuthAttempt), useValue: authAttemptRepo },
        { provide: getRepositoryToken(UserSession), useValue: userSessionRepo },
        { provide: RedisService, useValue: redisService },
        { provide: JwtService, useValue: jwtService },
        { provide: MailerService, useValue: mailerService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('sendOtp', () => {
    it('should throw when neither email nor phone provided', async () => {
      await expect(
        service.sendOtp({ type: OtpType.SIGNUP } as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.sendOtp({ type: OtpType.SIGNUP } as any),
      ).rejects.toThrow(AUTH_MESSAGES.EMAIL_OR_PHONE_REQUIRED);
    });

    it('should throw USER_ALREADY_EXISTS when signup with existing email', async () => {
      redisService.get.mockResolvedValue(null);
      redisService.set.mockResolvedValue(undefined);
      userRepo.findOne.mockResolvedValue({ id: '1', email: 'existing@gmail.com' });

      await expect(
        service.sendOtp({ email: 'existing@gmail.com', type: OtpType.SIGNUP }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.sendOtp({ email: 'existing@gmail.com', type: OtpType.SIGNUP }),
      ).rejects.toThrow(AUTH_MESSAGES.USER_ALREADY_EXISTS);
      expect(authAttemptRepo.save).toHaveBeenCalled();
    });

    it('should throw USER_NOT_FOUND when forgot-password for non-existing user', async () => {
      redisService.get.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.sendOtp({ email: 'ghost@gmail.com', type: OtpType.FORGOT_PASSWORD }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.sendOtp({ email: 'ghost@gmail.com', type: OtpType.FORGOT_PASSWORD }),
      ).rejects.toThrow(AUTH_MESSAGES.USER_NOT_FOUND);
    });

    it('should throw TOO_MANY_OTP_REQUESTS when rate limit exceeded', async () => {
      redisService.get.mockResolvedValue('5'); // at or above rateLimitMax

      await expect(
        service.sendOtp({ email: 'test@gmail.com', type: OtpType.SIGNUP }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.sendOtp({ email: 'test@gmail.com', type: OtpType.SIGNUP }),
      ).rejects.toThrow(AUTH_MESSAGES.TOO_MANY_OTP_REQUESTS);
    });

    it('should send OTP and return tempToken for valid signup request', async () => {
      redisService.get.mockResolvedValue(null);
      redisService.set.mockResolvedValue(undefined);
      userRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const result = await service.sendOtp({
        email: 'newuser@gmail.com',
        type: OtpType.SIGNUP,
      });

      expect(result.message).toBe(AUTH_MESSAGES.OTP_SENT);
      expect(result.data?.tempToken).toBe('signed-token');
      expect(redisService.set).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    const tempTokenData = { email: 'test@gmail.com', phoneNumber: undefined, type: OtpType.SIGNUP };

    it('should throw OTP_SESSION_EXPIRED when session not in Redis', async () => {
      redisService.get.mockResolvedValue(null);

      await expect(
        service.verifyOtp({ otp: '123456' }, tempTokenData),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.verifyOtp({ otp: '123456' }, tempTokenData),
      ).rejects.toThrow(AUTH_MESSAGES.OTP_SESSION_EXPIRED);
    });

    it('should throw OTP_ALREADY_VERIFIED when session already verified', async () => {
      redisService.get.mockResolvedValue({ verified: true, otp: 'hash', verifyAttempts: 0, type: OtpType.SIGNUP });

      await expect(
        service.verifyOtp({ otp: '123456' }, tempTokenData),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyOtp({ otp: '123456' }, tempTokenData),
      ).rejects.toThrow(AUTH_MESSAGES.OTP_ALREADY_VERIFIED);
    });

    it('should throw TOO_MANY_VERIFY_OTP_ATTEMPTS when verifyAttempts >= max', async () => {
      redisService.get.mockResolvedValue({
        verified: false,
        otp: 'hash',
        verifyAttempts: 5,
        type: OtpType.SIGNUP,
      });

      await expect(
        service.verifyOtp({ otp: '123456' }, tempTokenData),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.verifyOtp({ otp: '123456' }, tempTokenData),
      ).rejects.toThrow(AUTH_MESSAGES.TOO_MANY_VERIFY_OTP_ATTEMPTS);
    });

    it('should throw INVALID_OTP when OTP does not match', async () => {
      redisService.get.mockResolvedValue({
        verified: false,
        otp: 'hashedOtp',
        verifyAttempts: 0,
        type: OtpType.SIGNUP,
      });
      redisService.set.mockResolvedValue(undefined);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.verifyOtp({ otp: '000000' }, tempTokenData),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyOtp({ otp: '000000' }, tempTokenData),
      ).rejects.toThrow(AUTH_MESSAGES.INVALID_OTP);
      expect(redisService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ verifyAttempts: 1 }),
        expect.any(Number),
      );
    });

    it('should return verified true when OTP matches', async () => {
      redisService.get.mockResolvedValue({
        verified: false,
        otp: 'hashedOtp',
        verifyAttempts: 0,
        type: OtpType.SIGNUP,
      });
      redisService.set.mockResolvedValue(undefined);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.verifyOtp({ otp: '123456' }, tempTokenData);

      expect(result.message).toBe(AUTH_MESSAGES.OTP_VERIFIED);
      expect(result.data?.verified).toBe(true);
      expect(redisService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ verified: true }),
        expect.any(Number),
      );
    });
  });

  describe('createProfile', () => {
    const tempTokenData = { email: 'test@gmail.com', phoneNumber: undefined, type: OtpType.SIGNUP };
    const dto = {
      fullName: 'Test User',
      username: 'testuser',
      age: 22,
      gender: Gender.FEMALE,
      password: 'Pass@123',
    };

    it('should throw OTP_SESSION_EXPIRED when session not in Redis', async () => {
      redisService.get.mockResolvedValue(null);

      await expect(
        service.createProfile(dto, tempTokenData, 'web'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.createProfile(dto, tempTokenData, 'web'),
      ).rejects.toThrow(AUTH_MESSAGES.OTP_SESSION_EXPIRED);
    });

    it('should throw INVALID_OTP_TYPE when session type is FORGOT_PASSWORD', async () => {
      redisService.get.mockResolvedValue({
        verified: true,
        type: OtpType.FORGOT_PASSWORD,
      });

      await expect(
        service.createProfile(dto, tempTokenData, 'web'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createProfile(dto, tempTokenData, 'web'),
      ).rejects.toThrow(AUTH_MESSAGES.INVALID_OTP_TYPE);
    });

    it('should throw OTP_NOT_VERIFIED when session verified is false', async () => {
      redisService.get.mockResolvedValue({
        verified: false,
        type: OtpType.SIGNUP,
      });

      await expect(
        service.createProfile(dto, tempTokenData, 'web'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.createProfile(dto, tempTokenData, 'web'),
      ).rejects.toThrow(AUTH_MESSAGES.OTP_NOT_VERIFIED);
    });

    it('should throw USERNAME_TAKEN when username already exists', async () => {
      redisService.get.mockResolvedValue({ verified: true, type: OtpType.SIGNUP });
      userRepo.findOne.mockResolvedValue({ username: 'testuser' });

      await expect(
        service.createProfile(dto, tempTokenData, 'web'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createProfile(dto, tempTokenData, 'web'),
      ).rejects.toThrow(AUTH_MESSAGES.USERNAME_TAKEN);
    });

    it('should create user and return tokens when valid', async () => {
      redisService.get.mockResolvedValue({ verified: true, type: OtpType.SIGNUP });
      redisService.set.mockResolvedValue(undefined);
      redisService.del.mockResolvedValue(undefined);
      userRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue({
        id: 'user-1',
        username: 'testuser',
        email: 'test@gmail.com',
      });
      userRepo.save.mockResolvedValue({});
      userSessionRepo.create.mockReturnValue({});
      userSessionRepo.save.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const result = await service.createProfile(dto, tempTokenData, 'web');

      expect(result.message).toBe(AUTH_MESSAGES.PROFILE_CREATED);
      expect(result.data).toHaveProperty('userId');
      expect(result.data).toHaveProperty('accessToken');
      expect(result.data).toHaveProperty('refreshToken');
      expect(userRepo.save).toHaveBeenCalled();
      expect(redisService.del).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should throw INVALID_CREDENTIALS when user not found', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@gmail.com', password: 'Pass@1' }, 'web'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login({ email: 'ghost@gmail.com', password: 'Pass@1' }, 'web'),
      ).rejects.toThrow(AUTH_MESSAGES.INVALID_CREDENTIALS);
      expect(authAttemptRepo.save).toHaveBeenCalled();
    });

    it('should throw INVALID_CREDENTIALS when user not verified', async () => {
      mockQueryBuilder.getOne.mockResolvedValue({
        id: '1',
        email: 'test@gmail.com',
        password: 'hashed',
        isVerified: false,
      });

      await expect(
        service.login({ email: 'test@gmail.com', password: 'Pass@1' }, 'web'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login({ email: 'test@gmail.com', password: 'Pass@1' }, 'web'),
      ).rejects.toThrow(AUTH_MESSAGES.INVALID_CREDENTIALS);
    });

    it('should throw INVALID_CREDENTIALS when password wrong', async () => {
      mockQueryBuilder.getOne.mockResolvedValue({
        id: '1',
        email: 'test@gmail.com',
        password: 'hashed',
        isVerified: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@gmail.com', password: 'WrongPass' }, 'web'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login({ email: 'test@gmail.com', password: 'WrongPass' }, 'web'),
      ).rejects.toThrow(AUTH_MESSAGES.INVALID_CREDENTIALS);
      expect(authAttemptRepo.save).toHaveBeenCalled();
    });

    it('should return tokens when credentials valid', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@gmail.com',
        password: 'hashed',
        isVerified: true,
      };
      mockQueryBuilder.getOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      userSessionRepo.create.mockReturnValue({});
      userSessionRepo.save.mockResolvedValue({});
      redisService.set.mockResolvedValue(undefined);

      const result = await service.login(
        { email: 'test@gmail.com', password: 'Pass@1' },
        'web',
      );

      expect(result.message).toBe(AUTH_MESSAGES.LOGIN_SUCCESS);
      expect(result.data).toHaveProperty('accessToken');
      expect(result.data).toHaveProperty('refreshToken');
      expect(result.data?.userId).toBe('user-1');
    });
  });

  describe('resetPassword', () => {
    const tempTokenData = { email: 'user@gmail.com', phoneNumber: undefined, type: OtpType.FORGOT_PASSWORD };

    it('should throw OTP_NOT_VERIFIED when session not verified or wrong type', async () => {
      redisService.get.mockResolvedValue({
        verified: false,
        type: OtpType.FORGOT_PASSWORD,
      });

      await expect(
        service.resetPassword({ newPassword: 'NewPass@1' }, tempTokenData),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.resetPassword({ newPassword: 'NewPass@1' }, tempTokenData),
      ).rejects.toThrow(AUTH_MESSAGES.OTP_NOT_VERIFIED);
    });

    it('should throw USER_NOT_FOUND when user does not exist', async () => {
      redisService.get.mockResolvedValue({
        verified: true,
        type: OtpType.FORGOT_PASSWORD,
      });
      mockQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.resetPassword({ newPassword: 'NewPass@1' }, tempTokenData),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.resetPassword({ newPassword: 'NewPass@1' }, tempTokenData),
      ).rejects.toThrow(AUTH_MESSAGES.USER_NOT_FOUND);
    });

    it('should throw PASSWORD_MUST_BE_DIFFERENT when new password same as current', async () => {
      redisService.get.mockResolvedValue({
        verified: true,
        type: OtpType.FORGOT_PASSWORD,
      });
      mockQueryBuilder.getOne.mockResolvedValue({
        id: '1',
        password: 'hashedOld',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.resetPassword({ newPassword: 'OldPass@1' }, tempTokenData),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetPassword({ newPassword: 'OldPass@1' }, tempTokenData),
      ).rejects.toThrow(AUTH_MESSAGES.PASSWORD_MUST_BE_DIFFERENT);
    });

    it('should reset password and return success', async () => {
      redisService.get.mockResolvedValue({
        verified: true,
        type: OtpType.FORGOT_PASSWORD,
      });
      redisService.del.mockResolvedValue(undefined);
      mockQueryBuilder.getOne.mockResolvedValue({
        id: 'user-1',
        password: 'hashedOld',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashed');
      userRepo.update.mockResolvedValue({});

      const result = await service.resetPassword(
        { newPassword: 'NewPass@1' },
        tempTokenData,
      );

      expect(result.message).toBe(AUTH_MESSAGES.PASSWORD_RESET_SUCCESS);
      expect(result.data).toBeNull();
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        password: 'newHashed',
      });
      expect(redisService.del).toHaveBeenCalled();
    });
  });

  describe('resendOtp', () => {
    const tempTokenData = { email: 'test@gmail.com', phoneNumber: undefined, type: OtpType.SIGNUP };

    it('should throw OTP_SESSION_EXPIRED when no session in Redis', async () => {
      redisService.get.mockResolvedValue(null);

      await expect(service.resendOtp(tempTokenData)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.resendOtp(tempTokenData)).rejects.toThrow(
        AUTH_MESSAGES.OTP_SESSION_EXPIRED,
      );
    });

    it('should throw OTP_ALREADY_VERIFIED when session already verified', async () => {
      redisService.get.mockResolvedValue({
        verified: true,
        type: OtpType.SIGNUP,
        otp: 'hash',
        verifyAttempts: 0,
      });

      await expect(service.resendOtp(tempTokenData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resendOtp(tempTokenData)).rejects.toThrow(
        AUTH_MESSAGES.OTP_ALREADY_VERIFIED,
      );
    });

    it('should throw INVALID_OTP_TYPE when session type mismatch', async () => {
      redisService.get.mockResolvedValue({
        verified: false,
        type: OtpType.FORGOT_PASSWORD,
        otp: 'hash',
        verifyAttempts: 0,
      });

      await expect(service.resendOtp(tempTokenData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resendOtp(tempTokenData)).rejects.toThrow(
        AUTH_MESSAGES.INVALID_OTP_TYPE,
      );
    });

    it('should resend OTP and return new tempToken', async () => {
      redisService.get.mockResolvedValue({
        verified: false,
        type: OtpType.SIGNUP,
        otp: 'hash',
        verifyAttempts: 0,
      });
      redisService.set.mockResolvedValue(undefined);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashed');

      const result = await service.resendOtp(tempTokenData);

      expect(result.message).toBe(AUTH_MESSAGES.OTP_SENT);
      expect(result.data?.tempToken).toBe('signed-token');
      expect(redisService.set).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should throw INVALID_REFRESH_TOKEN when session not found', async () => {
      userSessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.refreshToken({ userId: 'u1', sessionId: 's1' , username: 'testuser'}),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshToken({ userId: 'u1', sessionId: 's1' , username: 'testuser'}),
      ).rejects.toThrow(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    });

    it('should throw INVALID_REFRESH_TOKEN when no token in Redis', async () => {
      userSessionRepo.findOne.mockResolvedValue({
        sessionId: 's1',
        expiresAt: new Date(Date.now() + 86400000),
      });
      redisService.get.mockResolvedValue(null);

      await expect(
        service.refreshToken({ userId: 'u1', sessionId: 's1' , username: 'testuser'}),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshToken({ userId: 'u1', sessionId: 's1' , username: 'testuser'}),
      ).rejects.toThrow(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    });

    it('should return new tokens when session valid and token in Redis', async () => {
      userSessionRepo.findOne.mockResolvedValue({
        sessionId: 's1',
        expiresAt: new Date(Date.now() + 86400000),
      });
      redisService.get.mockResolvedValue('old-refresh-token');
      redisService.del.mockResolvedValue(undefined);
      redisService.set.mockResolvedValue(undefined);
      userSessionRepo.update.mockResolvedValue({});

      const result = await service.refreshToken({
        userId: 'u1',
        sessionId: 's1',
        username: 'testuser',
      });

      expect(result.message).toBe(AUTH_MESSAGES.REFRESH_TOKEN_SUCCESS);
      expect(result.data).toHaveProperty('accessToken');
      expect(result.data).toHaveProperty('refreshToken');
      expect(redisService.del).toHaveBeenCalled();
      expect(redisService.set).toHaveBeenCalled();
      expect(userSessionRepo.update).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should throw INVALID_SESSION when session not found or inactive', async () => {
      userSessionRepo.findOne.mockResolvedValue(null);

      await expect(service.logout('session-1')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.logout('session-1')).rejects.toThrow(
        AUTH_MESSAGES.INVALID_SESSION,
      );
    });

    it('should deactivate session and delete refresh token from Redis', async () => {
      userSessionRepo.findOne.mockResolvedValue({
        sessionId: 'session-1',
        isActive: true,
      });
      userSessionRepo.update.mockResolvedValue({});
      redisService.del.mockResolvedValue(undefined);

      const result = await service.logout('session-1');

      expect(result.message).toBe(AUTH_MESSAGES.LOGOUT_SUCCESS);
      expect(result.data).toBeNull();
      expect(userSessionRepo.update).toHaveBeenCalledWith(
        { sessionId: 'session-1' },
        { isActive: false },
      );
      expect(redisService.del).toHaveBeenCalledWith(
        expect.stringContaining('session-1'),
      );
    });
  });

  describe('logoutAll', () => {
    it('should deactivate all sessions and clear Redis tokens', async () => {
      userSessionRepo.find.mockResolvedValue([
        { sessionId: 's1' },
        { sessionId: 's2' },
      ]);
      redisService.del.mockResolvedValue(undefined);
      userSessionRepo.update.mockResolvedValue({});

      const result = await service.logoutAll('user-1');

      expect(result.message).toBe(AUTH_MESSAGES.LOGOUT_SUCCESS);
      expect(result.data).toBeNull();
      expect(redisService.del).toHaveBeenCalledTimes(2);
      expect(userSessionRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', isActive: true },
        { isActive: false },
      );
    });

    it('should succeed when user has no active sessions', async () => {
      userSessionRepo.find.mockResolvedValue([]);
      userSessionRepo.update.mockResolvedValue({});

      const result = await service.logoutAll('user-1');

      expect(result.message).toBe(AUTH_MESSAGES.LOGOUT_SUCCESS);
      expect(redisService.del).not.toHaveBeenCalled();
      expect(userSessionRepo.update).toHaveBeenCalled();
    });
  });
});
