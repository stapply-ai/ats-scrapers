"""
JSearch provider (RapidAPI)
"""
import httpx
from typing import List, Optional
import logging

from .base import BaseJobProvider
from ..models import JobListing
from ..config import settings

logger = logging.getLogger(__name__)


class JSearchProvider(BaseJobProvider):
    """
    JSearch provider via RapidAPI
    https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
    """

    BASE_URL = "https://jsearch.p.rapidapi.com/search"

    def __init__(self):
        self.api_key = settings.jsearch_api_key

    def is_available(self) -> bool:
        """Check if JSearch API key is configured"""
        return self.api_key is not None and len(self.api_key) > 0

    def get_description(self) -> str:
        """Get provider description"""
        return "JSearch - Comprehensive job search via RapidAPI"

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
        Search jobs via JSearch API

        Args:
            query: Job search query
            location: Location to search in
            page: Page number
            limit: Number of results
            employment_type: Filter by employment type
            date_posted: Filter by date posted
            remote_only: Filter for remote jobs

        Returns:
            List of JobListing objects
        """
        if not self.is_available():
            logger.warning("JSearch API key not configured")
            return []

        # Build search query
        search_query = query
        if location:
            search_query += f" in {location}"
        if remote_only:
            search_query += " remote"

        # Build parameters
        params = {
            "query": search_query,
            "page": str(page),
            "num_pages": "1",
            "date_posted": date_posted or "all",
        }

        # Add employment type filter
        if employment_type:
            params["employment_types"] = employment_type.upper()

        # Add remote filter
        if remote_only:
            params["remote_jobs_only"] = "true"

        headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                logger.info(f"Querying JSearch: {params}")
                response = await client.get(
                    self.BASE_URL,
                    params=params,
                    headers=headers
                )
                response.raise_for_status()
                data = response.json()

                # Parse jobs from response
                jobs = []
                jobs_data = data.get("data", [])

                for job_data in jobs_data[:limit]:  # Limit results
                    # Extract salary information
                    salary_min = job_data.get("job_min_salary")
                    salary_max = job_data.get("job_max_salary")
                    salary_currency = job_data.get("job_salary_currency")
                    salary_period = job_data.get("job_salary_period")

                    # Extract highlights
                    highlights = job_data.get("job_highlights", {})
                    benefits = highlights.get("Benefits", [])
                    qualifications = highlights.get("Qualifications", [])
                    responsibilities = highlights.get("Responsibilities", [])

                    # Combine requirements
                    requirements = qualifications + responsibilities

                    job = JobListing(
                        title=job_data.get("job_title", ""),
                        company=job_data.get("employer_name", ""),
                        location=job_data.get("job_city") or job_data.get("job_country", ""),
                        description=job_data.get("job_description", ""),
                        url=job_data.get("job_apply_link", ""),
                        source="jsearch",
                        employment_type=job_data.get("job_employment_type"),
                        salary_min=salary_min,
                        salary_max=salary_max,
                        salary_currency=salary_currency,
                        salary_period=salary_period,
                        date_posted=job_data.get("job_posted_at_datetime_utc"),
                        is_remote=job_data.get("job_is_remote", False),
                        company_logo=job_data.get("employer_logo"),
                        apply_url=job_data.get("job_apply_link"),
                        benefits=benefits if benefits else None,
                        requirements=requirements if requirements else None,
                        tags=[job_data.get("job_employment_type")] if job_data.get("job_employment_type") else None
                    )
                    jobs.append(job)

                logger.info(f"JSearch returned {len(jobs)} jobs")
                return jobs

        except httpx.HTTPError as e:
            logger.error(f"HTTP error querying JSearch: {str(e)}")
            raise Exception(f"JSearch request failed: {str(e)}")
        except Exception as e:
            logger.error(f"Error parsing JSearch response: {str(e)}")
            raise Exception(f"JSearch error: {str(e)}")
