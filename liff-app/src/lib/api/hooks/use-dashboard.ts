import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

// Types for dashboard data
export interface DashboardSummary {
  streak: number;
  todayTasks: {
    total: number;
    completed: number;
    items: Array<{
      id: string;
      label: string;
      done: boolean;
      time?: string;
      sub?: string;
    }>;
  };
  latestVitals: {
    bp_systolic: number | null;
    bp_diastolic: number | null;
    bp_change: number | null;
    sleep_hours: number | null;
    sleep_change: number | null;
    weight: number | null;
    weight_change: number | null;
  };
  aiInsight: {
    title: string;
    message: string;
    icon: string;
  } | null;
}

export interface PatientInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  chronic_diseases: string[];
}

export interface GroupDashboardData {
  group: {
    id: string;
    group_name: string | null;
  };
  activePatient: PatientInfo | null;
  patients: PatientInfo[];
  summary: DashboardSummary;
}

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (patientId: string) => [...dashboardKeys.all, 'summary', patientId] as const,
  groupDashboard: (groupId: string) => [...dashboardKeys.all, 'group', groupId] as const,
};

// Fetch dashboard summary for a patient
export function useDashboardSummary(patientId: string | null) {
  return useQuery({
    queryKey: patientId ? dashboardKeys.summary(patientId) : ['dashboard', 'summary', 'none'],
    queryFn: async (): Promise<DashboardSummary> => {
      if (!patientId) {
        // Return mock data when no patient ID
        return getMockDashboardSummary();
      }
      try {
        const data = await apiClient.get<DashboardSummary>(`/dashboard/summary/${patientId}`);
        return data;
      } catch {
        // Return mock data on API error (for development)
        console.warn('Dashboard API not available, using mock data');
        return getMockDashboardSummary();
      }
    },
    enabled: true, // Always enabled, uses mock data as fallback
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

// Fetch group dashboard data
export function useGroupDashboard(groupId: string | null) {
  return useQuery({
    queryKey: groupId ? dashboardKeys.groupDashboard(groupId) : ['dashboard', 'group', 'none'],
    queryFn: async (): Promise<GroupDashboardData> => {
      if (!groupId) {
        throw new Error('Group ID is required');
      }
      try {
        const data = await apiClient.get<GroupDashboardData>(`/dashboard/group/${groupId}`);
        return data;
      } catch {
        // Return mock data on API error (for development)
        console.warn('Group Dashboard API not available, using mock data');
        return getMockGroupDashboardData();
      }
    },
    enabled: !!groupId,
    staleTime: 30 * 1000,
  });
}

// Mock data for development
function getMockDashboardSummary(): DashboardSummary {
  return {
    streak: 5,
    todayTasks: {
      total: 4,
      completed: 2,
      items: [
        { id: '1', label: 'กินยาเช้า', done: true, time: '08:00' },
        { id: '2', label: 'วัดความดัน', done: true, time: '08:30' },
        { id: '3', label: 'ดื่มน้ำ 6 แก้ว', done: false, sub: 'เหลือ 3 แก้ว' },
        { id: '4', label: 'เดิน 15 นาที', done: false, sub: 'เย็นนี้' },
      ],
    },
    latestVitals: {
      bp_systolic: 122,
      bp_diastolic: 80,
      bp_change: -5,
      sleep_hours: 6.5,
      sleep_change: -1.2,
      weight: 64.2,
      weight_change: -0.3,
    },
    aiInsight: {
      title: 'อุ่นใจแนะนำ',
      message: 'เมื่อคืนคุณนอนน้อย ลองพักสายตา 10 นาทีช่วงบ่ายนะคะ',
      icon: 'moon',
    },
  };
}

function getMockGroupDashboardData(): GroupDashboardData {
  return {
    group: {
      id: 'mock-group-id',
      group_name: 'กลุ่มครอบครัว',
    },
    activePatient: {
      id: 'mock-patient-id',
      first_name: 'สมศรี',
      last_name: 'ใจดี',
      nickname: 'คุณแม่',
      chronic_diseases: ['ความดันโลหิตสูง', 'เบาหวาน'],
    },
    patients: [
      {
        id: 'mock-patient-id',
        first_name: 'สมศรี',
        last_name: 'ใจดี',
        nickname: 'คุณแม่',
        chronic_diseases: ['ความดันโลหิตสูง', 'เบาหวาน'],
      },
    ],
    summary: getMockDashboardSummary(),
  };
}
