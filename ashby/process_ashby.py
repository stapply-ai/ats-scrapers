import json
from pathlib import Path
from typing import Optional
from uuid import UUID
import sys

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import (
    create_engine,
    text,
    Column,
    String,
    Boolean,
    DateTime,
    Float,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import declarative_base, sessionmaker
from openai import OpenAI

from models.ashby import AshbyApiResponse, AshbyJob
from models.db import DatabaseJob

Base = declarative_base()


class CompanyTable(Base):
    __tablename__ = "companies"
    id = Column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name = Column(String, unique=True, nullable=False)


class JobTable(Base):
    __tablename__ = "jobs"
    id = Column(PGUUID(as_uuid=True), primary_key=True)
    url = Column(String, nullable=False)
    title = Column(String, nullable=False)
    location = Column(String)
    company = Column(String, nullable=False)
    description = Column(Text)
    employment_type = Column(String)
    industry = Column(String)
    embedding = Column(Text)
    posted_at = Column(DateTime)
    created_at = Column(DateTime, server_default=text("now()"))
    source = Column(String)
    is_active = Column(Boolean, default=True)
    added_by_user = Column(Boolean, default=False)
    remote = Column(Boolean)
    wfh = Column(Boolean)
    application_url = Column(String)
    language = Column(String)
    title_embedding = Column(Text)
    verified_at = Column(DateTime)
    lon = Column(Float)
    lat = Column(Float)
    country = Column(String)
    point = Column(String)
    salary_min = Column(Float)
    salary_max = Column(Float)
    salary_currency = Column(String)
    salary_period = Column(String)
    city = Column(String)
    ats_type = Column(String)
    company_id = Column(PGUUID(as_uuid=True))


def get_or_create_company(session, company_name: str) -> UUID:
    """Get existing company or create new one."""
    company = session.query(CompanyTable).filter_by(name=company_name).first()
    if company:
        return company.id

    new_company = CompanyTable(name=company_name)
    session.add(new_company)
    session.commit()
    return new_company.id


def generate_embedding(client: OpenAI, text: str) -> Optional[str]:
    """Generate embedding using OpenAI API."""
    try:
        response = client.embeddings.create(input=text, model="text-embedding-3-small")
        embedding_values = response.data[0].embedding
        # Convert to PostgreSQL vector format: [1.0, 2.0, 3.0]
        return str(embedding_values)
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None


def convert_ashby_to_database_job(
    ashby_job: AshbyJob,
    company_name: str,
    company_id: UUID,
    description_embedding: Optional[str],
    title_embedding: Optional[str],
) -> DatabaseJob:
    """Convert AshbyJob to DatabaseJob."""
    return DatabaseJob(
        id=UUID(ashby_job.id),
        url=ashby_job.job_url,
        title=ashby_job.title,
        location=ashby_job.location,
        company=company_name,
        description=ashby_job.description_plain,
        employment_type=ashby_job.employment_type,
        remote=ashby_job.is_remote,
        application_url=ashby_job.apply_url,
        posted_at=ashby_job.published_at,
        source="ashby",
        ats_type="ashby",
        company_id=company_id,
        embedding=description_embedding,
        title_embedding=title_embedding,
        is_active=ashby_job.is_listed,
    )


def process_ashby_companies(
    database_url: str, openai_api_key: str, companies_folder: str = "./companies"
):
    """
    Process Ashby company JSON files and save to database.

    Args:
        database_url: PostgreSQL connection string
        openai_api_key: OpenAI API key
        companies_folder: Path to the folder containing company JSON files
    """
    # Initialize database connection
    engine = create_engine(database_url)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Initialize OpenAI client
    openai_client = OpenAI(api_key=openai_api_key)

    companies_path = Path(companies_folder)

    if not companies_path.exists():
        print(f"Error: Folder '{companies_folder}' does not exist")
        return

    total_jobs_processed = 0

    # Iterate through all JSON files
    for json_file in companies_path.glob("*.json"):
        try:
            # Extract company name from filename and capitalize first letter
            company_name = json_file.stem.replace("-", " ").replace("_", " ")
            company_name = (
                company_name[0].upper() + company_name[1:]
                if company_name
                else company_name
            )

            print(f"\nProcessing {json_file.name} (Company: {company_name})...")

            # Get or create company
            company_id = get_or_create_company(session, company_name)

            # Load JSON file
            with open(json_file, "r", encoding="utf-8") as f:
                company_data = json.load(f)

            # Parse using Pydantic model
            ashby_response = AshbyApiResponse(**company_data)

            jobs_count = len(ashby_response.jobs)
            print(f"Found {jobs_count} jobs for {company_name}")

            # Process each job
            for idx, ashby_job in enumerate(ashby_response.jobs, 1):
                try:
                    print(f"  Processing job {idx}/{jobs_count}: {ashby_job.title}")

                    # Generate embeddings
                    description_embedding = None
                    if ashby_job.description_plain:
                        description_embedding = generate_embedding(
                            openai_client, ashby_job.description_plain
                        )

                    title_location_text = f"{ashby_job.title}; {ashby_job.location}"
                    title_embedding = generate_embedding(
                        openai_client, title_location_text
                    )

                    # Convert to DatabaseJob
                    db_job = convert_ashby_to_database_job(
                        ashby_job,
                        company_name,
                        company_id,
                        description_embedding,
                        title_embedding,
                    )

                    # Insert into database
                    job_dict = db_job.model_dump(exclude_none=False)

                    # Check if job already exists
                    existing = (
                        session.query(JobTable).filter_by(id=job_dict["id"]).first()
                    )
                    if existing:
                        # Update existing job
                        for key, value in job_dict.items():
                            setattr(existing, key, value)
                        print(f"    Updated existing job: {ashby_job.title}")
                    else:
                        # Insert new job
                        new_job = JobTable(**job_dict)
                        session.add(new_job)
                        print(f"    Inserted new job: {ashby_job.title}")

                    session.commit()
                    total_jobs_processed += 1

                except Exception as e:
                    print(f"    Error processing job '{ashby_job.title}': {e}")
                    session.rollback()
                    continue

        except json.JSONDecodeError as e:
            print(f"Error parsing JSON in {json_file.name}: {e}")
        except Exception as e:
            print(f"Error processing {json_file.name}: {e}")

    session.close()
    print(f"\n{'=' * 50}")
    print(f"Total jobs processed and saved: {total_jobs_processed}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Process Ashby companies and save to database"
    )
    parser.add_argument(
        "--database-url", required=True, help="PostgreSQL connection string"
    )
    parser.add_argument("--openai-api-key", required=True, help="OpenAI API key")
    parser.add_argument(
        "--companies-folder", default="./companies", help="Path to companies folder"
    )

    args = parser.parse_args()

    process_ashby_companies(
        database_url=args.database_url,
        openai_api_key=args.openai_api_key,
        companies_folder=args.companies_folder,
    )
