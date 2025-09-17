import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserForJWT } from '../../src/users/types';

export const CurrentUser = createParamDecorator(
  (data: keyof UserForJWT | undefined, ctx: ExecutionContext): UserForJWT | any => {
    const request = ctx.switchToHttp().getRequest();
    const user: UserForJWT = request.user;

    return data ? user?.[data] : user;
  },
);