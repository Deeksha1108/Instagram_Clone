import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBasicAuth,
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { TempTokenGuard } from 'src/common/guards/temp-token.guard';
import type { RequestWithTempToken } from 'src/common/types/auth.types';
import { BasicAuthGuard } from 'src/common/guards/basic-auth.guard';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { FacebookLoginDto } from './dto/facebook-login.dto';
import { DeviceHeader } from 'src/common/decorators/device.decorator';
import { JwtRefreshGuard } from 'src/common/guards/jwt-refresh.guard';
import type { RefreshTokenPayload } from './interfaces/auth-response.interface';

@ApiTags('Auth Module')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @UseGuards(BasicAuthGuard)
  @ApiBasicAuth('BasicAuth')
  @ApiOperation({ summary: 'Send OTP using email or phone' })
  @HttpCode(200)
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  @UseGuards(TempTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify OTP — pass token from sendOtp in Authorization header',
  })
  @HttpCode(200)
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: RequestWithTempToken) {
    return this.authService.verifyOtp(dto, req.tempTokenData);
  }

  @Post('create-profile')
  @UseGuards(TempTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create user profile after OTP verification' })
  @HttpCode(201)
  createProfile(
    @Body() dto: CreateProfileDto,
    @Req() req: RequestWithTempToken,
    @DeviceHeader() device: string,
  ) {
    return this.authService.createProfile(dto, req.tempTokenData, device);
  }

  @Post('login')
  @UseGuards(BasicAuthGuard)
  @ApiBasicAuth('BasicAuth')
  @ApiOperation({ summary: 'Login with email/phone/username and password' })
  @HttpCode(200)
  login(@Body() dto: LoginDto, @DeviceHeader() device: string) {
    return this.authService.login(dto, device);
  }

  @Post('facebook-login')
  @UseGuards(BasicAuthGuard)
  @ApiBasicAuth('BasicAuth')
  @ApiOperation({ summary: 'Login or signup via Facebook' })
  @HttpCode(200)
  loginWithFacebook(@Body() dto: FacebookLoginDto, @DeviceHeader() device: string) {
    return this.authService.facebookLogin(dto, device);
  }

  @Post('reset-password')
  @UseGuards(TempTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reset password using phone or email' })
  @HttpCode(200)
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: RequestWithTempToken,
  ) {
    return this.authService.resetPassword(dto, req.tempTokenData);
  }

  @Post('resend-otp')
  @UseGuards(TempTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({summary: 'Resend OTP using temp token after initial sendOtp'})
  @HttpCode(200)
  resendOtp(@Req() req: RequestWithTempToken) {
    return this.authService.resendOtp(req.tempTokenData);
  }

  @Post('refresh-token')
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token' })
  @HttpCode(200)
  refreshToken(@CurrentUser() user: RefreshTokenPayload) {
    return this.authService.refreshToken(user);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current device' })
  @HttpCode(200)
  logout(@CurrentUser('sessionId') sessionId: string) {
    return this.authService.logout(sessionId);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user from all devices' })
  @HttpCode(200)
  logoutAll(@CurrentUser('userId') userId: string) {
    return this.authService.logoutAll(userId);
  }
}