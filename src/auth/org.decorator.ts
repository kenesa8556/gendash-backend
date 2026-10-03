import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Org = createParamDecorator((_d: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest().orgId as string,
);