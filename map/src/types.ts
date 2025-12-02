export interface Job {
  url: string;
  title: string;
  location: string;
  company: string;
  ats_id: string;
  id: string;
}

export interface JobMarker extends Job {
  lat: number;
  lng: number;
  salary_min?: string | null;
  salary_max?: string | null;
  salary_currency?: string | null;
  salary_period?: string | null;
  salary_summary?: string | null;
}

export interface JobAlert {
  id: string;
  email: string;
  companies: string[];
  locations: string[];
  keywords: string[];
  frequency: 'instant' | 'daily' | 'weekly';
  createdAt: string;
  isActive: boolean;
}
