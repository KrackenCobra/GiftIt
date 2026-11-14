import type { CircleSummary } from '../../src/services/circles';
import { db, id, wait } from '../data';

export type { CircleSummary };

export async function listMyCircles(): Promise<CircleSummary[]> {
  await wait();
  return db.circles.map((c) => ({ ...c, members: [...c.members] }));
}

export async function listFriends(): Promise<{ userId: string; displayName: string | null }[]> {
  await wait();
  return db.friends;
}

export async function createCircle(name: string) {
  const circleId = id('circle');
  db.circles.push({ id: circleId, name: name.trim(), keyVersion: 1, members: [] });
  return circleId;
}

export async function createInvite(_circleId: string): Promise<string> {
  await wait(250);
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let t = '';
  for (let i = 0; i < 43; i++) t += abc[Math.floor(Math.random() * abc.length)];
  return `giftit://invite/${t}`;
}

export async function redeemInvite(_link: string) {
  await wait();
  return 'c-preview';
}

export async function safetyNumberWith(_userId: string): Promise<{ number: string; theirIdentity: string }> {
  return { number: '37281 90412 55608 12093 77461 20985', theirIdentity: 'preview' };
}

export async function confirmSafetyNumber(userId: string, _theirIdentity: string) {
  db.verified.add(userId);
}

function edit(circleId: string, fn: (c: CircleSummary) => void) {
  const c = db.circles.find((x) => x.id === circleId);
  if (c) fn(c);
}

export async function approveMember(circleId: string, memberId: string) {
  edit(circleId, (c) => c.members.forEach((m) => { if (m.userId === memberId) m.pending = false; }));
}

export async function declineRequest(circleId: string, memberId: string) {
  edit(circleId, (c) => { c.members = c.members.filter((m) => m.userId !== memberId); });
}

export async function removeMemberAndRotate(circleId: string, memberId: string) {
  edit(circleId, (c) => { c.members = c.members.filter((m) => m.userId !== memberId); c.keyVersion++; });
}

export async function rotateAllMyCircles() {
  db.circles.forEach((c) => c.keyVersion++);
}

export async function rotateCircle(circleId: string, removeUserId?: string) {
  if (removeUserId) return removeMemberAndRotate(circleId, removeUserId);
  edit(circleId, (c) => { c.keyVersion++; });
}
