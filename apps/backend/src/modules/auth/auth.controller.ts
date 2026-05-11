import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, type AuthedUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto, MagicLinkRequestDto, MagicLinkConsumeDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register with email + password' })
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(dto, { ip: req.ip, ua: req.headers['user-agent'] });
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email + password' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto, { ip: req.ip, ua: req.headers['user-agent'] });
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token → new access + refresh' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.signedCookies?.['refresh_token'] ?? req.cookies?.['refresh_token'];
    if (!token) throw new UnauthorizedException('no refresh cookie');
    const result = await this.auth.refresh(token, { ip: req.ip, ua: req.headers['user-agent'] });
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.signedCookies?.['refresh_token'] ?? req.cookies?.['refresh_token'];
    if (token) await this.auth.logout(token);
    res.clearCookie('refresh_token');
  }

  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  async me(@CurrentUser() user: AuthedUser) {
    return this.auth.me(user.sub);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List active sessions for current user' })
  async sessions(@CurrentUser() user: AuthedUser) {
    return this.auth.listSessions(user.sub);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(202)
  async forgot(@Body() dto: ForgotPasswordDto) {
    await this.auth.requestPasswordReset(dto.email);
    return { ok: true };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async reset(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.auth.verifyEmail(dto.token);
    return { ok: true };
  }

  @Public()
  @Post('magic-link/request')
  @HttpCode(202)
  async magicRequest(@Body() dto: MagicLinkRequestDto) {
    await this.auth.requestMagicLink(dto.email);
    return { ok: true };
  }

  @Public()
  @Post('magic-link/consume')
  @HttpCode(200)
  async magicConsume(@Body() dto: MagicLinkConsumeDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.consumeMagicLink(dto.token, { ip: req.ip, ua: req.headers['user-agent'] });
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      signed: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
  }
}
