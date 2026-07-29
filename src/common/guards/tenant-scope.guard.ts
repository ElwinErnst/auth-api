import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AccessTokenPayload } from '../../modules/auth/types/access-token-payload.type';

@Injectable()
export class TenantScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const currentAuth = request.user as AccessTokenPayload | undefined;

    if (!currentAuth) {
      throw new ForbiddenException('Missing authenticated user');
    }

    const tenantIdFromParams =
      request.params?.tenantId ??
      request.body?.tenantId ??
      request.query?.tenantId;

    if (!tenantIdFromParams) {
      return true;
    }

    if (tenantIdFromParams !== currentAuth.tenantId) {
      throw new ForbiddenException('Cross-tenant access denied');
    }

    return true;
  }
}
