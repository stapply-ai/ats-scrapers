# Stapply Job Data Aggregator

A data aggregator that collects job postings from multiple ATS (Applicant Tracking System) platforms.

## Data

The aggregated job data is available at: **https://storage.stapply.ai/jobs.csv**

## Supported Platforms

- **Ashby** - Job postings from companies using Ashby ATS
- **Greenhouse** - Job postings from companies using Greenhouse ATS
- **Lever** - Job postings from companies using Lever ATS
- **Workable** - Job postings from companies using Workable ATS
- **Rippling** - Job postings from companies using Rippling ATS

## Project Structure

```
data/
├── ashby/          # Ashby scraper and data
├── greenhouse/     # Greenhouse scraper and data
├── lever/          # Lever scraper and data
├── workable/       # Workable scraper and data
├── rippling/        # Rippling scraper and data
└── models/         # Data models for each platform
```

## Contributing

Please feel free to make requests to improve or add more companies. Contributions are welcome!