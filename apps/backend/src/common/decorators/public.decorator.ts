import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** 标记某个路由/控制器无需登录即可访问。不标 = 必须登录。 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);