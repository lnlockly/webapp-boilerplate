import {
  Controller, Get, Post, Body, Param, Delete,
  UseGuards, Request, ForbiddenException, Patch,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req) {
    return { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  getAll() {
    return this.users.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  async deleteUser(@Request() req, @Param('id') id: string) {
    if (req.user.id === parseInt(id)) throw new ForbiddenException('Cannot delete yourself');
    await this.users.delete(parseInt(id));
    return { ok: true };
  }
}