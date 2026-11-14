import type { GiftPlan, PlanBody, PlanStep } from '../../src/services/plans';
import { db, id, wait } from '../data';

export type { GiftPlan, PlanBody, PlanStep };

export async function planFor(aboutUserId: string): Promise<GiftPlan | null> {
  await wait();
  const found = db.plans.find((p) => p.aboutUserId === aboutUserId);
  if (found) return structuredClone(found);
  if (aboutUserId === 'u-mom') {
    // Sample plan from the design.
    return {
      id: 'plan-mom',
      aboutUserId,
      steps: [
        { id: 's1', label: 'Pick gift: raised cedar bed', done: true },
        { id: 's2', label: 'Order peony bouquet', when: 'Nov 20', done: false },
        { id: 's3', label: 'Card from the grandkids', when: 'Nov 22', done: false },
        { id: 's4', label: 'Set up Saturday morning', when: 'Nov 24', done: false },
      ],
      note: 'She said "not roses." Ask Dad to keep her out of the backyard Saturday morning so we can set up the garden bed.',
    };
  }
  return null;
}

export async function savePlan(body: PlanBody, planId?: string): Promise<string> {
  await wait(300);
  const pid = planId ?? id('plan');
  db.plans = [...db.plans.filter((p) => p.id !== pid), { id: pid, ...structuredClone(body) }];
  return pid;
}

export function newStep(label: string, when?: string): PlanStep {
  return { id: id('step'), label, done: false, ...(when ? { when } : {}) };
}
