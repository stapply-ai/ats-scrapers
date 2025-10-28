#!/usr/bin/env python3
"""
Script to extract company slugs from gh.txt and merge with existing greenhouse_companies.csv
"""

import csv
import re
from urllib.parse import urlparse


def extract_company_slug(url):
    """Extract company slug from Greenhouse URL"""
    # Remove any trailing slashes and query parameters
    url = url.strip()
    if url.endswith("/"):
        url = url[:-1]

    # Parse the URL
    parsed = urlparse(url)
    path = parsed.path

    # Extract company slug from path like /company-slug or /company-slug/jobs/job-id
    # Pattern: /company-slug or /company-slug/jobs/job-id
    # We want the company slug, not the job ID
    match = re.match(r"^/([^/]+)(?:/jobs/.*)?", path)
    if match:
        return match.group(1)
    return None


def read_existing_companies(csv_file):
    """Read existing companies from CSV file"""
    companies = set()
    try:
        with open(csv_file, "r", newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader)  # Skip header
            for row in reader:
                if row and row[0].startswith("https://job-boards.greenhouse.io/"):
                    slug = extract_company_slug(row[0])
                    if slug:
                        companies.add(slug)
    except FileNotFoundError:
        print(f"File {csv_file} not found, starting fresh")
    return companies


def extract_from_greenhouse_file(greenhouse_file):
    """Extract company slugs from gh.txt"""
    companies = set()
    try:
        with open(greenhouse_file, "r", encoding="utf-8") as f:
            for line in f:
                url = line.strip()
                if url.startswith("https://job-boards.greenhouse.io/"):
                    slug = extract_company_slug(url)
                    if slug:
                        companies.add(slug)
    except FileNotFoundError:
        print(f"File {greenhouse_file} not found")
    return companies


def write_companies_csv(companies, output_file):
    """Write companies to CSV file"""
    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["url"])  # Header
        for company in sorted(companies):
            writer.writerow([f"https://job-boards.greenhouse.io/{company}"])


def main():
    # File paths
    greenhouse_file = "gh.txt"
    existing_csv = "greenhouse_companies.csv"
    output_csv = "greenhouse_companies.csv"

    print("Extracting companies from gh.txt...")
    greenhouse_companies = extract_from_greenhouse_file(greenhouse_file)
    print(f"Found {len(greenhouse_companies)} companies in gh.txt")

    print("Reading existing companies...")
    existing_companies = read_existing_companies(existing_csv)
    print(f"Found {len(existing_companies)} existing companies")

    # Merge companies
    all_companies = existing_companies.union(greenhouse_companies)
    new_companies = greenhouse_companies - existing_companies

    print(f"Total unique companies: {len(all_companies)}")
    print(f"New companies added: {len(new_companies)}")

    if new_companies:
        print("New companies:")
        for company in sorted(new_companies):
            print(f"  - {company}")

    # Write updated CSV
    write_companies_csv(all_companies, output_csv)
    print(f"Updated {output_csv} with {len(all_companies)} companies")


if __name__ == "__main__":
    main()
