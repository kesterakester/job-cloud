export type Job = {
    id: string;
    title: string;
    company: string;
    location: string;
    job_url: string;
    site?: string;
    crawled_date: string;
    description?: string;
    job_type?: string;
    job_url_direct?: string;
    is_remote?: boolean;
    job_level?: string;
    role?: string;
    job_function?: string;
    company_logo?: string;
    min_amount?: number;
    max_amount?: number;
    currency?: string;
    interval?: string;
};

export type CompanyGroup = {
    name: string;
    jobs: Job[];
};
