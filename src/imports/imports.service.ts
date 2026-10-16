import { BadRequestException, Inject, Injectable,ConflictException, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../supabase/supabase.module';
import { sampleRows } from './sample';
import { QueryEngineService } from '../query-engine/query-engine.service';
import { OrgContextService } from '../organizations/org-context.service';
import { readCsv } from './csv';
import { Mapping, MappingSchema, suggestMapping } from './mapping';
import { detectDateOrder, validateRows } from './normalize';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 50_000;
const MAX_ORG_ROWS = 100_000;

@Injectable()
export class ImportsService {
  constructor(
    @Inject(SUPABASE) private sb: SupabaseClient,
    private engine: QueryEngineService,
    private orgCtx: OrgContextService,
  ) {}

  private read(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file required');
    if (!/\.csv$/i.test(file.originalname))
      throw new BadRequestException(
        /\.xlsx$/i.test(file.originalname)
          ? 'Excel (.xlsx) support is coming soon. For now, save your sheet as CSV and upload that.'
          : 'Only .csv files are supported.',
      );
    const { headers, rows } = readCsv(file.buffer);
    if (!rows.length) throw new BadRequestException('The file has no data rows.');
    if (rows.length > MAX_IMPORT_ROWS)
      throw new BadRequestException(`Too many rows (max ${MAX_IMPORT_ROWS}). Split the file.`);
    return { headers, rows };
  }

  preview(file?: Express.Multer.File) {
    const { headers, rows } = this.read(file);
    const mapping = suggestMapping(headers);
    const dates = mapping.date != null ? rows.map((r) => r[mapping.date!] ?? '') : [];
    const o = detectDateOrder(dates);
    return {
      filename: file!.originalname,
      headers,
      totalRows: rows.length,
      sample: rows.slice(0, 20),
      mapping,
      missingRequired: (['date', 'amount'] as const).filter((k) => mapping[k] == null),
      dateOrder: o.order,
      dateOrderAmbiguous: o.ambiguous,
    };
  }

  async run(
    orgId: string,
    userId: string,
    file: Express.Multer.File | undefined,
    body: { mapping?: string; mode?: string; dateOrder?: string; dryRun?: string },
  ) {
    const { headers, rows } = this.read(file);

    let mapping: Mapping;
    try {
      mapping = MappingSchema.parse(JSON.parse(body.mapping ?? ''));
    } catch {
      throw new BadRequestException('Invalid column matching. Date and amount are required.');
    }
    const cols = [mapping.date, mapping.amount, mapping.branch, mapping.category, mapping.item, mapping.qty].filter(
      (x): x is number => x != null,
    );
    if (cols.some((c) => c >= headers.length)) throw new BadRequestException('Column does not exist in the file.');
    if (new Set(cols).size !== cols.length) throw new BadRequestException('Each column can be used only once.');

    const order = body.dateOrder === 'mdy' ? 'mdy' : 'dmy';
    const mode = body.mode === 'replace' ? 'replace' : 'append';
    const res = validateRows(rows, mapping, order);
    const report = {
      rowsTotal: rows.length,
      rowsValid: res.valid.length,
      rowsSkipped: res.skipped,
      reasons: res.reasons,
      issues: res.issues,
      dateRange: res.dateRange,
      sample: res.valid.slice(0, 5),
    };
    if (body.dryRun === 'true') return { dryRun: true, ...report };
    if (!res.valid.length) throw new BadRequestException('No valid rows found. Check the column matching.');

    const { count, error: ce } = await this.sb
      .from('sales').select('id', { count: 'exact', head: true }).eq('org_id', orgId);
    if (ce) throw new Error(ce.message);
    const existing = mode === 'replace' ? 0 : count ?? 0;
    if (existing + res.valid.length > MAX_ORG_ROWS)
      throw new BadRequestException(`Limit is ${MAX_ORG_ROWS} rows per organization. Use "replace" or delete old data.`);

    const { data: imp, error: e1 } = await this.sb
      .from('imports')
      .insert({
        org_id: orgId, filename: file!.originalname.slice(0, 120),
        rows_total: report.rowsTotal, rows_imported: report.rowsValid, rows_skipped: report.rowsSkipped,
        mapping, mode, created_by: userId,
      })
      .select('id').single();
    if (e1) throw new Error(e1.message);

    try {
      for (let i = 0; i < res.valid.length; i += 1000) {
        const batch = res.valid.slice(i, i + 1000).map((v) => ({ ...v, org_id: orgId, import_id: imp.id }));
        const { error } = await this.sb.from('sales').insert(batch);
        if (error) throw new Error(error.message);
      }
    } catch (e) {
      await this.sb.from('imports').delete().eq('id', imp.id); // cascade removes the partial rows
      throw e;
    }

    if (mode === 'replace') {
      const { error: d1 } = await this.sb.from('sales').delete()
        .eq('org_id', orgId).or(`import_id.is.null,import_id.neq.${imp.id}`);
      const { error: d2 } = await this.sb.from('imports').delete().eq('org_id', orgId).neq('id', imp.id);
      if (d1 || d2) console.error('replace cleanup failed', d1?.message, d2?.message);
    }

    this.engine.forget(orgId);
    this.orgCtx.invalidate(orgId);
    return { ...report, importId: imp.id, mode };
  }

  async list(orgId: string) {
    const { data, error } = await this.sb.from('imports')
      .select('id, filename, rows_imported, rows_skipped, mode, created_at')
      .eq('org_id', orgId).order('created_at', { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return data;
  }

    async status(orgId: string) {
    const { count, error } = await this.sb
      .from('sales').select('id', { count: 'exact', head: true }).eq('org_id', orgId);
    if (error) throw new Error(error.message);
    return { rows: count ?? 0 };
  }

  async sample(orgId: string, userId: string) {
    if ((await this.status(orgId)).rows > 0)
      throw new ConflictException('This shop already has data. Delete it first to load the sample.');
    const rows = sampleRows();
    const { data: imp, error: e1 } = await this.sb.from('imports').insert({
      org_id: orgId, filename: 'sample-data', rows_total: rows.length, rows_imported: rows.length,
      rows_skipped: 0, mapping: {}, mode: 'sample', created_by: userId,
    }).select('id').single();
    if (e1) throw new Error(e1.message);
    try {
      for (let i = 0; i < rows.length; i += 1000) {
        const batch = rows.slice(i, i + 1000).map((v) => ({ ...v, org_id: orgId, import_id: imp.id }));
        const { error } = await this.sb.from('sales').insert(batch);
        if (error) throw new Error(error.message);
      }
    } catch (e) {
      await this.sb.from('imports').delete().eq('id', imp.id); // cascade removes partial rows
      throw e;
    }
    this.engine.forget(orgId);
    this.orgCtx.invalidate(orgId);
    return { importId: imp.id as string, rowsImported: rows.length };
  }

  async remove(orgId: string, id: string) {
    const { error, count } = await this.sb.from('imports')
      .delete({ count: 'exact' }).eq('id', id).eq('org_id', orgId);
    if (error) throw new Error(error.message);
    if (!count) throw new NotFoundException('import not found');
    this.engine.forget(orgId);
    this.orgCtx.invalidate(orgId);
    return { deleted: true };
  }
}