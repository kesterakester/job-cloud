"use client";

import { FileText, MapPin, Star, CheckCircle, Briefcase, AlertCircle } from "lucide-react";
import { ResumeAnalysisResult } from "@/features/resume/components/ResumeUpload";
import { useAuth } from "@/context/AuthContext";

interface ResumeAnalysisReportProps {
    analysis: ResumeAnalysisResult;
    onReset?: () => void;
}

export default function ResumeAnalysisReport({ analysis, onReset }: ResumeAnalysisReportProps) {
    const { user } = useAuth();

    // Normalization logic for handling different data structures (legacy vs new)
    // If analysis.score exists, it's the full format. Otherwise, treat analysis itself as the score object.
    const scoreData = analysis?.score || analysis || {};
    // Check if correct properties exist on the resolved scoreData object
    const hasScoreData = typeof scoreData.totalScore === 'number';

    const resumeProfile = analysis?.resume?.profile || {};
    const keywords = analysis?.keywords || [];
    const softSkills = analysis?.softSkills || [];

    return (
        <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
            <div className="bg-white/5 border-b border-white/5 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FileText className="text-blue-400" />
                        Resume Analysis
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Analyzed for ATS compatibility and job matching potential.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {onReset && (
                        <button
                            onClick={onReset}
                            className="text-sm text-gray-400 hover:text-white underline"
                        >
                            Upload New
                        </button>
                    )}
                    <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl">
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-blue-400">{scoreData?.totalScore || 0}</span>
                            <span className="text-lg font-bold text-blue-400/70">±5</span>
                        </div>
                        <div className="flex flex-col text-xs text-blue-200 leading-tight">
                            <span className="font-bold">ATS SCORE</span>
                            <span>/ 100</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Predicted Roles */}
            {analysis.predictedRoles && analysis.predictedRoles.length > 0 && (
                <div className="px-6 pt-6 pb-2">
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Best Suited For:</span>
                        {analysis.predictedRoles.map((role, i) => (
                            <span key={i} className="px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-300 text-xs rounded-full">
                                {role}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="p-6 space-y-8">
                {/* Score Breakdown */}
                <div className="space-y-6">
                    <div>
                        <h3 className="text-sm font-uppercase text-gray-500 tracking-wider mb-3">PERFORMANCE BREAKDOWN</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { label: "Impact", val: scoreData?.breakdown?.impact || 0, icon: <Star size={14} /> },
                                { label: "Keywords", val: scoreData?.breakdown?.keywords || 0, icon: <CheckCircle size={14} /> },
                                { label: "Structure", val: scoreData?.breakdown?.structure || 0, icon: <FileText size={14} /> },
                                { label: "Content", val: scoreData?.breakdown?.experience || 0, icon: <Briefcase size={14} /> },
                            ].map((met, i) => (
                                <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/5">
                                    <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                                        {met.icon} {met.label}
                                    </div>
                                    <div className="text-lg font-bold text-white">
                                        {met.val}<span className="text-gray-600 text-xs font-normal">/20</span>
                                    </div>
                                    <div className="w-full bg-gray-800 h-1 rounded-full mt-2">
                                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(met.val / 20) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-uppercase text-gray-500 tracking-wider mb-2">IMPROVEMENT FEEDBACK</h3>
                        <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-4">
                            {scoreData?.feedback && scoreData.feedback.length > 0 ? (
                                <ul className="space-y-2">
                                    {scoreData.feedback.map((tip: string, i: number) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-orange-200/80">
                                            <AlertCircle size={14} className="mt-0.5 text-orange-400 flex-shrink-0" />
                                            {tip}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-green-400 text-sm flex items-center gap-2">
                                    <CheckCircle size={14} /> Great job! No critical improvements detected.
                                </p>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="flex flex-wrap gap-2">
                            {keywords.slice(0, 15).map((k, i) => (
                                <span key={i} className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs rounded-full">
                                    {k}
                                </span>
                            ))}
                            {keywords.length > 15 && (
                                <span className="px-2 py-1 text-gray-500 text-xs">+{keywords.length - 15} more</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
