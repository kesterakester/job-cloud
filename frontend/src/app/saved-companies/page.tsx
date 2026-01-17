"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bookmark, Building, Trash2, ArrowRight } from "lucide-react";
import styles from "./page.module.css";
import Footer from "@/components/Footer";

type SavedCompany = {
    id: string;
    created_at: string;
    company_name: string;
    job_count?: number; // Fetched separately
};

export default function SavedCompaniesPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [savedCompanies, setSavedCompanies] = useState<SavedCompany[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login?redirect=/saved-companies');
        }
    }, [authLoading, user, router]);

    const fetchSavedCompanies = async () => {
        if (!user) return;
        setLoading(true);

        // 1. Fetch saved companies
        const { data: savedData, error } = await supabase
            .from('saved_companies')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching saved companies:', error);
            setLoading(false);
            return;
        }

        if (!savedData || savedData.length === 0) {
            setSavedCompanies([]);
            setLoading(false);
            return;
        }

        // 2. Fetch active job counts for these companies
        const companyNames = savedData.map(c => c.company_name);

        // We fetch only the company name column to count lighter
        const { data: jobsData, error: jobsError } = await supabase
            .from('jobs')
            .select('company')
            .in('company', companyNames);

        if (jobsError) {
            console.error('Error fetching job counts:', jobsError);
        }

        // Count jobs per company
        const counts: Record<string, number> = {};
        if (jobsData) {
            jobsData.forEach(job => {
                const name = job.company; // Normalized if needed, but assuming exact match
                counts[name] = (counts[name] || 0) + 1;
            });
        }

        // Merge counts
        const mergedData = savedData.map(item => ({
            ...item,
            job_count: counts[item.company_name] || 0
        }));

        setSavedCompanies(mergedData);
        setLoading(false);
    };

    useEffect(() => {
        if (user) {
            fetchSavedCompanies();
        }
    }, [user]);

    const handleRemove = async (e: React.MouseEvent, id: string) => {
        e.preventDefault(); // Prevent navigation
        e.stopPropagation();

        // Optimistic update
        setSavedCompanies(prev => prev.filter(item => item.id !== id));

        const { error } = await supabase
            .from('saved_companies')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Failed to remove company", error);
            fetchSavedCompanies(); // Revert/Refresh
        }
    };

    if (authLoading || loading) {
        return <div className={styles.loading}>Loading saved companies...</div>;
    }

    if (!user) return null;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.title}>
                    <Bookmark size={32} className="text-blue-500" />
                    Saved Companies
                </div>
            </header>

            {savedCompanies.length === 0 ? (
                <div className={styles.emptyState}>
                    <h2>No saved companies yet</h2>
                    <p>Track your favorite companies to see their latest openings.</p>
                    <Link href="/companies" className={styles.browseLink}>
                        Browse Companies
                    </Link>
                </div>
            ) : (
                <div className={styles.grid}>
                    {savedCompanies.map((company) => (
                        <Link
                            key={company.id}
                            href={`/companies/${encodeURIComponent(company.company_name)}`}
                            className={styles.card}
                        >
                            <div className={styles.cardHeader}>
                                <div className={styles.logoPlaceholder}>
                                    <Building size={24} />
                                </div>
                                <div>
                                    <h3 className={styles.companyName}>{company.company_name}</h3>
                                    <p className={styles.addedDate}>
                                        Added {new Date(company.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={(e) => handleRemove(e, company.id)}
                                className={styles.removeButton}
                                title="Remove from Saved"
                            >
                                <Trash2 size={18} />
                            </button>

                            <div className={styles.stats}>
                                <span>{company.job_count} active {company.job_count === 1 ? 'opening' : 'openings'}</span>
                                <ArrowRight size={16} style={{ marginLeft: 'auto' }} />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
            <Footer />
        </div>
    );
}
