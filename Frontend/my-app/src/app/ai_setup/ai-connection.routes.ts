import { Routes } from '@angular/router';

export const AI_CONNECTION_ROUTES: Routes = [
  {
    path: 'ai-setup/ai-connection',
    loadComponent: () =>
      import('./ai-connection/ai-connection').then((m) => m.AiConnection),
    data: {
      title: 'AI Connection',
      breadcrumb: 'AI Setup / AI Connection',
    },
  },
  {
    path: 'ai-setup/ai-function',
    loadComponent: () =>
      import('./ai-function/ai-function').then((m) => m.AiFunction),
    data: {
      title: 'AI Functions',
      breadcrumb: 'AI Setup / AI Functions',
    },
  },
  {
    path: 'ai-setup/ai-prompt',
    loadComponent: () =>
      import('./ai-prompt/ai-prompt/ai-prompt').then((m) => m.AiPrompt),
    data: {
      title: 'AI Prompts',
      breadcrumb: 'AI Setup / AI Prompts',
    },
  },
  {
    path: 'ai-setup/api-test',
    loadComponent: () =>
      import('./ai-api/api-test/api-test').then((m) => m.ApiTest),
    data: {
      title: 'API Tester',
      breadcrumb: 'AI Setup / API Tester',
    },
  },
  {
    path: 'ai-setup/integrations',
    loadComponent: () =>
      import('./ai-integration/ai-integration').then((m) => m.AiIntegration),
    data: {
      title: 'Integrations',
      breadcrumb: 'AI Setup / Integrations',
    },
  },
  {
    path: 'ai-setup/overview',
    loadComponent: () =>
      import('./extension-grid/extension-grid').then((m) => m.ExtensionGrid),
    data: {
      title: 'Extension Overview',
      breadcrumb: 'AI Setup / Extension Overview',
    },
  },
];
