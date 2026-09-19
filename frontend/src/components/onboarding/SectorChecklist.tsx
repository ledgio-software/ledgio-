import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SECTOR_CHECKLISTS } from '../../constants/sectorChecklists';
import type { ChecklistStep } from '../../constants/sectorChecklists';
import { api } from '../../lib/api';

const STORAGE_KEY = 'ledgio_sector_checklist_dismissed';
const VISITED_KEY = 'ledgio_sector_checklist_visited';

function getVisited(): Set<string> {
  try {
    const raw = localStorage.getItem(VISITED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveVisited(visited: Set<string>): void {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify(Array.from(visited)));
  } catch {
    // ignore
  }
}

function getDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export const SectorChecklist: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const orgType = (user as any)?.orgType ?? 'BUSINESS';
  const checklist = SECTOR_CHECKLISTS[orgType] ?? SECTOR_CHECKLISTS['BUSINESS'];

  const [dismissed, setDismissed] = useState(getDismissed);
  const [collapsed, setCollapsed] = useState(false);
  const [visited, setVisited] = useState<Set<string>>(getVisited);

  // Auto-tick the current route
  React.useEffect(() => {
    const matched = checklist.steps.find(s => location.pathname.startsWith(s.route));
    if (matched && !visited.has(matched.id)) {
      const next = new Set(visited);
      next.add(matched.id);
      setVisited(next);
      saveVisited(next);
    }
  }, [location.pathname, checklist.steps, visited]);

  const handleDismiss = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
    setDismissed(true);
  }, []);

  const handleStepClick = useCallback((step: ChecklistStep) => {
    const next = new Set(visited);
    next.add(step.id);
    setVisited(next);
    saveVisited(next);
    navigate(step.route);
  }, [visited, navigate]);

  const handleDownloadGuide = useCallback(async () => {
    try {
      const response = await api.get('/onboarding/quick-start-guide', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Ledgio_Quick_Start_Guide.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore download errors
    }
  }, []);

  if (dismissed) return null;

  const completedCount = checklist.steps.filter(s => visited.has(s.id)).length;
  const total = checklist.steps.length;
  const allDone = completedCount === total;

  return (
    <div className="mx-4 mb-3 rounded-lg border border-emerald-200 bg-emerald-50 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            {checklist.title}
          </span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200">
            {completedCount}/{total}
          </span>
          {allDone && (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
              Complete!
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownloadGuide}
            className="rounded p-1 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-800"
            title="Download Quick Start Guide"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="rounded p-1 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-800"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            onClick={handleDismiss}
            className="rounded p-1 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-800"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="mx-4 mb-1 h-1.5 overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(completedCount / total) * 100}%` }}
            />
          </div>
          <ul className="divide-y divide-emerald-100 pb-2 dark:divide-emerald-800/50">
            {checklist.steps.map((step) => {
              const done = visited.has(step.id);
              return (
                <li key={step.id}>
                  <button
                    onClick={() => handleStepClick(step)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40"
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                    )}
                    <span className={`text-sm ${done ? 'text-emerald-700 line-through opacity-70 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-200'}`}>
                      {step.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

export default SectorChecklist;
