import { Injectable, signal } from '@solid-mvc/core';

// providedIn: 'root' — resolved from the root injector no matter which module
// or view asks for it, so every feature sees the same instance.
@Injectable({ providedIn: 'root' })
export class SessionService {
  user = signal({ name: 'Ada Lovelace' });
  visits = signal(0);

  recordVisit() {
    this.visits.value += 1;
  }
}
