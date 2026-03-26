import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHEN_PASSWORD_CHANGE_REQUIRED_KEY = 'allowWhenPasswordChangeRequired';
export const AllowWhenPasswordChangeRequired = () =>
  SetMetadata(ALLOW_WHEN_PASSWORD_CHANGE_REQUIRED_KEY, true);
