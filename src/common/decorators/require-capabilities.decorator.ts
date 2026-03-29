import { SetMetadata } from '@nestjs/common';
import type { Capability } from '../auth/capabilities';

export const CAPABILITIES_KEY = 'capabilities';
export const RequireCapabilities = (...required: Capability[]) => SetMetadata(CAPABILITIES_KEY, required);
