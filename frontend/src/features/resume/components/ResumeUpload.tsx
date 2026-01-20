"use client";

import { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export interface ResumeAnalysisResult {
    resume: {
        profile: {
            name?: string;
            email?: string;
            phone?: string;
            location?: string;
        };
        text: string;
    };
    score: {
        totalScore: number;
        breakdown: {
            contactInfo: number;
            structure: number;
            experience: number;
            keywords: number;
            impact: number;
        };
        feedback: string[];
    };
    keywords: string[];
    softSkills?: string[];
}

interface ResumeUploadProps {
    onUploadComplete: (result: ResumeAnalysisResult) => void;
}

interface ResumeScore {
    id: string;
    resume_name: string;
    total_score: number;
    created_at: string;
}

export default function ResumeUpload({ onUploadComplete }: ResumeUploadProps) {
    const { user, loading: authLoading } = useAuth();
    const [dragging, setDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [canUpload, setCanUpload] = useState(true);
    const [checkingEligibility, setCheckingEligibility] = useState(true);
    const [scoreHistory, setScoreHistory] = useState<ResumeScore[]>([]);

    useEffect(() => {
        if (authLoading) return;

        if (user) {
            checkEligibility();
            fetchScoreHistory();
        } else {
            // If no user, decide policy. Currently allowing guests or treating as 'not eligible' for tracking but 'eligible' for upload?
            // If requirement is strict 'only once daily', guests shouldn't upload or we can't track them.
            // Assuming for now guests can upload (or app protects route).
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

                // Reset limit if it's a new day (UTC or local? using local date comparison for simplicity and user expectation)
                if (lastUpload.toDateString() === today.toDateString()) {
                    setCanUpload(false);
                    setError("You have reached your daily resume upload limit. Please try again tomorrow.");
                } else {
                    setCanUpload(true);
                }
            }
        } catch (err) {
            console.error("Error checking upload eligibility:", err);
            // Default to allowing upload if check fails, or could block. Letting it pass for now.
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

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (canUpload) setDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);

        if (!canUpload) return;

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type === 'application/pdf') {
            setFile(droppedFile);
            setError(null);
        } else {
            setError('Please upload a valid PDF file.');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.type === 'application/pdf') {
            setFile(selectedFile);
            setError(null);
        } else {
            setError('Please upload a valid PDF file.');
        }
    };

    const handleUpload = async () => {
        if (!file || !canUpload) return;

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Use env var for API URL, fallback to localhost for dev
            const API_URL = process.env.NEXT_PUBLIC_RESUME_PARSER_URL || 'http://localhost:8000';

            const response = await fetch(`${API_URL}/api/parser`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to parse resume');
            }

            const data = await response.json();

            // Update last upload time
            if (user) {
                console.log("Attempting to update profile and save score for user:", user.id);

                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ last_resume_upload_at: new Date().toISOString() })
                    .eq('id', user.id);

                if (profileError) {
                    console.error("Error updating profile last_resume_upload_at:", profileError);
                } else {
                    console.log("Profile updated successfully");
                }

                // Save score
                if (data.score && typeof data.score.totalScore === 'number') {
                    console.log("Saving score:", data.score.totalScore);
                    const { error: scoreError } = await supabase.from('resume_scores').insert({
                        user_id: user.id,
                        resume_name: file.name,
                        total_score: data.score.totalScore,
                        score_details: data.score
                    });

                    if (scoreError) {
                        console.error("Error inserting resume score:", scoreError);
                    } else {
                        console.log("Score saved successfully");
                        // Refresh history
                        fetchScoreHistory();
                    }
                } else {
                    console.warn("No score data to save:", data.score);
                }

                // Re-check eligibility (will disable further uploads)
                setCanUpload(false);
            } else {
                console.warn("User not found, skipping DB updates");
            }

            // Extract keywords from the response
            // The response structure from main.py is: { resume: {}, score: {}, keywords: [] }
            // or sometimes it might be just { ... } depending on the implementation details we saw earlier.
            // Looking at main.py lines 208: "keywords": keywords

            if (data.keywords && Array.isArray(data.keywords)) {
                onUploadComplete(data as ResumeAnalysisResult);
            } else {
                // Fallback if keywords aren't directly there, though they should be based on the code I read
                setError('Could not extract keywords from resume.');
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error communicating with parser service. Make sure it is running on port 8000.');
        } finally {
            setUploading(false);
        }
    };

    if (checkingEligibility) {
        return (
            <div className="w-full max-w-md mx-auto bg-white/5 rounded-xl border border-white/10 p-12 flex justify-center">
                <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 w-full max-w-md mx-auto">
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <h3 className="text-xl font-semibold mb-4 text-white">Upload Resume</h3>

                <div
                    className={`
                        border-2 border-dashed rounded-lg p-8 text-center transition-colors
                        ${dragging ? 'border-blue-500 bg-blue-500/10' : 'border-white/20 hover:border-white/40'}
                        ${error ? 'border-red-500/50' : ''}
                        ${!canUpload ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        id="resume-upload"
                        className="hidden"
                        accept=".pdf"
                        onChange={handleFileChange}
                        disabled={!canUpload}
                    />

                    {!file ? (
                        <label htmlFor="resume-upload" className={`cursor-pointer flex flex-col items-center gap-3 ${!canUpload ? 'pointer-events-none' : ''}`}>
                            <Upload size={32} className="text-gray-400" />
                            <p className="text-sm text-gray-300">
                                {canUpload
                                    ? <>Drag & drop your resume (PDF) here, or <span className="text-blue-400 underline">browse</span></>
                                    : "Daily upload limit reached"
                                }
                            </p>
                        </label>
                    ) : (
                        <div className="flex flex-col items-center gap-3">
                            <FileText size={32} className="text-blue-400" />
                            <p className="text-sm text-white font-medium">{file.name}</p>
                            <button
                                onClick={() => setFile(null)}
                                className="text-xs text-red-400 hover:text-red-300"
                                disabled={uploading}
                            >
                                Remove file
                            </button>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-200 text-sm">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <button
                    onClick={handleUpload}
                    disabled={!file || uploading || !canUpload}
                    className={`
                        mt-4 w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all
                        ${!file || uploading || !canUpload
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'}
                    `}
                >
                    {uploading ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            Match with Jobs
                            <CheckCircle size={18} />
                        </>
                    )}
                </button>
                {!canUpload && (
                    <p className="text-xs text-center text-gray-500 mt-2">
                        You can upload one resume every 24 hours.
                    </p>
                )}
            </div>

            {/* Resume History */}
            {scoreHistory.length > 0 && (
                <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                    <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                        <FileText size={18} className="text-blue-400" />
                        Recent Scans
                    </h4>
                    <div className="space-y-3">
                        {scoreHistory.map((score) => (
                            <div key={score.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                                <div>
                                    <p className="text-sm font-medium text-white truncate max-w-[180px]">
                                        {score.resume_name || "Resume"}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {new Date(score.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-lg font-bold ${score.total_score >= 70 ? 'text-green-400' :
                                        score.total_score >= 40 ? 'text-yellow-400' : 'text-red-400'
                                        }`}>
                                        {score.total_score} ±5
                                    </span>
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Score</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
