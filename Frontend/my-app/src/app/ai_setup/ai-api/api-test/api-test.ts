import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ApiTestResult,
  ApiTestService,
} from '../../../services/api_test_service/api-test';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type RequestTab = 'params' | 'headers' | 'body' | 'auth';
export type BodyMode = 'none' | 'raw' | 'form-data' | 'x-www-form-urlencoded';
export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key';
export type ResponseTab = 'body' | 'headers';

export interface KeyValueRow {
  id: number;
  enabled: boolean;
  key: string;
  value: string;
  description: string;
}

export interface SavedRequestSnapshot {
  method: HttpMethod;
  url: string;
  params: KeyValueRow[];
  headers: KeyValueRow[];
  bodyMode: BodyMode;
  rawBody: string;
  formDataRows: KeyValueRow[];
  urlEncodedRows: KeyValueRow[];
  authType: AuthType;
  bearerToken: string;
  basicUsername: string;
  basicPassword: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyIn: 'header' | 'query';
}

export interface CollectionRequest {
  id: string;
  name: string;
  snapshot: SavedRequestSnapshot;
  updatedAt: number;
}

export interface ApiCollection {
  id: string;
  name: string;
  expanded: boolean;
  requests: CollectionRequest[];
}

const STORAGE_KEY = 'voip.api-test.collections';

@Component({
  selector: 'app-api-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './api-test.html',
  styleUrl: './api-test.css',
})
export class ApiTest {
  private readonly apiTestService = inject(ApiTestService);

  readonly methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

  method = signal<HttpMethod>('GET');
  url = signal('https://httpbin.org/get');
  activeRequestTab = signal<RequestTab>('params');
  activeResponseTab = signal<ResponseTab>('body');
  bodyMode = signal<BodyMode>('none');
  authType = signal<AuthType>('none');
  rawBody = signal('{\n  \n}');
  bearerToken = signal('');
  basicUsername = signal('');
  basicPassword = signal('');
  apiKeyName = signal('X-API-Key');
  apiKeyValue = signal('');
  apiKeyIn = signal<'header' | 'query'>('header');

  private nextId = 1;

  params = signal<KeyValueRow[]>([this.createRow()]);
  headers = signal<KeyValueRow[]>([
    { ...this.createRow(), key: 'Accept', value: 'application/json', enabled: true },
    this.createRow(),
  ]);
  formDataRows = signal<KeyValueRow[]>([this.createRow()]);
  urlEncodedRows = signal<KeyValueRow[]>([this.createRow()]);

  readonly isSending = signal(false);
  readonly response = signal<ApiTestResult | null>(null);

  collections = signal<ApiCollection[]>(this.loadCollections());
  collectionSearch = signal('');
  activeCollectionId = signal<string | null>(null);
  activeRequestId = signal<string | null>(null);
  requestName = signal('Untitled Request');

  creatingCollection = signal(false);
  newCollectionName = signal('');
  renamingCollectionId = signal<string | null>(null);
  renameCollectionValue = signal('');
  saveMenuOpen = signal(false);
  /** When true, newly created collection also receives the current request. */
  private saveIntoNewCollection = false;

  readonly hasResponse = computed(() => this.response() !== null);

  readonly enabledParamCount = computed(
    () => this.params().filter((r) => r.enabled && r.key.trim()).length,
  );
  readonly enabledHeaderCount = computed(
    () => this.headers().filter((r) => r.enabled && r.key.trim()).length,
  );

