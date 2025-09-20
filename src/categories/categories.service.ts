import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CategoriesRepository } from './categories.repository';

import { EnhancedCacheService } from '@common/services/enhanced-cache.service';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly configService: ConfigService,
    private readonly cacheService: EnhancedCacheService
  ) {}

}
