"""
Configuration management for the API
"""
from pydantic_settings import BaseSettings
from typing import Optional
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings(BaseSettings):
    """Application settings"""

    # API Configuration
    app_name: str = "Job Data API"
    app_version: str = "1.0.0"

    # External API Keys
    serpapi_key: Optional[str] = None
    jsearch_api_key: Optional[str] = None  # RapidAPI key for JSearch
    adzuna_app_id: Optional[str] = None
    adzuna_app_key: Optional[str] = None

    # API Settings
    default_page_size: int = 10
    max_page_size: int = 100
    request_timeout: int = 30  # seconds

    # Rate Limiting
    rate_limit_enabled: bool = False
    rate_limit_per_minute: int = 60

    # Logging
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()
