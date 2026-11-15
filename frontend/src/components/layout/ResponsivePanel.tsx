import { useEffect, useState, type ReactNode } from 'react';
import { Search, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
export function ResponsivePanel({ children, title, kind }: { children: ReactNode; title: string; kind: 'search' | 'results' }) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const update = () => setCompact(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  if (!compact) return children;
  return <div className={`mobile-panel-trigger ${kind}`}><Sheet><SheetTrigger asChild><Button variant="outline" className="w-full">{kind === 'search' ? <Search/> : <ListFilter/>}{title}</Button></SheetTrigger><SheetContent side="bottom" className="mobile-drawer"><SheetTitle>{title}</SheetTitle><SheetDescription className="mb-5 text-xs">Coordinates, filters, and results.</SheetDescription>{children}</SheetContent></Sheet></div>;
}