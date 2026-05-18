'use client';

import { useState } from 'react';
import Link from 'next/link';
import scheduleStyles from '../schedule/schedule.module.css';

export default function DesignMockups() {
    const [activeOption, setActiveOption] = useState(1);

    return (
        <div style={{ minHeight: '100vh', background: 'var(--auth-bg)', color: 'var(--text-primary)', padding: '40px 20px' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>Instructor Search Access - Design Options</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Select an option below to see how it integrates into the Schedule page.</p>
                    
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
                        {[1, 2, 3].map(opt => (
                            <button 
                                key={opt}
                                onClick={() => setActiveOption(opt)}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    background: activeOption === opt ? 'var(--color-accent)' : 'var(--bg-secondary)',
                                    color: activeOption === opt ? '#fff' : 'var(--text-primary)',
                                    border: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Option {opt}
                            </button>
                        ))}
                    </div>
                </div>

                {/* The Mockup Display */}
                <div style={{ 
                    border: '1px solid var(--glass-border)', 
                    borderRadius: '24px', 
                    overflow: 'hidden',
                    position: 'relative',
                    background: 'var(--auth-bg)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}>
                    <div className={scheduleStyles.pageInner} style={{ margin: '0 auto', pointerEvents: 'none' }}>
                        
                        {/* Option 2: Header Button */}
                        <header className={scheduleStyles.header} style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h1>Schedule Builder</h1>
                                {activeOption === 2 && (
                                    <span style={{ 
                                        padding: '6px 12px', 
                                        background: 'var(--bg-tertiary)', 
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '20px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        color: 'var(--text-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        cursor: 'pointer'
                                    }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>
                                        Find Instructor
                                    </span>
                                )}
                            </div>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-secondary)' }}></div>
                        </header>

                        {/* Option 1: Segmented Control Tabs */}
                        {activeOption === 1 && (
                            <div style={{ 
                                display: 'flex', 
                                background: 'var(--glass-bg-dense)', 
                                padding: '6px', 
                                borderRadius: '16px',
                                marginBottom: '16px',
                                border: '1px solid var(--glass-border)'
                            }}>
                                <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'var(--bg-elevated)', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 'bold', border: '1px solid var(--border-color)' }}>
                                    Student
                                </div>
                                <div style={{ flex: 1, textAlign: 'center', padding: '10px', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 'bold' }}>
                                    Instructor
                                </div>
                            </div>
                        )}

                        <main className={scheduleStyles.main}>
                            <div className={scheduleStyles.card}>
                                <div className={scheduleStyles.section}>
                                    <span className={scheduleStyles.sectionTitle}>Add Courses</span>
                                    <div className={scheduleStyles.searchWrapper}>
                                        <input className={scheduleStyles.input} placeholder="Search course code..." readOnly />
                                    </div>
                                    
                                    <div className={scheduleStyles.basketButtons}>
                                        <button className={scheduleStyles.basketBtn}>+ Group 1 Elective</button>
                                        <button className={scheduleStyles.basketBtn}>+ Group 2 Elective</button>
                                    </div>

                                    {/* Option 3: Card Banner / Action */}
                                    {activeOption === 3 && (
                                        <div style={{ 
                                            marginTop: '16px', 
                                            padding: '16px', 
                                            background: 'var(--bg-secondary)', 
                                            borderRadius: '12px',
                                            border: '1px dashed var(--border-color)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Looking for a specific instructor?</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Search their schedule across all courses</div>
                                            </div>
                                            <button style={{ 
                                                padding: '8px 16px', 
                                                background: 'transparent',
                                                border: '1.5px solid var(--color-accent)',
                                                borderRadius: '8px',
                                                color: 'var(--color-accent)',
                                                fontWeight: 'bold',
                                                fontSize: '0.75rem'
                                            }}>
                                                Search Instructors
                                            </button>
                                        </div>
                                    )}

                                </div>
                            </div>
                            <button className={scheduleStyles.generateBtn}>Generate Schedules</button>
                        </main>
                    </div>
                </div>

                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    <p><strong>Option 1:</strong> A top-level toggle switch. Best if "Instructor Schedule" is treated as a peer to "Student Schedule".</p>
                    <p><strong>Option 2:</strong> A compact button in the header. Subtle, doesn't clutter the main card.</p>
                    <p><strong>Option 3:</strong> A call-to-action banner inside the course search card. Highly visible, contextual to "searching".</p>
                </div>
            </div>
        </div>
    );
}
