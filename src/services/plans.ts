import { randomUUID } from 'expo-crypto';
import { supabase } from '../lib/supabase';
import { crypto, type Envelope } from '../crypto';
import { loadIdentityPrivateKey, loadIdentityPublicKey } from '../crypto/keystore';
import { getVaultKey } from './keys';

/**
 * Surprise plans. Encrypted with your vault key and signed with your identity key, so only your
 * own phones can read them. The person the plan is about is inside the ciphertext: the server
 * stores (id, planner_id, ciphertext) and RLS limits every row to its planner.
 */

export interface PlanStep {
  id: string;
  label: string;
  when?: string; // free text, e.g. "Nov 20"
  done: boolean;
}

export interface PlanBody {
  aboutUserId: string;
  steps: PlanStep[];
  note: string;
}

export interface GiftPlan extends PlanBody {
  id: string;
}

const MAX_STEPS = 30;
const MAX_LABEL = 120;
const MAX_NOTE = 2000;

async function myId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not signed in');
  return data.user.id;
}

function clean(body: PlanBody): PlanBody {
  return {
    aboutUserId: body.aboutUserId,
    steps: body.steps
      .filter((s) => s.label.trim())
      .slice(0, MAX_STEPS)
      .map((s) => ({ id: s.id, label: s.label.trim().slice(0, MAX_LABEL), done: !!s.done, ...(s.when?.trim() ? { when: s.when.trim().slice(0, 20) } : {}) })),
    note: body.note.slice(0, MAX_NOTE),
  };
}

type PlanRow = { id: string; planner_id: string; ciphertext: Envelope };

/** Your plan for one person, or null. Rows that fail the signature check are ignored. */
export async function planFor(aboutUserId: string): Promise<GiftPlan | null> {
  const uid = await myId();
  const { data, error } = await supabase.from('gift_plans').select('id, planner_id, ciphertext').eq('planner_id', uid);
  if (error) throw error;
  const mine = await loadIdentityPublicKey();
  if (!mine) throw new Error('This phone is not set up yet');
  const key = await getVaultKey();
  const c = crypto();
  for (const row of (data ?? []) as PlanRow[]) {
    try {
      const ctx = { kind: 'gift_plan' as const, itemId: row.id, ownerId: row.planner_id, keyVersion: 1 };
      if (!c.verifyEnvelope(row.ciphertext, ctx, mine)) continue;
      const body = c.decryptJson<PlanBody>(row.ciphertext, key, ctx);
      if (body.aboutUserId === aboutUserId) return { id: row.id, ...body };
    } catch {
      // tampered or unreadable: skip
    }
  }
  return null;
}

/** Creates or replaces the plan. Pass the id from planFor() to update in place. */
export async function savePlan(body: PlanBody, id?: string): Promise<string> {
  const c = crypto();
  const planId = id ?? randomUUID();
  const plannerId = await myId();
  const ctx = { kind: 'gift_plan' as const, itemId: planId, ownerId: plannerId, keyVersion: 1 };
  const key = await getVaultKey();
  const idSk = await loadIdentityPrivateKey(); // biometric prompt
  let ciphertext: Envelope;
  try {
    ciphertext = c.signEnvelope(c.encryptJson(clean(body), key, ctx), ctx, idSk);
  } finally {
    c.wipe(idSk);
  }
  const { error } = await supabase.from('gift_plans').upsert({ id: planId, planner_id: plannerId, ciphertext });
  if (error) throw error;
  return planId;
}

export function newStep(label: string, when?: string): PlanStep {
  return { id: randomUUID(), label, done: false, ...(when ? { when } : {}) };
}
