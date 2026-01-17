
"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { FileText, ArrowRight, Loader2, CheckCircle, Upload, AlertCircle, Award, Building, Briefcase, Construction } from "lucide-react";
import Footer from "@/components/Footer";
import Modal from "@/components/Modal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

interface ResumeScore {
    id: string;
    resume_name: string;
    total_score: number;
    created_at: string;
}

export default function Home() {
    const { user, loading: authLoading } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loadingStep, setLoadingStep] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Resume Limit & History
    const [canUpload, setCanUpload] = useState(true);
    const [checkingEligibility, setCheckingEligibility] = useState(true);
    const [scoreHistory, setScoreHistory] = useState<ResumeScore[]>([]);

    const LOADING_STEPS = [
        "Uploading Resume...",
        "Parsing PDF...",
        "Extracting Text...",
        "Cleaning & Normalizing Data...",
        "Identifying Sections...",
        "Extracting Skills...",
        "Detecting Experience & Projects...",
        "Generating Resume Embeddings...",
        "Matching Skills with Job Roles...",
        "Analyzing ATS Keywords...",
        "Checking Resume Strength...",
        "Predicting Role Fit Score...",
        "Finding Strong-Match Jobs...",
        "Analyzing Career Trends...",
        "Building Skill Gap Report...",
        "Finalizing AI Insights..."
    ];


    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (loading) {
            setLoadingStep(0);
            interval = setInterval(() => {
                setLoadingStep((prev) => {
                    // Once we reach the end, cycle back to "Analyzing Content..." (index 2)
                    // This prevents "Uploading..." (0) and "Parsing PDF..." (1) from showing again
                    if (prev === LOADING_STEPS.length - 1) {
                        return 2;
                    }
                    return prev + 1;
                });
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [loading]);

    useEffect(() => {
        if (authLoading) return;

        if (user) {
            checkEligibility();
            fetchScoreHistory();
        } else {
            setCheckingEligibility(false);
        }
    }, [user, authLoading]);

    const checkEligibility = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('last_resume_upload_at')
                .eq('id', user.id)
                .single();

            if (data?.last_resume_upload_at) {
                const lastUpload = new Date(data.last_resume_upload_at);
                const today = new Date();

                if (lastUpload.toDateString() === today.toDateString()) {
                    setCanUpload(false);
                    setError("You have reached your daily resume upload limit. Please try again tomorrow.");
                } else {
                    setCanUpload(true);
                }
            }
        } catch (err) {
            console.error("Error checking upload eligibility:", err);
        } finally {
            setCheckingEligibility(false);
        }
    };

    const fetchScoreHistory = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('resume_scores')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(3);

            if (data) {
                setScoreHistory(data);
            }
        } catch (err) {
            console.error("Error fetching resume history:", err);
        }
    };

    const router = useRouter();

    const handleMatchJobs = () => {
        setIsModalOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        if (!canUpload) {
            setError("You have reached your daily resume upload limit.");
            return;
        }

        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            // Use environment variable or default to local open-resume instance
            // Note: In production, ensure this URL points to your deployed Render service
            const apiUrl = process.env.NEXT_PUBLIC_RESUME_PARSER_URL || "http://localhost:3000/api/parser";

            const response = await fetch(apiUrl, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                // Try to get error details from JSON response
                let errorDetails = "Failed to parse resume";
                try {
                    const errorJson = await response.json();
                    if (errorJson.error) errorDetails = errorJson.error;
                    if (errorJson.details) errorDetails += `: ${errorJson.details}`;
                } catch (e) {
                    // Ignore json parse error
                }
                throw new Error(errorDetails);
            }

            const data = await response.json();
            setResult(data);

            // Supabase Tracking
            if (user) {
                // Update profile last upload time
                await supabase
                    .from('profiles')
                    .update({ last_resume_upload_at: new Date().toISOString() })
                    .eq('id', user.id);

                // Save score
                if (data.score && typeof data.score.totalScore === 'number') {
                    await supabase.from('resume_scores').insert({
                        user_id: user.id,
                        resume_name: file.name,
                        total_score: data.score.totalScore,
                        score_details: data.score
                    });

                    fetchScoreHistory();
                }

                setCanUpload(false);
            }

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to connect to the parser service.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <div className={styles.hero}>
                    {/* Left Column: Browse Jobs */}
                    <div className={styles.leftColumn}>
                        <Link href="/jobs" className={styles.sideCard}>
                            <Briefcase size={48} className={styles.cardIcon} />
                            <h2>Browse Jobs</h2>
                            <p>Discover thousands of job opportunities tailored to your skills and preferences.</p>
                            <span className={styles.primaryButton}>
                                Explore Jobs <ArrowRight size={18} />
                            </span>
                        </Link>
                    </div>

                    {/* Center Column: Resume Parser */}
                    <div className={styles.centerColumn}>
                        <div className={styles.centerHeader}>
                            <div className={styles.iconWrapper}>
                                <FileText size={40} color="var(--primary)" />
                            </div>
                            <h1 className={styles.centerTitle}>Resume Parser</h1>
                            <p className={styles.centerDescription}>
                                Upload your resume to evaluate its ATS score and match with job opportunities.
                            </p>
                        </div>

                        {authLoading ? (
                            <div className={styles.authLoading}>
                                <Loader2 className={styles.loadingSpinner} size={32} />
                                <p className={styles.loadingText}>Checking access...</p>
                            </div>
                        ) : !user ? (
                            <div className={styles.loginCard}>
                                <div className={styles.loginIconWrapper}>
                                    <FileText color="#60a5fa" size={32} />
                                </div>
                                <h3 className={styles.loginTitle}>Login to Analyse Resume</h3>
                                <p className={styles.loginDescription}>
                                    Create an account or sign in to upload your resume, receive detailed AI scores, and get matched with top companies.
                                </p>
                                <div className={styles.loginActions}>
                                    <Link href="/login" className={styles.signInButton}>
                                        Sign In
                                    </Link>
                                    <Link href="/signup" className={styles.createAccountButton}>
                                        Create Account
                                    </Link>
                                </div>
                            </div>
                        ) : !result ? (
                            <div className={styles.uploadArea}>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileChange}
                                    className={styles.uploadInput}
                                    id="resume-upload"
                                />
                                <label
                                    htmlFor="resume-upload"
                                    className={styles.uploadLabel}
                                >
                                    <Upload size={40} color="#9ca3af" />
                                    <span className={styles.uploadText}>
                                        {file ? file.name : "Click to Upload Resume (PDF)"}
                                    </span>
                                </label>

                                {file && (
                                    <button
                                        onClick={handleUpload}
                                        disabled={loading}
                                        className={`${styles.primaryButton} ${styles.analyzeButton}`}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className={styles.spinner} /> {LOADING_STEPS[loadingStep]}
                                            </>
                                        ) : (
                                            "Analyze Resume"
                                        )}
                                    </button>
                                )}

                                {loading && (
                                    <p className={styles.loadingText}>
                                        Processing your resume… Results may take up to a minutes. (Beta Version)
                                    </p>
                                )}
                                {error && (
                                    <div className={styles.errorBox}>
                                        <AlertCircle size={16} className={styles.errorIcon} />
                                        {error}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className={styles.resultsContainer}>
                                {/* Score Card */}
                                <div className={styles.scoreCard}>
                                    <h3 className={styles.scoreCardTitle}>ATS Match Score</h3>
                                    <div
                                        className={styles.scoreCircle}
                                        style={{
                                            border: `8px solid ${result.score?.totalScore > 70 ? '#22c55e' : result.score?.totalScore > 40 ? '#eab308' : '#ef4444'}`,
                                        }}>
                                        <span className={styles.scoreValue}>{result.score?.totalScore || 0}</span>
                                        <span className={styles.scoreDeviation}>± 5</span>
                                    </div>
                                    <p className={styles.scoreMessage}>
                                        {result.score?.totalScore > 70 ? 'Excellent! Your resume is well-optimized.' :
                                            result.score?.totalScore > 40 ? 'Good start, but needs improvement.' : 'Needs significant updates.'}
                                    </p>
                                </div>

                                {/* Details Card */}
                                <div className={styles.detailsCard}>
                                    <h3 className={styles.detailsHeader}>
                                        <Award size={20} color="#60a5fa" /> Score Breakdown
                                    </h3>

                                    <div className={styles.breakdownList}>
                                        {result.score?.breakdown && Object.entries(result.score.breakdown).map(([key, value]) => (
                                            <div key={key} className={styles.breakdownItem}>
                                                <span className={styles.breakdownLabel}>
                                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                                </span>
                                                <span className={`${styles.breakdownValue} ${(value as number) > 0 ? styles.breakdownValuePositive : ''}`}>
                                                    +{value as number} pts
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {result.score?.feedback && result.score.feedback.length > 0 && (
                                        <div className={styles.feedbackSection}>
                                            <h4 className={styles.feedbackHeader}>Improvements Needed:</h4>
                                            <ul className={styles.feedbackList}>
                                                {result.score.feedback.map((fb: string, i: number) => (
                                                    <li key={i}>{fb}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className={styles.resultActions}>
                                        <button
                                            onClick={handleMatchJobs}
                                            className={`${styles.primaryButton} ${styles.matchButton}`}
                                        >
                                            Match with Jobs
                                        </button>
                                        <button
                                            onClick={() => { setFile(null); setResult(null); }}
                                            className={styles.resetButton}
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            </div>

                        )}

                        {/* Recent Scans History (Bottom of Center Column) */}
                        {scoreHistory.length > 0 && !result && user && (
                            <div className={styles.recentScansContainer}>
                                <h4 className={styles.recentScansTitle}>
                                    <FileText size={18} className={styles.scansIcon} />
                                    Recent Scans
                                </h4>
                                <div className={styles.scansList}>
                                    {scoreHistory.map((score) => (
                                        <div key={score.id} className={styles.scanItem}>
                                            <div className={styles.scanInfo}>
                                                <p className={styles.scanName}>
                                                    {score.resume_name || "Resume"}
                                                </p>
                                                <p className={styles.scanDate}>
                                                    {new Date(score.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className={styles.scanScoreContainer}>
                                                <span className={`${styles.scanScoreValue} ${score.total_score >= 70 ? styles.scoreGreen :
                                                    score.total_score >= 40 ? styles.scoreYellow : styles.scoreRed
                                                    }`}>
                                                    {score.total_score} ±5
                                                </span>
                                                <span className={styles.scanScoreLabel}>Score</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Browse Companies */}
                    <div className={styles.rightColumn}>
                        <Link href="/companies" className={styles.sideCard}>
                            <Building size={48} className={styles.cardIcon} />
                            <h2>Top Compaines</h2>
                            <p>Explore top leading companies and their active job listings in one place.</p>
                            <span className={`${styles.primaryButton} ${styles.secondaryButton}`}>
                                See Companies <ArrowRight size={18} />
                            </span>
                        </Link>
                    </div>
                </div>
            </main >

            <Footer />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className={styles.modalContent}>
                    <div className={styles.modalIconWrapper}>
                        <Construction size={32} />
                    </div>
                    <h2 className={styles.modalTitle}>
                        Feature Coming Soon
                    </h2>
                    <p className={styles.modalText}>
                        The AI Job Matching feature is currently under construction. In the meantime, you can browse all available jobs manually.
                    </p>
                    <div className={styles.modalActions}>
                        <button
                            onClick={() => router.push('/jobs')}
                            className={`${styles.primaryButton} ${styles.modalBrowseButton}`}
                        >
                            Browse Jobs
                        </button>
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className={styles.modalCloseButton}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Modal>

            <div
                className={styles.hiddenTrigger}
                onClick={() => router.push('/admin/feedback')}
            />
        </div >
    );
}
