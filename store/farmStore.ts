import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FarmState {
    farmName: string;
    houseCount: number;
    setFarmName: (name: string) => void;
    setHouseCount: (count: number) => void;
}

export const useFarmStore = create<FarmState>()(
    persist(
        (set) => ({
            farmName: '행복 농장', // 기본값
            houseCount: 12, // 기본값
            setFarmName: (name) => set({ farmName: name }),
            setHouseCount: (count) => set({ houseCount: count }),
        }),
        {
            name: 'farm-storage', // localStorage key
        }
    )
);
