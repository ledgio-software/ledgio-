import { createContext, useContext } from 'react';

interface OnboardingContextType {
  open: (sectorSlug?: string) => void;
}

export const OnboardingContext = createContext<OnboardingContextType>({ open: () => {} });
export const useOnboarding = () => useContext(OnboardingContext);