  readonly filteredCollections = computed(() => {
    const q = this.collectionSearch().trim().toLowerCase();
    const items = this.collections();
    if (!q) return items;
    return items
      .map((c) => ({
        ...c,
        requests: c.requests.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.snapshot.method.toLowerCase().includes(q) ||
            r.snapshot.url.toLowerCase().includes(q),
        ),
        expanded: true,
      }))
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.requests.length > 0,
      );
  });

  readonly statusClass = computed(() => {
    const status = this.response()?.status;
    if (status == null) return 'api-test__meta-item--muted';
    if (status >= 200 && status < 300) return 'api-test__meta-item--ok';
    if (status >= 400) return 'api-test__meta-item--err';
    return 'api-test__meta-item--warn';
  });

  setRequestTab(tab: RequestTab): void {
    this.activeRequestTab.set(tab);
  }

  setResponseTab(tab: ResponseTab): void {
    this.activeResponseTab.set(tab);
  }

  setBodyMode(mode: BodyMode): void {
    this.bodyMode.set(mode);
  }

  addRow(kind: 'params' | 'headers' | 'form-data' | 'urlencoded'): void {
    const row = this.createRow();
    if (kind === 'params') this.params.update((rows) => [...rows, row]);
    if (kind === 'headers') this.headers.update((rows) => [...rows, row]);
    if (kind === 'form-data') this.formDataRows.update((rows) => [...rows, row]);
    if (kind === 'urlencoded') this.urlEncodedRows.update((rows) => [...rows, row]);
  }

  removeRow(kind: 'params' | 'headers' | 'form-data' | 'urlencoded', id: number): void {
    const filter = (rows: KeyValueRow[]) => {
      const next = rows.filter((r) => r.id !== id);
      return next.length ? next : [this.createRow()];
    };
    if (kind === 'params') this.params.update(filter);
    if (kind === 'headers') this.headers.update(filter);
    if (kind === 'form-data') this.formDataRows.update(filter);
    if (kind === 'urlencoded') this.urlEncodedRows.update(filter);
  }

  updateRow(
    kind: 'params' | 'headers' | 'form-data' | 'urlencoded',
    id: number,
    patch: Partial<KeyValueRow>,
  ): void {
    const mapRows = (rows: KeyValueRow[]) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r));

    if (kind === 'params') this.params.update(mapRows);
    if (kind === 'headers') this.headers.update(mapRows);
    if (kind === 'form-data') this.formDataRows.update(mapRows);
    if (kind === 'urlencoded') this.urlEncodedRows.update(mapRows);
  }

  onSend(): void {
    if (this.isSending()) return;

    this.isSending.set(true);
    this.activeResponseTab.set('body');

    this.apiTestService
      .send({
        method: this.method(),
        url: this.url(),
        params: this.params(),
        headers: this.headers(),
        bodyMode: this.bodyMode(),
        rawBody: this.rawBody(),
        formDataRows: this.formDataRows(),
        urlEncodedRows: this.urlEncodedRows(),
        authType: this.authType(),
        bearerToken: this.bearerToken(),
        basicUsername: this.basicUsername(),
        basicPassword: this.basicPassword(),
        apiKeyName: this.apiKeyName(),
        apiKeyValue: this.apiKeyValue(),
        apiKeyIn: this.apiKeyIn(),
      })
      .subscribe({
        next: (result) => {
          this.response.set(result);
          this.isSending.set(false);
        },
        error: () => {
          this.isSending.set(false);
        },
      });
  }

  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  methodClass(method: HttpMethod): string {
    return `api-test__method--${method.toLowerCase()}`;
  }

  startCreateCollection(saveCurrent = false): void {
    this.saveIntoNewCollection = saveCurrent;
    this.creatingCollection.set(true);
    this.newCollectionName.set('');
    this.saveMenuOpen.set(false);
  }

  cancelCreateCollection(): void {
    this.creatingCollection.set(false);
    this.newCollectionName.set('');
    this.saveIntoNewCollection = false;
  }

  confirmCreateCollection(): void {
    const name = this.newCollectionName().trim() || 'New Collection';
    const shouldSave = this.saveIntoNewCollection;
    const collection: ApiCollection = {
      id: this.uid(),
      name,
      expanded: true,
      requests: [],
    };
    this.collections.update((list) => [collection, ...list]);
    this.activeCollectionId.set(collection.id);
    this.persistCollections();
    this.cancelCreateCollection();

    if (shouldSave) {
      this.saveAsNewInCollection(collection.id);
    }
  }

  toggleCollection(id: string): void {
    this.collections.update((list) =>
      list.map((c) => (c.id === id ? { ...c, expanded: !c.expanded } : c)),
    );
    this.persistCollections();
  }

  startRenameCollection(collection: ApiCollection, event: Event): void {
    event.stopPropagation();
    this.renamingCollectionId.set(collection.id);
    this.renameCollectionValue.set(collection.name);
  }

  cancelRenameCollection(): void {
    this.renamingCollectionId.set(null);
    this.renameCollectionValue.set('');
  }

  confirmRenameCollection(): void {
    const id = this.renamingCollectionId();
    if (!id) return;
    const name = this.renameCollectionValue().trim();
    if (!name) {
      this.cancelRenameCollection();
      return;
    }
    this.collections.update((list) =>
      list.map((c) => (c.id === id ? { ...c, name } : c)),
    );
    this.persistCollections();
    this.cancelRenameCollection();
  }

  deleteCollection(id: string, event: Event): void {
    event.stopPropagation();
    const target = this.collections().find((c) => c.id === id);
    if (!target) return;
    if (!confirm(`Delete collection "${target.name}" and all its requests?`)) return;

    this.collections.update((list) => list.filter((c) => c.id !== id));
    if (this.activeCollectionId() === id) {
      this.activeCollectionId.set(null);
      this.activeRequestId.set(null);
    }
    this.persistCollections();
  }

  addBlankRequestToCollection(collectionId: string, event: Event): void {
    event.stopPropagation();
    const request: CollectionRequest = {
      id: this.uid(),
      name: 'New Request',
      snapshot: this.blankSnapshot(),
      updatedAt: Date.now(),
    };
    this.collections.update((list) =>
      list.map((c) =>
        c.id === collectionId
          ? { ...c, expanded: true, requests: [request, ...c.requests] }
          : c,
      ),
    );
    this.persistCollections();
    this.loadRequest(collectionId, request.id);
  }

  openRequest(collectionId: string, requestId: string): void {
    this.loadRequest(collectionId, requestId);
  }

  deleteRequest(collectionId: string, requestId: string, event: Event): void {
    event.stopPropagation();
    const collection = this.collections().find((c) => c.id === collectionId);
    const request = collection?.requests.find((r) => r.id === requestId);
    if (!request) return;
    if (!confirm(`Delete request "${request.name}"?`)) return;

    this.collections.update((list) =>
      list.map((c) =>
        c.id === collectionId
          ? { ...c, requests: c.requests.filter((r) => r.id !== requestId) }
          : c,
      ),
    );
    if (this.activeRequestId() === requestId) {
      this.activeRequestId.set(null);
    }
    this.persistCollections();
  }

  toggleSaveMenu(): void {
    this.saveMenuOpen.update((open) => !open);
  }

  closeSaveMenu(): void {
    this.saveMenuOpen.set(false);
  }

  saveCurrentRequest(): void {
    const collectionId = this.activeCollectionId();
    const requestId = this.activeRequestId();
    if (collectionId && requestId) {
      this.updateExistingRequest(collectionId, requestId);
      return;
    }
    this.saveMenuOpen.set(true);
  }

  saveAsNewInCollection(collectionId: string): void {
    const name = this.requestName().trim() || this.suggestRequestName();
    const request: CollectionRequest = {
      id: this.uid(),
      name,
      snapshot: this.captureSnapshot(),
      updatedAt: Date.now(),
    };
    this.collections.update((list) =>
      list.map((c) =>
        c.id === collectionId
          ? { ...c, expanded: true, requests: [request, ...c.requests] }
          : c,
      ),
    );
    this.activeCollectionId.set(collectionId);
    this.activeRequestId.set(request.id);
    this.requestName.set(name);
    this.persistCollections();
    this.closeSaveMenu();
  }

  saveAsNewCollection(): void {
    this.closeSaveMenu();
    this.startCreateCollection(true);
  }

  newUntitledRequest(): void {
    this.activeCollectionId.set(null);
    this.activeRequestId.set(null);
    this.requestName.set('Untitled Request');
    this.applySnapshot(this.blankSnapshot());
    this.response.set(null);
    this.closeSaveMenu();
  }

  private updateExistingRequest(collectionId: string, requestId: string): void {
    const name = this.requestName().trim() || this.suggestRequestName();
    this.collections.update((list) =>
      list.map((c) => {
        if (c.id !== collectionId) return c;
        return {
          ...c,
          requests: c.requests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  name,
                  snapshot: this.captureSnapshot(),
                  updatedAt: Date.now(),
                }
              : r,
          ),
        };
      }),
    );
    this.requestName.set(name);
    this.persistCollections();
  }

  private loadRequest(collectionId: string, requestId: string): void {
    const collection = this.collections().find((c) => c.id === collectionId);
    const request = collection?.requests.find((r) => r.id === requestId);
    if (!collection || !request) return;

    this.activeCollectionId.set(collectionId);
    this.activeRequestId.set(requestId);
    this.requestName.set(request.name);
    this.applySnapshot(request.snapshot);
    this.response.set(null);
    this.closeSaveMenu();
  }

  private captureSnapshot(): SavedRequestSnapshot {
    return {
      method: this.method(),
      url: this.url(),
      params: this.cloneRows(this.params()),
      headers: this.cloneRows(this.headers()),
      bodyMode: this.bodyMode(),
      rawBody: this.rawBody(),
      formDataRows: this.cloneRows(this.formDataRows()),
      urlEncodedRows: this.cloneRows(this.urlEncodedRows()),
      authType: this.authType(),
      bearerToken: this.bearerToken(),
      basicUsername: this.basicUsername(),
      basicPassword: this.basicPassword(),
      apiKeyName: this.apiKeyName(),
      apiKeyValue: this.apiKeyValue(),
      apiKeyIn: this.apiKeyIn(),
    };
  }

  private applySnapshot(snapshot: SavedRequestSnapshot): void {
    this.method.set(snapshot.method);
    this.url.set(snapshot.url);
    this.params.set(this.rehydrateRows(snapshot.params));
    this.headers.set(this.rehydrateRows(snapshot.headers));
    this.bodyMode.set(snapshot.bodyMode);
    this.rawBody.set(snapshot.rawBody);
    this.formDataRows.set(this.rehydrateRows(snapshot.formDataRows));
    this.urlEncodedRows.set(this.rehydrateRows(snapshot.urlEncodedRows));
    this.authType.set(snapshot.authType);
    this.bearerToken.set(snapshot.bearerToken);
    this.basicUsername.set(snapshot.basicUsername);
    this.basicPassword.set(snapshot.basicPassword);
    this.apiKeyName.set(snapshot.apiKeyName);
    this.apiKeyValue.set(snapshot.apiKeyValue);
    this.apiKeyIn.set(snapshot.apiKeyIn);
  }

  private blankSnapshot(): SavedRequestSnapshot {
    return {
      method: 'GET',
      url: '',
      params: [this.createRow()],
      headers: [
        { ...this.createRow(), key: 'Accept', value: 'application/json', enabled: true },
        this.createRow(),
      ],
      bodyMode: 'none',
      rawBody: '{\n  \n}',
      formDataRows: [this.createRow()],
      urlEncodedRows: [this.createRow()],
      authType: 'none',
      bearerToken: '',
      basicUsername: '',
      basicPassword: '',
      apiKeyName: 'X-API-Key',
      apiKeyValue: '',
      apiKeyIn: 'header',
    };
  }

  private suggestRequestName(): string {
    const method = this.method();
    const url = this.url().trim();
    if (!url) return `${method} Request`;
    try {
      const path = new URL(url).pathname || '/';
      return `${method} ${path}`;
    } catch {
      return `${method} ${url.slice(0, 40)}`;
    }
  }

  private cloneRows(rows: KeyValueRow[]): KeyValueRow[] {
    return rows.map((r) => ({ ...r }));
  }

  private rehydrateRows(rows: KeyValueRow[] | undefined): KeyValueRow[] {
    if (!rows?.length) return [this.createRow()];
    return rows.map((r) => ({
      id: this.nextId++,
      enabled: !!r.enabled,
      key: r.key ?? '',
      value: r.value ?? '',
      description: r.description ?? '',
    }));
  }

  private loadCollections(): ApiCollection[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [this.defaultCollection()];
      const parsed = JSON.parse(raw) as ApiCollection[];
      if (!Array.isArray(parsed) || !parsed.length) return [this.defaultCollection()];
      return parsed.map((c) => ({
        id: String(c.id),
        name: c.name || 'Collection',
        expanded: c.expanded !== false,
        requests: Array.isArray(c.requests)
          ? c.requests.map((r) => ({
              id: String(r.id),
              name: r.name || 'Request',
              snapshot: r.snapshot,
              updatedAt: r.updatedAt || Date.now(),
            }))
          : [],
      }));
    } catch {
      return [this.defaultCollection()];
    }
  }

  private persistCollections(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.collections()));
  }

  private defaultCollection(): ApiCollection {
    return {
      id: this.uid(),
      name: 'My Collection',
      expanded: true,
      requests: [],
    };
  }

  private uid(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private createRow(): KeyValueRow {
    return {
      id: this.nextId++,
      enabled: true,
      key: '',
      value: '',
      description: '',
    };
  }
}
