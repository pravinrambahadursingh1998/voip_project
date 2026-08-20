import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApiTest } from './api-test';

describe('ApiTest', () => {
  let component: ApiTest;
  let fixture: ComponentFixture<ApiTest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApiTest],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ApiTest);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
