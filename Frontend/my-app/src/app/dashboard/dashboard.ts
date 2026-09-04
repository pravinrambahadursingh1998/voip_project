import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GatewayService } from '../services/gateway_service/gateway';

export interface DashboardGateway {
  name: string;
  realm: string;
  status: 'Connected' | 'Standby' | 'Attention' | 'Unregistered';
  ping: string;
  activeChannels: string;
  type: string;
}

export interface DashboardCall {
  id: string;
  caller: string;
  direction: 'inbound' | 'outbound';
  gateway: string;
  agent: string;
  duration: string;
  status: 'active' | 'completed' | 'transferred';
  mos: number;
  time: string;
}

export interface AiServiceItem {
  name: string;
  category: string;
  model: string;
  latency: string;
  status: 'operational' | 'degraded' | 'offline';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  private readonly gatewayService = inject(GatewayService);

  readonly timeRange = signal<'today' | 'week' | 'month'>('today');
  readonly isRefreshing = signal<boolean>(false);
  readonly callFilter = signal<'all' | 'active' | 'completed' | 'transferred'>('all');

  // KPI Metrics
  readonly activeCalls = signal<number>(18);
  readonly peakCalls = signal<number>(64);
  readonly onlineGateways = signal<number>(6);
  readonly totalGateways = signal<number>(8);
  readonly standbyGateways = signal<number>(1);
  readonly attentionGateways = signal<number>(1);
  readonly aiResolutionRate = signal<number>(86.4);
  readonly avgLatencyMs = signal<number>(340);
  readonly totalCallsToday = signal<number>(1284);
  readonly completedCalls = signal<number>(1192);

  // Hourly Traffic Trends
  readonly trafficHours = [
    { time: '08:00', total: 42, ai: 35, height: 35 },
    { time: '10:00', total: 98, ai: 84, height: 75 },
    { time: '12:00', total: 124, ai: 108, height: 95 },
    { time: '14:00', total: 110, ai: 96, height: 85 },
    { time: '16:00', total: 85, ai: 72, height: 68 },
    { time: '18:00', total: 64, ai: 53, height: 50 },
    { time: '20:00', total: 38, ai: 31, height: 30 },
  ];

  // Gateways List
  readonly gateways = signal<DashboardGateway[]>([
    {
      name: 'US-East-Primary',
      realm: 'sip.us1.twilio.com',
      status: 'Connected',
      ping: '24ms',
      activeChannels: '7/30',
      type: 'SIP Trunk',
    },
    {
      name: 'EU-Frankfurt-Carrier',
      realm: 'carrier.eu.telnyx.com',
      status: 'Connected',
      ping: '38ms',
      activeChannels: '5/20',
      type: 'Direct PBX',
    },
    {
      name: 'Asia-Pacific-Backup',
      realm: 'sip-sg.voxbone.com',
      status: 'Standby',
      ping: '118ms',
      activeChannels: '0/15',
      type: 'Backup Trunk',
    },
    {
      name: 'FreeSWITCH-Core-PBX',
      realm: '127.0.0.1:5060 (ESL)',
      status: 'Connected',
      ping: '<1ms',
      activeChannels: '6/50',
      type: 'Internal Core',
    },
    {
      name: 'Legacy-Asterisk-Link',
      realm: 'sip.legacy.corp:5080',
      status: 'Attention',
      ping: 'Timeout',
      activeChannels: '0/10',
      type: 'Intercom',
    },
  ]);

  // Real-time Calls Feed
  readonly recentCalls = signal<DashboardCall[]>([
    {
      id: 'CALL-9041',
      caller: '+1 (555) 234-8910',
      direction: 'inbound',
      gateway: 'US-East-Primary',
      agent: 'AI Support Agent v2',
      duration: '03:14',
      status: 'active',
      mos: 4.4,
      time: 'Just now',
    },
    {
      id: 'CALL-9040',
      caller: '+44 20 7946 0192',
      direction: 'inbound',
      gateway: 'EU-Frankfurt-Carrier',
      agent: 'AI Receptionist',
      duration: '01:45',
      status: 'completed',
      mos: 4.2,
      time: '4m ago',
    },
    {
      id: 'CALL-9039',
      caller: 'Ext 104 (Sales)',
      direction: 'outbound',
      gateway: 'FreeSWITCH-Core-PBX',
      agent: 'Voice Escalation',
      duration: '08:22',
      status: 'transferred',
      mos: 4.5,
      time: '11m ago',
    },
    {
      id: 'CALL-9038',
      caller: '+1 (415) 889-1029',
      direction: 'inbound',
      gateway: 'US-East-Primary',
      agent: 'Appointment Booking Bot',
      duration: '02:08',
      status: 'completed',
      mos: 4.3,
      time: '18m ago',
    },
    {
      id: 'CALL-9037',
      caller: '+1 (212) 670-3491',
      direction: 'inbound',
      gateway: 'US-East-Primary',
      agent: 'AI Lead Qualifier',
      duration: '04:51',
      status: 'completed',
      mos: 4.1,
      time: '25m ago',
    },
  ]);

