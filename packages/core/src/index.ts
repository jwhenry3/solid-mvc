// Signals — the reactivity primitive shared by models, controllers, and views.
export { signal, computed, effect, batch, untracked } from './signals';
export type { Signal, ReadonlySignal } from './signals';

// Dependency injection
export {
  Injector,
  InjectionToken,
  inject,
  runInInjectionContext,
  getCurrentInjector,
  DestroyRef,
} from './injector';
export type { Provider, Token, Type } from './injector';

// Metadata
export { Injectable, Controller, Module, Component } from './decorators';
export type { InjectableMeta, ModuleMeta, ComponentMeta } from './decorators';

// Class-based views
export { View, isViewClass, viewComponent } from './view';

// Modules & bootstrap
export { bootstrap, createModuleInjector, getModuleInjector, getModuleMeta } from './module';

// View integration
export { InjectorContext, useInjector, useService, Provide } from './context';
export { useController } from './controller';
export type { OnInit, OnDestroy } from './controller';

// Router
export { Router, ROUTES, ROUTER_BASE, RouterModule, RouterOutlet, Link, defaultBasePath } from './router';
export type { Route, RouteMatch, RouterOptions } from './router';
