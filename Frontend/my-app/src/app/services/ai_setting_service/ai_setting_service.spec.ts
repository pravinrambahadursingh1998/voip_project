import { TestBed } from '@angular/core/testing';

import { AiSettingService } from './ai_setting_service';

describe('AiSettingService', () => {
  let service: AiSettingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AiSettingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
