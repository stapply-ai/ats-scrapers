"""
SerpAPI provider for Google Jobs data
"""
import httpx
from typing import List, Optional
import logging

from .base import BaseJobProvider
from ..models import JobListing
from ..config import settings

logger = logging.getLogger(__name__)


class SerpAPIProvider(BaseJobProvider):
    """
    SerpAPI provider for Google Jobs search results
    https://serpapi.com/google-jobs-api
    """

    BASE_URL = "https://serpapi.com/search"

    def __init__(self):
        self.api_key = settings.serpapi_key

    def is_available(self) -> bool:
        """Check if SerpAPI key is configured"""
        return self.api_key is not None and len(self.api_key) > 0

    def get_description(self) -> str:
        """Get provider description"""
        return "SerpAPI - Google Jobs search results"

    async def search(
        self,
        query: str,
        location: Optional[str] = None,
        page: int = 1,
        limit: int = 10,
        employment_type: Optional[str] = None,
        date_posted: Optional[str] = None,
        remote_only: bool = False,
        **kwargs
    ) -> List[JobListing]:
        """
        Search Google Jobs via SerpAPI

        Args:
            query: Job search query
            location: Location to search in
            page: Page number (SerpAPI uses start parameter)
            limit: Number of results
            employment_type: Filter by employment type
            date_posted: Filter by date posted
            remote_only: Filter for remote jobs

        Returns:
            List of JobListing objects
        """
        if not self.is_available():
            logger.warning("SerpAPI key not configured")
            return []

        # Build search query
        search_query = query
        if remote_only:
            search_query += " remote"

        # Build parameters
        params = {
            "engine": "google_jobs",
            "q": search_query,
            "api_key": self.api_key,
            "num": min(limit, 10),  # SerpAPI max is 10 per request
            "start": (page - 1) * 10,  # SerpAPI pagination
        }

        if location:
            params["location"] = location

        # Map employment type to Google Jobs filter
        if employment_type:
            employment_type_map = {
                "FULLTIME": "FULLTIME",
                "PARTTIME": "PARTTIME",
                "CONTRACTOR": "CONTRACTOR",
                "INTERN": "INTERN",
            }
            if employment_type.upper() in employment_type_map:
                params["employment_type"] = employment_type_map[employment_type.upper()]

        # Map date posted filter
        if date_posted:
            date_map = {
                "today": "today",
                "3days": "3days",
                "week": "week",
                "month": "month",
            }
            if date_posted.lower() in date_map:
                params["chips"] = f"date_posted:{date_map[date_posted.lower()]}"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                logger.info(f"Querying SerpAPI: {params}")
                response = await client.get(self.BASE_URL, params=params)
                response.raise_for_status()
                data = response.json()

                # Parse jobs from response
                jobs = []
                jobs_results = data.get("jobs_results", [])

                for job_data in jobs_results:
                    # Extract salary information
                    salary_min = None
                    salary_max = None
                    salary_currency = None
                    salary_period = None

                    detected_extensions = job_data.get("detected_extensions", {})
                    if "salary" in detected_extensions:
                        # SerpAPI provides salary info in detected_extensions
                        salary_info = detected_extensions.get("salary", "")
                        # This is basic parsing - can be enhanced
                        if "$" in salary_info:
                            salary_currency = "USD"

                    # Determine if remote
                    is_remote = False
                    job_highlights = job_data.get("job_highlights", [])
                    description = job_data.get("description", "").lower()
                    title = job_data.get("title", "").lower()

                    if "remote" in description or "remote" in title:
                        is_remote = True

                    # Extract benefits and requirements
                    benefits = []
                    requirements = []
                    for highlight in job_highlights:
                        if highlight.get("title") == "Qualifications":
                            requirements = highlight.get("items", [])
                        elif highlight.get("title") == "Benefits":
                            benefits = highlight.get("items", [])

                    job = JobListing(
                        title=job_data.get("title", ""),
                        company=job_data.get("company_name", ""),
                        location=job_data.get("location", ""),
                        description=job_data.get("description", ""),
                        url=job_data.get("share_url") or job_data.get("apply_link", ""),
                        source="serpapi",
                        employment_type=detected_extensions.get("schedule_type"),
                        salary_min=salary_min,
                        salary_max=salary_max,
                        salary_currency=salary_currency,
                        salary_period=salary_period,
                        date_posted=detected_extensions.get("posted_at"),
                        is_remote=is_remote,
                        company_logo=job_data.get("thumbnail"),
                        apply_url=job_data.get("apply_link"),
                        benefits=benefits if benefits else None,
                        requirements=requirements if requirements else None,
                        tags=job_data.get("extensions", [])
                    )
                    jobs.append(job)

                logger.info(f"SerpAPI returned {len(jobs)} jobs")
                return jobs

        except httpx.HTTPError as e:
            logger.error(f"HTTP error querying SerpAPI: {str(e)}")
            raise Exception(f"SerpAPI request failed: {str(e)}")
        except Exception as e:
            logger.error(f"Error parsing SerpAPI response: {str(e)}")
            raise Exception(f"SerpAPI error: {str(e)}")
