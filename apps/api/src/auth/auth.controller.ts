import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Log in and receive a JWT token' })
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('register')
  @ApiOperation({ summary: 'Create a new account for a company user' })
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Get('profile')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Return the authenticated user profile' })
  getProfile(@Req() req: any) {
    return req.user;
  }
}
