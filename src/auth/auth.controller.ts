import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import type { Request, Response } from 'express';
import { RefreshTokenService } from './refresh-token.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';

const COOKIE_NAME = 'refresh_token';
const COOKIE_AGE = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/auth',
};


@Controller('auth')
export class AuthController {

    constructor(private readonly authService: AuthService,
                private readonly refreshTokens: RefreshTokenService,
                private readonly prisma: PrismaService,
                private readonly jwtService: JwtService) {}

    // Register a new user 
    // @Body() dto: RegisterDto contains the registration details of the user
    // POST /auth/register endpoint for user registration
    // {
    //   "full_name": "John Doe",
    //   "email": "john.doe@example.com",
    //   "password": "password123",
    //   "phone": "1234567890"
    // }
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    // Login an existing user
    // @Body() dto: LoginDto contains the login details of the user
    // POST /auth/login endpoint for user login
    // {
    //   "email": "john.doe@example.com",
    //   "password": "password123"
    // }
    @Post('login')
    async login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }



    @Get('refresh')
    async refresh(@Req() req: Request) {

        // get the refresh token from header refreshtoken

        const token = req.headers['refreshtoken'] as string;
    if (!token) {
            throw new UnauthorizedException('No refresh token provided');
        }
        return this.authService.refresh(token);
    }



     
}
