import { Injectable, signal } from '@solid-mvc/core';

/**
 * App-wide session state — the model layer for "who is signed in". Any
 * view or controller can inject it; the shell reads it for the avatar and
 * header instead of hardcoding an identity.
 */
@Injectable()
export class SessionService {
  readonly user = signal({ name: 'Ada Lovelace', role: 'admin' });
}
