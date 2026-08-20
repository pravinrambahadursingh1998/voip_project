import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiFunction } from './ai-function';

describe('AiFunction', () => {
  let component: AiFunction;
  let fixture: ComponentFixture<AiFunction>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiFunction],
    }).compileComponents();

    fixture = TestBed.createComponent(AiFunction);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
