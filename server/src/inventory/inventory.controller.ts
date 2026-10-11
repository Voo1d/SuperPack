import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, RequirePermission } from '../auth/auth.decorators';
import type { CurrentEmployee } from '../auth/auth.types';
import { ZodPipe } from '../common/zod.pipe';
import { UNITS } from '../common/quantity';
import {
  itemsQuerySchema,
  listQuerySchema,
  ListQuery,
  movementSchema,
  MovementDto,
  receiveSchema,
  ReceiveDto,
} from './inventory.dto';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('meta')
  @RequirePermission('stock.read')
  meta() {
    return { units: UNITS };
  }

  @Get('inventory/summary')
  @RequirePermission('stock.read')
  summary() {
    return this.inventory.summary();
  }

  @Get('items')
  @RequirePermission('stock.read')
  items(@Query(new ZodPipe(itemsQuerySchema)) q: z.infer<typeof itemsQuerySchema>) {
    return this.inventory.listItems(q);
  }

  @Get('batches')
  @RequirePermission('stock.read')
  list(@Query(new ZodPipe(listQuerySchema)) q: ListQuery) {
    return this.inventory.listBatches(q);
  }

  @Get('batches/:id')
  @RequirePermission('stock.read')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.inventory.getBatch(id);
  }

  /** Приёмка партии. */
  @Post('batches')
  @RequirePermission('stock.write')
  receive(@Body(new ZodPipe(receiveSchema)) dto: ReceiveDto, @CurrentUser() me: CurrentEmployee) {
    return this.inventory.receive(dto, me);
  }

  /** Списание или корректировка остатка (история не стирается, добавляется движение). */
  @Post('batches/:id/movements')
  @HttpCode(201)
  @RequirePermission('stock.write')
  movement(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(movementSchema)) dto: MovementDto,
    @CurrentUser() me: CurrentEmployee,
  ) {
    return this.inventory.addMovement(id, dto, me);
  }
}
