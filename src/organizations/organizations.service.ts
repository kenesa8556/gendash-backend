import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../supabase/supabase.module';

const CURRENCIES = ['ETB', 'USD', 'EUR', 'GBP', 'KES', 'NGN', 'GHS', 'ZAR', 'UGX', 'TZS'];
const MAX_OWNED = 3;
type User = { id: string; email: string };

@Injectable()
export class OrganizationsService {
  constructor(@Inject(SUPABASE) private sb: SupabaseClient) {}

  async me(user: User) {
    const { data, error } = await this.sb
      .from('members')
      .select('role, org_id, organizations(name, currency)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true });
    if (error) throw new Error(error.message);
    const memberships = (data ?? []).map((m: any) => ({
      orgId: m.org_id as string,
      role: m.role as 'owner' | 'member',
      name: (m.organizations?.name ?? '') as string,
      currency: (m.organizations?.currency ?? 'ETB') as string,
    }));
    return { user, memberships, invitations: [] as unknown[] }; // invitations arrive in B2
  }

  async create(user: User, body: { name?: string; currency?: string }) {
    const name = String(body?.name ?? '').replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > 60)
      throw new BadRequestException('Shop name must be 2 to 60 characters.');
    const currency = String(body?.currency ?? 'ETB').toUpperCase();
    if (!CURRENCIES.includes(currency)) throw new BadRequestException('Unsupported currency.');

    const { count, error: ce } = await this.sb
      .from('members').select('org_id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('role', 'owner');
    if (ce) throw new Error(ce.message);
    if ((count ?? 0) >= MAX_OWNED)
      throw new BadRequestException(`You can own up to ${MAX_OWNED} shops.`);

    const { data: org, error: e1 } = await this.sb
      .from('organizations').insert({ name, currency, created_by: user.id })
      .select('id, name, currency').single();
    if (e1) throw new Error(e1.message);

    const { error: e2 } = await this.sb
      .from('members').insert({ user_id: user.id, org_id: org.id, role: 'owner', email: user.email });
    if (e2) {
      await this.sb.from('organizations').delete().eq('id', org.id); // no half-created shop
      throw new Error(e2.message);
    }
    return { orgId: org.id as string, name: org.name as string, currency: org.currency as string, role: 'owner' };
  }
}