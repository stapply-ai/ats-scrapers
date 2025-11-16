# Job Data API

A FastAPI-based REST API that fetches live job data from multiple external job search APIs including Google Jobs (via SerpAPI) and JSearch.

## Features

- 🔍 **Multi-Provider Search**: Query multiple job APIs simultaneously
- 🔄 **Unified Response Format**: Normalized job data from different sources
- 🎯 **Advanced Filtering**: Filter by location, employment type, date posted, remote status
- 📊 **Provider Stats**: See how many results came from each provider
- 🚀 **Fast & Async**: Built with FastAPI for high performance
- 📖 **Auto-Generated Docs**: Interactive API documentation via Swagger UI

## Supported Job Data Providers

| Provider | Description | API Key Required |
|----------|-------------|------------------|
| **SerpAPI** | Google Jobs search results | ✅ Yes ([Get key](https://serpapi.com/)) |
| **JSearch** | Comprehensive job search via RapidAPI | ✅ Yes ([Get key](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)) |

## Installation

### 1. Install Dependencies

```bash
# Install required packages
pip install fastapi uvicorn httpx pydantic pydantic-settings python-dotenv
```

Or add to your existing `pyproject.toml`:

```toml
[project.dependencies]
fastapi = ">=0.109.0"
uvicorn = ">=0.27.0"
httpx = ">=0.28.1"
pydantic = ">=2.0.0"
pydantic-settings = ">=2.0.0"
python-dotenv = ">=1.0.0"
```

### 2. Configure API Keys

Copy the example environment file and add your API keys:

```bash
cp api/.env.example api/.env
```

Edit `api/.env` and add your API keys:

```env
SERPAPI_KEY=your_serpapi_key_here
JSEARCH_API_KEY=your_rapidapi_key_here
```

### 3. Run the API

```bash
# From the project root directory
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

Or run directly:

```bash
cd api
python main.py
```

The API will be available at:
- **API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

## API Endpoints

### GET /

Root endpoint with API information.

### GET /health

Health check endpoint that shows provider availability.

**Example Response:**
```json
{
  "status": "healthy",
  "providers": {
    "serpapi": true,
    "jsearch": true
  }
}
```

### GET /providers

List all available job data providers and their status.

**Example Response:**
```json
{
  "providers": [
    {
      "name": "serpapi",
      "available": true,
      "description": "SerpAPI - Google Jobs search results"
    },
    {
      "name": "jsearch",
      "available": true,
      "description": "JSearch - Comprehensive job search via RapidAPI"
    }
  ]
}
```

### GET /search

Search for jobs across multiple providers.

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `query` | string | ✅ Yes | Job search keywords | `"Python Developer"` |
| `location` | string | No | Location to search | `"New York, NY"` or `"Remote"` |
| `provider` | string | No | Specific provider (`serpapi`, `jsearch`, or `all`) | `"serpapi"` |
| `page` | integer | No | Page number (default: 1) | `1` |
| `limit` | integer | No | Results per page (default: 10, max: 100) | `20` |
| `employment_type` | string | No | Employment type filter | `"FULLTIME"`, `"PARTTIME"`, `"CONTRACTOR"`, `"INTERN"` |
| `date_posted` | string | No | Date filter | `"today"`, `"3days"`, `"week"`, `"month"` |
| `remote_only` | boolean | No | Filter for remote jobs only (default: false) | `true` |

**Example Request:**
```bash
curl "http://localhost:8000/search?query=Software+Engineer&location=San+Francisco&limit=5&remote_only=true"
```

**Example Response:**
```json
{
  "query": "Software Engineer",
  "location": "San Francisco",
  "total_results": 15,
  "page": 1,
  "limit": 5,
  "jobs": [
    {
      "title": "Senior Software Engineer",
      "company": "Tech Corp",
      "location": "San Francisco, CA (Remote)",
      "description": "We are looking for...",
      "url": "https://jobs.example.com/12345",
      "source": "serpapi",
      "employment_type": "FULLTIME",
      "salary_min": 150000,
      "salary_max": 200000,
      "salary_currency": "USD",
      "salary_period": "YEAR",
      "date_posted": "2025-11-15T10:00:00Z",
      "is_remote": true,
      "company_logo": "https://logo.example.com/logo.png",
      "apply_url": "https://apply.example.com/12345",
      "benefits": ["Health insurance", "401k"],
      "requirements": ["5+ years experience", "Python expertise"],
      "tags": ["Full-time", "Remote"]
    }
  ],
  "provider_stats": {
    "serpapi": 8,
    "jsearch": 7
  },
  "errors": null
}
```

### POST /search

Same as GET /search but accepts parameters in the request body.

**Request Body:**
```json
{
  "query": "Data Scientist",
  "location": "Remote",
  "page": 1,
  "limit": 10,
  "employment_type": "FULLTIME",
  "date_posted": "week",
  "remote_only": true
}
```

## Usage Examples

### Basic Search

```bash
# Search for Python jobs
curl "http://localhost:8000/search?query=Python+Developer"
```

### Location-Based Search

```bash
# Search for jobs in New York
curl "http://localhost:8000/search?query=Software+Engineer&location=New+York"
```

### Remote Jobs Only

```bash
# Search for remote positions
curl "http://localhost:8000/search?query=Full+Stack+Developer&remote_only=true"
```

### Filter by Date Posted

```bash
# Jobs posted this week
curl "http://localhost:8000/search?query=DevOps&date_posted=week"
```

### Specific Provider

```bash
# Only use SerpAPI
curl "http://localhost:8000/search?query=Data+Analyst&provider=serpapi"
```

### Python Example

```python
import httpx

async def search_jobs():
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "http://localhost:8000/search",
            params={
                "query": "Machine Learning Engineer",
                "location": "San Francisco",
                "limit": 20,
                "remote_only": True
            }
        )
        data = response.json()

        print(f"Found {data['total_results']} jobs")
        for job in data['jobs']:
            print(f"- {job['title']} at {job['company']}")
```

### JavaScript/TypeScript Example

```typescript
const searchJobs = async () => {
  const params = new URLSearchParams({
    query: "React Developer",
    location: "Remote",
    limit: "10",
    remote_only: "true"
  });

  const response = await fetch(`http://localhost:8000/search?${params}`);
  const data = await response.json();

  console.log(`Found ${data.total_results} jobs`);
  data.jobs.forEach(job => {
    console.log(`${job.title} at ${job.company}`);
  });
};
```

## Response Schema

### JobListing

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Job title |
| `company` | string | Company name |
| `location` | string | Job location |
| `description` | string | Full job description |
| `url` | string | Job posting URL |
| `source` | string | Data source (serpapi, jsearch) |
| `employment_type` | string | FULLTIME, PARTTIME, CONTRACTOR, INTERN |
| `salary_min` | float | Minimum salary |
| `salary_max` | float | Maximum salary |
| `salary_currency` | string | Currency code (USD, EUR, etc.) |
| `salary_period` | string | YEAR, MONTH, HOUR |
| `date_posted` | string | ISO date when posted |
| `is_remote` | boolean | Is this a remote position |
| `company_logo` | string | Company logo URL |
| `apply_url` | string | Direct application URL |
| `benefits` | array | List of benefits |
| `requirements` | array | List of requirements |
| `tags` | array | Job tags/categories |

## Getting API Keys

### SerpAPI (Google Jobs)

1. Go to [https://serpapi.com/](https://serpapi.com/)
2. Sign up for a free account
3. Free tier includes 100 searches/month
4. Copy your API key from the dashboard
5. Add to `api/.env` as `SERPAPI_KEY=your_key`

### JSearch (RapidAPI)

1. Go to [https://rapidapi.com/](https://rapidapi.com/)
2. Sign up for a free account
3. Subscribe to [JSearch API](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)
4. Free tier available with limited requests
5. Copy your RapidAPI key
6. Add to `api/.env` as `JSEARCH_API_KEY=your_key`

## Error Handling

The API includes comprehensive error handling:

- **Missing API Keys**: Providers without configured keys are skipped
- **API Failures**: Individual provider failures don't crash the entire request
- **Rate Limiting**: Respects provider rate limits
- **Validation**: Request parameters are validated via Pydantic

When a provider fails, the error is included in the response:

```json
{
  "query": "Developer",
  "total_results": 5,
  "jobs": [...],
  "provider_stats": {
    "serpapi": 5
  },
  "errors": {
    "jsearch": "API rate limit exceeded"
  }
}
```

## Development

### Project Structure

```
api/
├── __init__.py           # Package initialization
├── main.py               # FastAPI application
├── models.py             # Pydantic models
├── config.py             # Configuration management
├── .env.example          # Example environment variables
├── .env                  # Your API keys (gitignored)
├── README.md             # This file
└── providers/            # Job data providers
    ├── __init__.py
    ├── base.py           # Base provider class
    ├── serpapi.py        # SerpAPI provider
    └── jsearch.py        # JSearch provider
```

### Adding a New Provider

To add a new job data provider:

1. Create a new file in `api/providers/` (e.g., `adzuna.py`)
2. Extend the `BaseJobProvider` class
3. Implement required methods: `search()`, `is_available()`, `get_description()`
4. Register the provider in `api/main.py`
5. Add configuration to `api/config.py`
6. Update `.env.example` with new API key variables

Example:

```python
# api/providers/newprovider.py
from .base import BaseJobProvider
from ..models import JobListing
from ..config import settings

class NewProvider(BaseJobProvider):
    def __init__(self):
        self.api_key = settings.new_provider_key

    def is_available(self) -> bool:
        return self.api_key is not None

    def get_description(self) -> str:
        return "New Provider - Description"

    async def search(self, query, location=None, **kwargs):
        # Implement search logic
        return []
```

## Deployment

### Docker (Coming Soon)

A Dockerfile will be provided for easy containerized deployment.

### Production Considerations

- Add authentication/authorization
- Implement rate limiting
- Add caching (Redis)
- Set up monitoring and logging
- Use a production ASGI server (Gunicorn + Uvicorn)
- Configure CORS properly for your domain
- Set up HTTPS/SSL certificates

## License

This project is part of the Stapply Data Aggregator.

## Support

For issues or questions:
- Check the [API documentation](http://localhost:8000/docs)
- Review provider documentation (SerpAPI, JSearch)
- Check API key configuration

## Roadmap

- [ ] Add more providers (Adzuna, The Muse, etc.)
- [ ] Implement caching layer
- [ ] Add authentication
- [ ] Semantic search capabilities
- [ ] Job alerts/webhooks
- [ ] Analytics endpoints
- [ ] Docker containerization
- [ ] Rate limiting per API key
