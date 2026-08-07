import DashboardLayout from '../components/DashboardLayout';

export default function DashboardLoading() {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400" />
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
