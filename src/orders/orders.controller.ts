
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';


import { OrdersService } from './orders.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles/roles.guard.js';
import type{ AuthenticatedRequest } from '../auth/interface/authentecated-request.interface.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
  ) {}

  @Post()
  @UseGuards(
    JwtAuthGuard,
    RolesGuard(['CUSTOMER']),
  )
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(
      String(req.user!.sub),
      dto,
    );
  }


  // Get all orders for the authenticated customer.
  // GET /orders/my
  @Get('my')

  @UseGuards(
    JwtAuthGuard,
    RolesGuard(['CUSTOMER']),
  )
  findMyOrders(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ordersService.findMyOrders(
      String(req.user!.sub),
    );
  }


  // find all 

  // GET /orders

  @Get()
  @UseGuards(
    JwtAuthGuard,
    RolesGuard(['ADMIN']),
  )
  findAll() {
    return this.ordersService.findAll();
  }



  // GET /Orders/:id

    @Get(':id')
    @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ordersService.findOne(
      id,
      String(req.user!.sub),
      req.user!.roles,
    );
  }
}
