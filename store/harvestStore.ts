import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface HarvestState {
    activeTab: 'harvest' | 'statistics';
    setActiveTab: (tab: 'harvest' | 'statistics') => void;
    resetTab: () => void;
}

export const useHarvestStore = create<HarvestState>()(
    persist(
        (set) => ({
            activeTab: 'harvest',
            setActiveTab: (tab) => set({ activeTab: tab }),
            resetTab: () => set({ activeTab: 'harvest' }),
        }),
        {
            name: 'harvest-storage', // localStorage key
        }
    )
);
