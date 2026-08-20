import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddEditGateway } from './add-edit-gateway';

describe('AddEditGateway', () => {
  let component: AddEditGateway;
  let fixture: ComponentFixture<AddEditGateway>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddEditGateway],
    }).compileComponents();

    fixture = TestBed.createComponent(AddEditGateway);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