  // Connected AI Engines
  readonly aiEngines: AiServiceItem[] = [
    {
      name: 'OpenAI Realtime API',
      category: 'LLM & Reasoning',
      model: 'gpt-4o-realtime-preview',
      latency: '280ms',
      status: 'operational',
    },
    {
      name: 'Deepgram Nova-2',
      category: 'Speech-to-Text (STT)',
      model: 'nova-2-telephony',
      latency: '110ms',
      status: 'operational',
    },
    {
      name: 'ElevenLabs Voice Engine',
      category: 'Text-to-Speech (TTS)',
      model: 'turbo-v2.5-hd',
      latency: '145ms',
      status: 'operational',
    },
  ];

  ngOnInit(): void {
    this.fetchLiveGateways();
  }

  fetchLiveGateways(): void {
    try {
      this.gatewayService.getGatewayStatusList().subscribe({
        next: (res: any) => {
          if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
            const list = res.data;
            this.totalGateways.set(list.length);
            const connected = list.filter((g: any) =>
              /connected|reged|online/i.test(g.gateway_status || g.status || '')
            ).length;
            const attention = list.filter((g: any) =>
              /failed|error|attention/i.test(g.gateway_status || g.status || '')
            ).length;
            const standby = list.length - connected - attention;

            this.onlineGateways.set(connected || this.onlineGateways());
            this.attentionGateways.set(attention);
            this.standbyGateways.set(standby > 0 ? standby : 0);
          }
        },
        error: () => {
          // Gracefully keep high-fidelity defaults if server is starting or idle
        },
      });
    } catch {
      // safe fallback
    }
  }

  setTimeRange(range: 'today' | 'week' | 'month'): void {
    this.timeRange.set(range);
    this.simulateMetricRefresh();
  }

  setCallFilter(filter: 'all' | 'active' | 'completed' | 'transferred'): void {
    this.callFilter.set(filter);
  }

  get filteredCalls(): DashboardCall[] {
    const f = this.callFilter();
    if (f === 'all') return this.recentCalls();
    return this.recentCalls().filter((call) => call.status === f);
  }

  refreshData(): void {
    this.isRefreshing.set(true);
    this.fetchLiveGateways();
    setTimeout(() => {
      this.isRefreshing.set(false);
    }, 600);
  }

  private simulateMetricRefresh(): void {
    this.isRefreshing.set(true);
    setTimeout(() => {
      if (this.timeRange() === 'week') {
        this.totalCallsToday.set(8920);
        this.completedCalls.set(8410);
      } else if (this.timeRange() === 'month') {
        this.totalCallsToday.set(38450);
        this.completedCalls.set(36210);
      } else {
        this.totalCallsToday.set(1284);
        this.completedCalls.set(1192);
      }
      this.isRefreshing.set(false);
    }, 300);
  }

  getGatewayStatusBadge(status: string): string {
    switch (status.toLowerCase()) {
      case 'connected':
        return 'dash-badge--success';
      case 'standby':
        return 'dash-badge--warning';
      case 'attention':
        return 'dash-badge--danger';
      default:
        return 'dash-badge--neutral';
    }
  }

  getCallStatusBadge(status: string): string {
    switch (status.toLowerCase()) {
      case 'active':
        return 'dash-badge--live';
      case 'completed':
        return 'dash-badge--success-soft';
      case 'transferred':
        return 'dash-badge--purple';
      default:
        return 'dash-badge--neutral';
    }
  }
}
