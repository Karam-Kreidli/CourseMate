'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { EyeIcon, EyeOffIcon } from '@/components/Icons';
import styles from '../auth.module.css';

const RESEND_WAIT_S = 60;

// Ways in, from the reset email (api/auth/forgot-password):
//   ?email=...               after "Send Code": type the code from the email
//   ?token_hash=...&email=   the email's button
// The token is only spent when the new password is submitted, so a mail
// scanner opening the link first costs nothing, and neither needs the browser
// that asked for the email.
//   ?code=...                links Supabase sent before this page changed
export default function ResetPasswordPage() {
    // 'loading' | 'code' | 'link' | 'session' | 'none'
    const [mode, setMode] = useState('loading');
    const [email, setEmail] = useState('');
    const [tokenHash, setTokenHash] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    // Once a code or link is accepted it's spent, so a retry after a rejected
    // password (too short, same as before) must not verify again.
    const [verified, setVerified] = useState(false);
    const [resendIn, setResendIn] = useState(RESEND_WAIT_S);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        (async () => {
            const params = new URLSearchParams(window.location.search);
            const hash = params.get('token_hash');
            const addr = params.get('email') || '';
            const code = params.get('code');
            setEmail(addr);

            if (hash) {
                setTokenHash(hash);
                setMode('link');
                return;
            }
            if (addr) {
                setMode('code');
                return;
            }
            if (code) {
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                window.history.replaceState({}, '', '/auth/reset-password');
                if (!error) {
                    setVerified(true);
                    setMode('session');
                    return;
                }
            }
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setVerified(true);
                setMode('session');
            } else {
                setMode('none');
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Counts down to when "Send a new code" unlocks; the server won't send
    // more than one a minute anyway.
    useEffect(() => {
        if (mode !== 'code' || resendIn <= 0) return;
        const t = setTimeout(() => setResendIn(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [mode, resendIn]);

    const resend = async () => {
        setError('');
        setNotice('');
        setResendIn(RESEND_WAIT_S);
        const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        if (res.ok) {
            setOtp('');
            setNotice('We sent a new code. Only the newest one works.');
        } else {
            const body = await res.json().catch(() => ({}));
            setError(body.error || 'Could not send the email. Try again.');
        }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        setError('');
        setNotice('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            if (!verified) {
                const { error } = mode === 'link'
                    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
                    : await supabase.auth.verifyOtp({ email, token: otp.trim(), type: 'recovery' });
                if (error) {
                    if (mode === 'link') {
                        // Fall back to the code, which the same email carries.
                        setMode(email ? 'code' : 'none');
                        setResendIn(0);
                        throw new Error('This link has expired or was already used. Enter the code from your newest reset email, or send a new one.');
                    }
                    throw new Error('That code is wrong or has expired. Use the code from your newest reset email, or send a new one.');
                }
                setVerified(true);
            }

            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            setSuccess(true);
            setTimeout(() => {
                router.push('/');
                router.refresh();
            }, 2000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const header = (subtitle) => (
        <div className={styles.logoWrapper}>
            <div className={styles.logoFrame}>
                <Image src="/logo.png" alt="CourseMate" width={256} height={256} className={styles.logo} />
            </div>
            <h1 className={styles.title}>CourseMate</h1>
            <p className={styles.subtitle}>{subtitle}</p>
        </div>
    );

    if (mode === 'loading') {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    {header('Reset your password')}
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                        <span className={styles.spinner} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                {header('Reset your password')}

                {success ? (
                    <div className={styles.resetSentMessage}>
                        <div className={styles.resetSentTitle}>Password updated</div>
                        <div className={styles.resetSentText}>
                            Your password has been reset successfully. Redirecting...
                        </div>
                    </div>
                ) : mode === 'none' ? (
                    <div className={styles.resetSentMessage}>
                        <div className={styles.error}>
                            {error || 'This reset link has expired. Use "Forgot Password?" on the sign-in page to get a new code.'}
                        </div>
                        <button
                            type="button"
                            className={styles.submitBtn}
                            onClick={() => router.push('/auth')}
                            style={{ marginTop: '16px' }}
                        >
                            Back to Sign In
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleReset} className={styles.form}>
                        {mode === 'code' && (
                            <>
                                <div className={styles.resetSentText} style={{ marginBottom: '16px' }}>
                                    If <strong>{email}</strong> has an account, we sent it a code. It can take a minute, and may land in junk.
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Code from the email</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                        className={styles.input}
                                        placeholder="123456"
                                        maxLength={10}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </>
                        )}

                        <div className={styles.formGroup}>
                            <label className={styles.label}>New Password</label>
                            <div className={styles.passwordWrapper}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`${styles.input} ${styles.inputPassword}`}
                                    placeholder="Enter new password"
                                    autoComplete="new-password"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className={styles.passwordToggle}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeIcon width={20} height={20} /> : <EyeOffIcon width={20} height={20} />}
                                </button>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Confirm Password</label>
                            <div className={styles.passwordWrapper}>
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={`${styles.input} ${styles.inputPassword}`}
                                    placeholder="Confirm new password"
                                    autoComplete="new-password"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className={styles.passwordToggle}
                                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                    tabIndex={-1}
                                >
                                    {showConfirmPassword ? <EyeIcon width={20} height={20} /> : <EyeOffIcon width={20} height={20} />}
                                </button>
                            </div>
                        </div>

                        {notice && <div className={styles.resetSentText}>{notice}</div>}
                        {error && <div className={styles.error}>{error}</div>}

                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? <span className={styles.spinner} /> : 'Reset Password'}
                        </button>

                        {mode === 'code' && (
                            <div className={styles.toggle} style={{ marginTop: '8px' }}>
                                <button type="button" onClick={resend} className={styles.toggleBtn} disabled={loading || resendIn > 0}>
                                    {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
                                </button>
                            </div>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
}
