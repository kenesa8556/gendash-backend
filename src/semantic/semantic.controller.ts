import { Controller, Get } from '@nestjs/common';
import { METRICS, DIMENSIONS } from './semantic';
import { SPEC_VERSION } from './spec';

@Controller('semantic')
export class SemanticController {
  @Get()
  get() {
    return {
      specVersion: SPEC_VERSION,
      kinds: ['kpi', 'line', 'bar', 'table'],
      metrics: Object.entries(METRICS).map(([key, m]) => ({ key, label: m.label, format: m.format })),
      dimensions: Object.entries(DIMENSIONS).map(([key, d]) => ({ key, label: d.label })),
    };
  }
}