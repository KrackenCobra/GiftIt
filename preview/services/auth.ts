import type { EnrollResult } from '../../src/services/auth';
import { wait } from '../data';

export type { EnrollResult };

export async function registerPasskey() {}
export async function signInWithPasskey() { await wait(300); }
export async function sendEmailCode(_email: string) { await wait(300); }
export async function verifyEmailCode(_email: string, _token: string) { await wait(300); }
export async function enrollThisDevice(_deviceLabel: string): Promise<EnrollResult> { return { status: 'ready' }; }
export async function approveDevice(_pendingDeviceId: string) {}
export async function restoreWithRecoveryPhrase(_phrase: string) { await wait(300); }
export async function revokeDevice(_deviceId: string) {}
export async function signOutAndWipe() { await wait(200); }
