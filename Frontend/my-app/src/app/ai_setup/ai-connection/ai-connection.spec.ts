import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiConnection } from './ai-connection';

describe('AiConnection', () => {
  let component: AiConnection;
  let fixture: ComponentFixture<AiConnection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiConnection],
    }).compileComponents();

    fixture = TestBed.createComponent(AiConnection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
