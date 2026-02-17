import { useLocation } from 'wouter';
import { LayoutDashboard, FileText, TrendingUp, PieChart, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'สุขภาพวันนี้', path: '/dashboard' },
    { icon: FileText, label: 'บันทึก', path: '/records' },
    { icon: TrendingUp, label: 'แนวโน้ม', path: '/trends' },
    { icon: PieChart, label: 'รายงาน', path: '/reports' },
    { icon: Settings, label: 'ตั้งค่า', path: '/settings' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border py-2 px-4 pb-6 z-50">
      <div className="max-w-md mx-auto flex justify-between items-center">
        {navItems.map((item) => {
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={cn(
                'flex flex-col items-center gap-1 min-w-[60px] relative',
                isActive ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon
                className={cn(
                  'w-6 h-6 transition-all duration-200',
                  isActive && 'scale-110 stroke-[2.5px]'
                )}
              />
              <span
                className={cn(
                  'text-xs font-medium transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
              {isActive && (
                <div className="h-1 w-8 bg-accent rounded-full mt-1 absolute -bottom-2" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
