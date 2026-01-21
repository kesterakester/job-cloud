"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { FileText, ArrowRight, Clock, Trash2, Home, AlertCircle, Briefcase } from "lucide-react";
import ResumeAnalysisReport from "@/components/ResumeAnalysisReport";
import Link from 'next/link';

interface ResumeScore {
    id: string;
    resume_name: string;
    total_score: number;
    created_at: string;
    score_details: any;
}

type Job = {
    id: string;
    title: string;
    company: string;
    location: string;
    job_url: string;
    site: string;
    crawled_date: string;
    description: string;
    skills?: string | null;
    job_type: string;
    matchScore?: number;
    matchReasons?: string[];
};

export default function ResumeDashboard() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [scores, setScores] = useState<ResumeScore[]>([]);
    const [selectedScore, setSelectedScore] = useState<ResumeScore | null>(null);
    const [loading, setLoading] = useState(true);

    // Job Matching State
    const [matchedJobs, setMatchedJobs] = useState<Job[]>([]);
    const [fetchingJobs, setFetchingJobs] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login?redirect=/resume-dashboard');
        } else if (user) {
            fetchScores();
        }
    }, [user, authLoading, router]);

    // Job Matching Logic - Temporarily Disabled for Performance
    // The UI for this is currently hidden, so we shouldn't run the expensive fetch/match logic.
    /*
    const scoreJob = (job: Job, userKeywords: string[]): { score: number, reasons: string[] } => {
        // ... (logic preserved in comments if needed later)
        return { score: 0, reasons: [] };
    };

    const fetchAndMatchJobs = async (userKeywords: string[]) => {
         // ...
    };

    useEffect(() => {
        if (selectedScore && selectedScore.score_details) {
            const keywords = selectedScore.score_details.keywords || [];
            if (keywords.length > 0) {
                fetchAndMatchJobs(keywords);
            }
        }
    }, [selectedScore]);
    */

    const fetchScores = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('resume_scores')
                .select('*')
                .eq('user_id', user!.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                setScores(data);
                // Select the most recent one by default if available
                if (data.length > 0) {
                    setSelectedScore(data[0]);
                }
            }
        } catch (err) {
            console.error("Error fetching scores:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this scan?")) return;

        try {
            const { error } = await supabase
                .from('resume_scores')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Remove from state
            const newScores = scores.filter(s => s.id !== id);
            setScores(newScores);

            if (selectedScore?.id === id) {
                setSelectedScore(newScores.length > 0 ? newScores[0] : null);
            }
        } catch (err) {
            console.error("Error deleting score:", err);
        }
    };

    if (authLoading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-gray-400">Loading...</div>;
    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-blue-500/30 pt-4 md:pt-8">
            <main className="max-w-7xl mx-auto px-4 sm:px-6 mb-12">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white">
                            Resume Dashboard
                        </h1>
                        <p className="text-gray-400 mt-1 max-w-lg">
                            Track your resume performance over time and analyze your skills.
                        </p>
                    </div>
                    {scores.length > 0 && (
                        <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-xl flex items-center gap-4">
                            <div className="text-right">
                                <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">Average Score</div>
                                <div className={`text-2xl font-bold ${(scores.reduce((acc, curr) => acc + curr.total_score, 0) / scores.length) >= 80 ? 'text-green-400' :
                                    (scores.reduce((acc, curr) => acc + curr.total_score, 0) / scores.length) >= 60 ? 'text-yellow-400' : 'text-red-400'
                                    }`}>
                                    {(scores.reduce((acc, curr) => acc + curr.total_score, 0) / scores.length).toFixed(1)}
                                </div>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                                <FileText size={20} className="text-blue-400" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col lg:flex-row gap-6 min-h-[600px]">
                    {/* Sidebar: History List */}
                    <div className="lg:w-80 flex-shrink-0 flex flex-col gap-4">
                        <div className="bg-[#111] border border-white/10 rounded-2xl p-4 h-80 lg:h-full flex flex-col shadow-xl">
                            <div className="flex items-center justify-between mb-4 px-2">
                                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">History</h2>
                                <span className="bg-white/10 text-gray-300 text-xs px-2 py-0.5 rounded-full font-mono">
                                    {scores.length}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {loading ? (
                                    [1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)
                                ) : scores.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500">
                                        <Clock size={32} className="mx-auto mb-3 opacity-20" />
                                        <p className="text-sm">No resume scans found.</p>
                                    </div>
                                ) : (
                                    scores.map(score => {
                                        const hasDetails = score.score_details && (score.score_details.resume || score.score_details.keywords);
                                        const isSelected = selectedScore?.id === score.id;

                                        return (
                                            <div
                                                key={score.id}
                                                onClick={() => setSelectedScore(score)}
                                                className={`
                                                    group relative p-3 rounded-xl border transition-all cursor-pointer select-none
                                                    ${isSelected
                                                        ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_15px_-3px_rgba(59,130,246,0.15)]'
                                                        : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'}
                                                `}
                                            >
                                                <div className="flex justify-between items-start gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className={`font-medium text-sm truncate leading-snug mb-1 ${isSelected ? 'text-blue-200' : 'text-gray-300'}`} title={score.resume_name}>
                                                            {score.resume_name || "Untitled Resume"}
                                                        </h3>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-gray-500">
                                                                {new Date(score.created_at).toLocaleDateString()}
                                                            </span>
                                                            {!hasDetails && (
                                                                <span className="text-[9px] text-orange-400 bg-orange-500/10 px-1.5 py-[1px] rounded border border-orange-500/20">
                                                                    Legacy
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-end gap-1.5">
                                                        <div className={`
                                                            text-xs font-bold px-2 py-0.5 rounded-md
                                                            ${score.total_score >= 80 ? 'bg-green-500/20 text-green-400' :
                                                                score.total_score >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                                                                    'bg-red-500/20 text-red-400'}
                                                        `}>
                                                            {score.total_score}
                                                        </div>
                                                        <button
                                                            onClick={(e) => handleDelete(e, score.id)}
                                                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 transition-all transform translate-x-1 group-hover:translate-x-0"
                                                            title="Delete scan"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main: Details View */}
                    <div className="flex-1 min-w-0">
                        {selectedScore ? (
                            (selectedScore.score_details) ? (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
                                    <ResumeAnalysisReport
                                        analysis={selectedScore.score_details}
                                    // Hide onReset since we are in history view
                                    />

                                    {/* Matched Jobs Section */}
                                    {/* Matched Jobs Section - Temporarily Removed
                                    {(fetchingJobs || matchedJobs.length > 0) && (
                                        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
                                           ...
                                        </div>
                                    )}
                                    */}
                                </div>
                            ) : (
                                <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-[#111] rounded-2xl border border-white/10 p-12 text-center text-gray-400 shadow-xl">
                                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/5">
                                        <AlertCircle size={32} className="text-gray-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">Analysis Details Unavailable</h3>
                                    <p className="max-w-md mx-auto mb-8 text-gray-500 text-sm">
                                        This is an older scan that only has a score recorded. Full detailed analysis was not stored at the time of this upload.
                                    </p>
                                    <Link href="/" className="bg-white hover:bg-gray-200 text-black px-6 py-2.5 rounded-lg font-medium transition-colors">
                                        Run New Scan
                                    </Link>
                                </div>
                            )
                        ) : (
                            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                                <FileText size={48} className="mb-4 opacity-20" />
                                <p>Select a scan from the history to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
