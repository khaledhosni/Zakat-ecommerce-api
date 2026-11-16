import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';

@Controller('auth')
export class AuthController {

    constructor(private readonly authService: AuthService) {}

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

}
