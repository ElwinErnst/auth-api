import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.header('x-internal-service-secret');
    const expected = this.config.get<string>('internal.serviceSecret');

    if (!expected || provided !== expected) {
      throw new ForbiddenException('Invalid internal service secret');
    }

    return true;
  }
}
