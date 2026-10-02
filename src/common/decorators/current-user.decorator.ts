import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../enums';

export interface RequestUser {
  userId: string;
  username: string;
  role: UserRole;
}

/** Lấy user đã xác thực từ request (do JwtStrategy gắn vào). */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext): RequestUser | string => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as RequestUser;
    return data ? user?.[data] : user;
  },
);
