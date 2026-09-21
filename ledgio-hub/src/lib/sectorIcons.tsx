import {
  ShoppingCart,
  Building2,
  GraduationCap,
  Heart,
  Pill,
  Factory,
  Briefcase,
  Hotel,
  HardHat,
  Package,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  retail: ShoppingCart,
  enterprise: Building2,
  schools: GraduationCap,
  'churches-ngos': Heart,
  pharmacy: Pill,
  manufacturing: Factory,
  'professional-services': Briefcase,
  hospitality: Hotel,
  construction: HardHat,
  wholesale: Package,
};

interface SectorIconProps extends LucideProps {
  slug: string;
}

export function SectorIcon({ slug, ...props }: SectorIconProps) {
  const Icon = ICON_MAP[slug] ?? Briefcase;
  return <Icon {...props} />;
}
