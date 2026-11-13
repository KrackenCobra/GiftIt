import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

/** 24 words = 256 bits of entropy. Shown once at signup; never stored or sent anywhere. */
export function newRecoveryPhrase(): string {
  return generateMnemonic(wordlist, 256);
}

export function isValidRecoveryPhrase(phrase: string): boolean {
  return validateMnemonic(phrase.trim().toLowerCase().split(/\s+/).join(' '), wordlist);
}
