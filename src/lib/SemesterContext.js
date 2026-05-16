'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const SemesterContext = createContext(null);

export function SemesterProvider({ children }) {
    const [semesters, setSemesters] = useState([]);
    const [selectedTerm, setSelectedTermState] = useState(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        fetchSemesters();
    }, []);

    const fetchSemesters = async () => {
        const { data, error } = await supabase
            .from('semesters')
            .select('term_code, name')
            .eq('is_active', true)
            .order('term_code');

        if (error || !data || data.length === 0) {
            // Fallback: no semesters table yet or no active semesters
            setSemesters([]);
            setSelectedTermState(null);
            setLoading(false);
            return;
        }

        setSemesters(data);

        // Restore from localStorage if still valid
        const stored = localStorage.getItem('selectedTerm');
        const validCodes = data.map(s => s.term_code);

        if (stored && validCodes.includes(stored)) {
            setSelectedTermState(stored);
        } else {
            // Default to first active semester
            setSelectedTermState(data[0].term_code);
            localStorage.setItem('selectedTerm', data[0].term_code);
        }

        setLoading(false);
    };

    const setSelectedTerm = (termCode) => {
        setSelectedTermState(termCode);
        localStorage.setItem('selectedTerm', termCode);
    };

    const isSingleSemester = semesters.length <= 1;

    return (
        <SemesterContext.Provider value={{
            semesters,
            selectedTerm,
            setSelectedTerm,
            isSingleSemester,
            loading
        }}>
            {children}
        </SemesterContext.Provider>
    );
}

export function useSemester() {
    const ctx = useContext(SemesterContext);
    if (!ctx) {
        // Graceful fallback if context is not available (e.g., during SSR)
        return {
            semesters: [],
            selectedTerm: null,
            setSelectedTerm: () => {},
            isSingleSemester: true,
            loading: true
        };
    }
    return ctx;
}

// Wrapper component for use in server component layout.js
export function SemesterProviderWrapper({ children }) {
    return <SemesterProvider>{children}</SemesterProvider>;
}

