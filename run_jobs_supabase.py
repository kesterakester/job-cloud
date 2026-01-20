import os
import pandas as pd
from jobspy import scrape_jobs
from supabase import create_client
from datetime import datetime, date, timedelta
from dotenv import load_dotenv
import json
import pytz
import time
import random

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
JOB_BATCH = os.getenv("JOB_BATCH", "all")

IST = pytz.timezone("Asia/Kolkata")

# ---------------- LOAD CONFIG ---------------- #

try:
    with open("scraper_config.json", "r") as f:
        config = json.load(f)
        cities = config.get("cities", {})
        all_roles = config.get("roles", [])
except FileNotFoundError:
    print("Error: scraper_config.json not found.")
    cities = {}
    all_roles = []

# ---------------- ROLE BATCHES ---------------- #

ROLE_BATCHES = {
    "batch1": ["software engineer"],
    "batch2": ["data scientist"],
    "batch3": [
        "ai engineer",
        "business analyst",
        "data analyst",
    ],
    "batch4": [
        "cloud engineer",
        "cybersecurity analyst",
        "digital marketing specialist",
        "quality assurance engineer",
        "customer service representative",
    ],
}

roles = ROLE_BATCHES.get(JOB_BATCH, all_roles)

print(f"Running JOB_BATCH: {JOB_BATCH}")
print(f"Roles: {roles}")
print("Scraping started:", date.today())

# ---------------- SCRAPING ---------------- #

frames = []

ROLE_LIMITS = {
    "software engineer": 30,
    "data scientist": 30,
    "ai engineer": 40,
}

MAX_ROLE_MINUTES = 6

for role in roles:
    role_start = time.time()
    results_limit = ROLE_LIMITS.get(role, 50)

    for city, location in cities.items():
        elapsed = (time.time() - role_start) / 60
        if elapsed > MAX_ROLE_MINUTES:
            print(f"[SKIP] Role '{role}' exceeded {MAX_ROLE_MINUTES} minutes")
            break

        try:
            print(f"Scraping {role} in {city}")
            df = scrape_jobs(
                site_name=["indeed", "linkedin", "google"],
                search_term=role,
                google_search_term=f"{role} jobs near {city} since yesterday",
                location=location,
                results_wanted=results_limit,
                hours_old=24,
                country_indeed="INDIA",
                linkedin_fetch_description=True
            )
            print(f"Found {len(df)} jobs for {role} in {city}")
        except Exception as e:
            print(f"Error scraping {role} in {city}: {e}")
            continue

        time.sleep(random.uniform(5, 15))

        if not df.empty:
            df["role"] = role
            df["city"] = city
            frames.append(df)

    role_time = round((time.time() - role_start) / 60, 2)
    print(f"[TIMING] Role '{role}' completed in {role_time} minutes")

if not frames:
    print("No jobs scraped. Exiting.")
    exit(0)

# ---------------- POST-PROCESS ---------------- #

final = pd.concat(frames, ignore_index=True)

final["crawled_date"] = datetime.now(IST).date().isoformat()
final = final.drop_duplicates(subset=["job_url"])
final = final.astype(object).where(pd.notnull(final), None)

for col in final.columns:
    if "date" in col or "time" in col:
        final[col] = final[col].apply(
            lambda x: x.isoformat() if isinstance(x, (date, datetime)) else x
        )

for col in ["emails", "skills", "company_addresses", "description"]:
    if col in final.columns:
        final[col] = final[col].apply(
            lambda x: json.dumps(x) if isinstance(x, (list, dict)) else x
        )

VALID_COLS = {
    "site","job_url","job_url_direct","title","company","location","date_posted",
    "job_type","is_remote","job_level","job_function","listing_type",
    "emails","description","company_industry","company_url","company_logo",
    "company_url_direct","company_addresses","company_num_employees",
    "company_revenue","company_description","skills","experience_range",
    "company_rating","company_reviews_count","vacancy_count",
    "work_from_home_type","role","city","crawled_date"
}

raw_cols = [c for c in final.columns if c not in VALID_COLS]
final["raw_data"] = final[raw_cols].to_dict(orient="records")
final = final[list(VALID_COLS) + ["raw_data"]]

records = final.to_dict(orient="records")

# ---------------- UPSERT ---------------- #

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

for i in range(0, len(records), 100):
    supabase.table("jobs").upsert(
        records[i:i+100],
        on_conflict="job_url,crawled_date"
    ).execute()

print(f"Inserted {len(records)} jobs successfully.")

# ---------------- CLEANUP ---------------- #

try:
    cleanup_date = datetime.now(IST).date() - timedelta(days=7)
    supabase.table("jobs").delete().eq(
        "crawled_date", cleanup_date.isoformat()
    ).execute()
    print(f"Cleanup completed for {cleanup_date}")
except Exception as e:
    print("Cleanup error:", e)
