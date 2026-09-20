import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import type { AuthenticatedUser } from './jwt.strategy';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

const sessionCookieOptions = (isProduction: boolean) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 8 * 60 * 60 * 1000,
});

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Log in and receive an HttpOnly session cookie' })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(body);
    response.cookie('ibra_session', result.token, sessionCookieOptions(process.env.NODE_ENV === 'production'));
    return { user: result.user };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Clear the current session cookie' })
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('ibra_session', sessionCookieOptions(process.env.NODE_ENV === 'production'));
    return { ok: true };
  }

  @Post('register')
  @ApiOperation({ summary: 'Create a new account for a company user' })
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.register(body);
    response.cookie('ibra_session', result.token, sessionCookieOptions(process.env.NODE_ENV === 'production'));
    return { user: result.user };
  }

  @Get('profile')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Return the authenticated user profile' })
  getProfile(@Req() request: AuthenticatedRequest) {
    return { user: request.user };
  }
}
