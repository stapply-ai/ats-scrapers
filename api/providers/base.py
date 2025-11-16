"""
Base provider class for job data sources
"""
from abc import ABC, abstractmethod
from typing import List, Optional
from ..models import JobListing


class BaseJobProvider(ABC):
    """Abstract base class for job data providers"""

    @abstractmethod
    async def search(
        self,
        query: str,
        location: Optional[str] = None,
        page: int = 1,
        limit: int = 10,
        **kwargs
    ) -> List[JobListing]:
        """
        Search for jobs

        Args:
            query: Job search keywords
            location: Job location
            page: Page number
            limit: Results per page
            **kwargs: Additional provider-specific parameters

        Returns:
            List of JobListing objects
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if provider is available (API key configured, etc.)"""
        pass

    @abstractmethod
    def get_description(self) -> str:
        """Get provider description"""
        pass
