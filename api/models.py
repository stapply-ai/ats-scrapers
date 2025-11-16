"""
Pydantic models for API requests and responses
"""
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict
from datetime import datetime


class JobListing(BaseModel):
    """Normalized job listing model"""
    title: str = Field(..., description="Job title")
    company: str = Field(..., description="Company name")
    location: Optional[str] = Field(None, description="Job location")
    description: Optional[str] = Field(None, description="Job description")
    url: str = Field(..., description="Job posting URL")
    source: str = Field(..., description="Data source (serpapi, jsearch, etc.)")

    # Optional fields
    employment_type: Optional[str] = Field(None, description="Employment type (FULLTIME, PARTTIME, etc.)")
    salary_min: Optional[float] = Field(None, description="Minimum salary")
    salary_max: Optional[float] = Field(None, description="Maximum salary")
    salary_currency: Optional[str] = Field(None, description="Salary currency code")
    salary_period: Optional[str] = Field(None, description="Salary period (YEAR, MONTH, HOUR)")
    date_posted: Optional[str] = Field(None, description="Date posted (ISO format)")
    is_remote: Optional[bool] = Field(None, description="Is remote position")
    company_logo: Optional[str] = Field(None, description="Company logo URL")
    apply_url: Optional[str] = Field(None, description="Application URL")

    # Additional metadata
    benefits: Optional[List[str]] = Field(None, description="Job benefits")
    requirements: Optional[List[str]] = Field(None, description="Job requirements")
    tags: Optional[List[str]] = Field(None, description="Job tags/categories")


class JobSearchRequest(BaseModel):
    """Request model for job search"""
    query: str = Field(..., description="Job search query", example="Python Developer")
    location: Optional[str] = Field(None, description="Location", example="New York, NY")
    provider: Optional[str] = Field(None, description="Specific provider (serpapi, jsearch, all)")
    page: int = Field(1, ge=1, description="Page number")
    limit: int = Field(10, ge=1, le=100, description="Results per page")
    employment_type: Optional[str] = Field(None, description="Employment type filter")
    date_posted: Optional[str] = Field(None, description="Date posted filter (today, 3days, week, month)")
    remote_only: bool = Field(False, description="Remote jobs only")


class JobSearchResponse(BaseModel):
    """Response model for job search"""
    query: str = Field(..., description="Search query used")
    location: Optional[str] = Field(None, description="Location searched")
    total_results: int = Field(..., description="Total number of results found")
    page: int = Field(..., description="Current page number")
    limit: int = Field(..., description="Results per page")
    jobs: List[JobListing] = Field(..., description="List of job listings")
    provider_stats: Dict[str, int] = Field(..., description="Results count per provider")
    errors: Optional[Dict[str, str]] = Field(None, description="Any errors from providers")
