import {
  BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus,
  Inject, Injectable, NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../supabase/supabase.module';

const MAX_MEMBERS = 5;
const MAX_INVITES_PER_DAY = 20;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DAY = 86_400_000;
type User = { id: string; email: string };

@Injectable()
export class MembersService {
  constructor(@Inject(SUPABASE) private sb: SupabaseClient) {}

  private async countMembers(orgId: string) {
    const { count, error } = await this.sb.from('members')
      .select('user_id', { count: 'exact', head: true }).eq('org_id', orgId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async listMembers(orgId: string) {
    const { data, error } = await this.sb.from('members')
      .select('user_id, email, role, joined_at').eq('org_id', orgId)
      .order('joined_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
  }

  async listInvitations(orgId: string) {
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const { data, error } = await this.sb.from('invitations')
      .select('id, email, role, status, created_at, responded_at')
      .eq('org_id', orgId).in('status', ['pending', 'declined']).gte('created_at', since)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  async invite(orgId: string, inviter: User, body: { email?: string; role?: string }) {
    const email = String(body?.email ?? '').trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 120) throw new BadRequestException('Enter a valid email address.');
    if (email === inviter.email) throw new BadRequestException('You are already in this shop.');
    const role = body?.role === 'owner' ? 'owner' : 'member';

    const { data: existing, error: e0 } = await this.sb.from('members')
      .select('user_id').eq('org_id', orgId).eq('email', email).maybeSingle();
    if (e0) throw new Error(e0.message);
    if (existing) throw new ConflictException('That person is already a member.');

    const members = await this.countMembers(orgId);
    const { count: pending } = await this.sb.from('invitations')
      .select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'pending');
    if (members + (pending ?? 0) >= MAX_MEMBERS)
      throw new BadRequestException(`A shop can have up to ${MAX_MEMBERS} members, including pending invitations.`);

    const { count: today } = await this.sb.from('invitations')
      .select('id', { count: 'exact', head: true }).eq('org_id', orgId)
      .gte('created_at', new Date(Date.now() - DAY).toISOString());
    if ((today ?? 0) >= MAX_INVITES_PER_DAY)
      throw new HttpException('Too many invitations today. Try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);

    const { data, error } = await this.sb.from('invitations')
      .insert({ org_id: orgId, email, role, invited_by: inviter.id, invited_by_email: inviter.email })
      .select('id, email, role, status, created_at').single();
    if (error) {
      if (error.code === '23505') throw new ConflictException('An invitation for that email is already pending.');
      throw new Error(error.message);
    }
    return data;
  }

  async revoke(orgId: string, id: string) {
    const { data, error } = await this.sb.from('invitations')
      .update({ status: 'revoked', responded_at: new Date().toISOString() })
      .eq('id', id).eq('org_id', orgId).eq('status', 'pending').select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new NotFoundException('invitation not found');
    return { revoked: true };
  }

  private async assertNotLastOwner(orgId: string, userId: string) {
    const { data, error } = await this.sb.from('members')
      .select('user_id').eq('org_id', orgId).eq('role', 'owner');
    if (error) throw new Error(error.message);
    const owners = data ?? [];
    if (owners.length === 1 && owners[0].user_id === userId)
      throw new BadRequestException('A shop needs at least one owner.');
  }

  async setRole(orgId: string, userId: string, role: string) {
    if (role !== 'owner' && role !== 'member') throw new BadRequestException('Role must be owner or member.');
    if (role === 'member') await this.assertNotLastOwner(orgId, userId);
    const { data, error } = await this.sb.from('members')
      .update({ role }).eq('org_id', orgId).eq('user_id', userId).select('user_id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new NotFoundException('member not found');
    return { userId, role };
  }

  async remove(orgId: string, target: string, actor: { id: string; role: string }) {
    if (target !== actor.id && actor.role !== 'owner')
      throw new ForbiddenException('Only owners can remove members.');
    await this.assertNotLastOwner(orgId, target);
    const { data, error } = await this.sb.from('members')
      .delete().eq('org_id', orgId).eq('user_id', target).select('user_id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new NotFoundException('member not found');
    return { removed: true };
  }

  // the signed-in invitee answers an invitation addressed to their own email
  async respond(user: User, id: string, accept: boolean) {
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const { data: inv, error } = await this.sb.from('invitations')
      .select('id, org_id, role').eq('id', id).eq('email', user.email)
      .eq('status', 'pending').gte('created_at', since).maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new NotFoundException('invitation not found');

    const mark = (status: string) =>
      this.sb.from('invitations').update({ status, responded_at: new Date().toISOString() }).eq('id', id);

    if (!accept) {
      await mark('declined');
      return { accepted: false };
    }
    if ((await this.countMembers(inv.org_id)) >= MAX_MEMBERS) throw new ConflictException('This shop is full.');
    const { error: e2 } = await this.sb.from('members')
      .insert({ user_id: user.id, org_id: inv.org_id, role: inv.role, email: user.email });
    if (e2 && e2.code !== '23505') throw new Error(e2.message); // 23505 = already a member, fine
    await mark('accepted');
    return { accepted: true, orgId: inv.org_id as string };
  }
}