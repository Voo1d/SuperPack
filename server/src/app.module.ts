import { DynamicModule, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AppConfig, CONFIG } from './config';
import { DbModule } from './db/db.module';
import { HealthController } from './health.controller';
import { InventoryModule } from './inventory/inventory.module';
import { StaffModule } from './staff/staff.module';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [DbModule, AuthModule, StaffModule, InventoryModule],
      controllers: [HealthController],
      providers: [{ provide: CONFIG, useValue: config }],
      exports: [CONFIG],
    };
  }
}
