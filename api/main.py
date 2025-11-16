"""
Job Data API - FastAPI application for querying external job APIs
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import logging

from .models import JobSearchRequest, JobSearchResponse, JobListing
from .providers.serpapi import SerpAPIProvider
from .providers.jsearch import JSearchProvider
from .config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Job Data API",
    description="API for querying job data from multiple external sources",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this based on your needs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize providers
providers = {
    "serpapi": SerpAPIProvider(),
    "jsearch": JSearchProvider(),
}


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "Job Data API",
        "version": "1.0.0",
        "description": "Query job data from multiple external sources",
        "endpoints": {
            "search": "/search",
            "health": "/health",
            "providers": "/providers"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "providers": {
            name: provider.is_available()
            for name, provider in providers.items()
        }
    }


@app.get("/providers")
async def list_providers():
    """List available job data providers"""
    return {
        "providers": [
            {
                "name": name,
                "available": provider.is_available(),
                "description": provider.get_description()
            }
            for name, provider in providers.items()
        ]
    }


@app.get("/search", response_model=JobSearchResponse)
async def search_jobs(
    query: str = Query(..., description="Job search query (e.g., 'Python Developer')"),
    location: Optional[str] = Query(None, description="Location (e.g., 'New York, NY' or 'Remote')"),
    provider: Optional[str] = Query(None, description="Specific provider to use (serpapi, jsearch, or all)"),
    page: int = Query(1, ge=1, description="Page number for pagination"),
    limit: int = Query(10, ge=1, le=100, description="Number of results per page"),
    employment_type: Optional[str] = Query(None, description="Employment type (FULLTIME, PARTTIME, CONTRACTOR, INTERN)"),
    date_posted: Optional[str] = Query(None, description="Date posted filter (today, 3days, week, month)"),
    remote_only: bool = Query(False, description="Filter for remote jobs only")
) -> JobSearchResponse:
    """
    Search for jobs across multiple external APIs

    Args:
        query: Job search keywords (required)
        location: Job location
        provider: Specific provider to use, or 'all' for aggregated results
        page: Page number for pagination
        limit: Results per page
        employment_type: Filter by employment type
        date_posted: Filter by posting date
        remote_only: Only return remote jobs

    Returns:
        JobSearchResponse with results from external APIs
    """
    logger.info(f"Search request: query={query}, location={location}, provider={provider}")

    # Validate provider
    if provider and provider != "all" and provider not in providers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider. Available: {list(providers.keys())}"
        )

    # Build search parameters
    search_params = {
        "query": query,
        "location": location,
        "page": page,
        "limit": limit,
        "employment_type": employment_type,
        "date_posted": date_posted,
        "remote_only": remote_only
    }

    all_jobs = []
    provider_results = {}
    errors = {}

    # Determine which providers to query
    providers_to_query = (
        [provider] if provider and provider != "all"
        else list(providers.keys())
    )

    # Query each provider
    for provider_name in providers_to_query:
        provider_instance = providers[provider_name]

        if not provider_instance.is_available():
            logger.warning(f"Provider {provider_name} is not available (missing API key)")
            errors[provider_name] = "Provider not configured (missing API key)"
            continue

        try:
            jobs = await provider_instance.search(**search_params)
            all_jobs.extend(jobs)
            provider_results[provider_name] = len(jobs)
            logger.info(f"Provider {provider_name} returned {len(jobs)} jobs")
        except Exception as e:
            logger.error(f"Error querying provider {provider_name}: {str(e)}")
            errors[provider_name] = str(e)

    # Remove duplicates based on job URL
    seen_urls = set()
    unique_jobs = []
    for job in all_jobs:
        if job.url not in seen_urls:
            seen_urls.add(job.url)
            unique_jobs.append(job)

    # Sort by date posted (newest first)
    unique_jobs.sort(key=lambda x: x.date_posted or "", reverse=True)

    # Apply pagination
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_jobs = unique_jobs[start_idx:end_idx]

    return JobSearchResponse(
        query=query,
        location=location,
        total_results=len(unique_jobs),
        page=page,
        limit=limit,
        jobs=paginated_jobs,
        provider_stats=provider_results,
        errors=errors if errors else None
    )


@app.post("/search", response_model=JobSearchResponse)
async def search_jobs_post(request: JobSearchRequest) -> JobSearchResponse:
    """
    Search for jobs using POST method (for complex queries)

    This endpoint accepts the same parameters as GET /search but via POST body
    """
    return await search_jobs(
        query=request.query,
        location=request.location,
        provider=request.provider,
        page=request.page,
        limit=request.limit,
        employment_type=request.employment_type,
        date_posted=request.date_posted,
        remote_only=request.remote_only
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
