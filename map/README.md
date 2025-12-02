# Stapply Job Map

A beautiful, dark-mode interactive map visualizer for exploring AI job opportunities from top companies worldwide. Built with React, TypeScript, and Mapbox GL.

**Stapply Job Map** helps you discover AI jobs from leading companies like OpenAI, Anthropic, Mistral AI, DeepMind, Cohere, Hugging Face, and more. Filter by location, company, and job title with our AI-powered assistant.

## Features

- **Minimalist Dark UI**: Ultra-clean glassmorphic design with subtle blur effects
- **Smart Clustering**: Automatically clusters nearby jobs with pulsing animations
- **Progressive Loading**: Map appears instantly, jobs load in the background
- **Auto-Save Progress**: Never lose geocoding progress - automatic saves every 5 seconds
- **Multi-Browser Support**: Share progress across browsers via localStorage + CSV
- **3-Tier Caching**: Hardcoded cities + localStorage + CSV for maximum speed
- **Interactive Popups**: Modern, minimalist job detail cards with direct application links
- **Neon Markers**: Color-coded glowing markers (cyan → green → yellow → orange → pink)
- **Export Functionality**: Download geocoded data with one click

## Setup

### 1. Get a Mapbox Token

1. Sign up for a free account at [Mapbox](https://www.mapbox.com/)
2. Create an access token from your account dashboard
3. Copy the token

### 2. Configure Environment

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your Mapbox token:

```
VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91ciIsImEiOiJ0b2tlbiJ9...
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## How It Works

### Data Processing Pipeline

1. **CSV Loading**: Loads the 143k job dataset from `public/jobs.csv`
2. **Strategic Sampling**: Samples 500 jobs ensuring:
   - Geographic diversity (includes jobs from all major locations)
   - Company diversity (includes multiple companies per location)
   - Proportional representation (more jobs from high-density areas)
3. **Smart Geocoding** (3-tier fallback system):
   - **Tier 1**: Hardcoded coordinates for 80+ major cities (instant, no API calls)
   - **Tier 2**: CSV cache from `public/jobs_map.csv` (instant)
   - **Tier 3**: Nominatim API for new locations (1 req/sec, free)
4. **Progressive Rendering**: Markers appear on map as they're geocoded
5. **Auto-Export**: Automatically downloads updated `jobs_map.csv` after completion
6. **Manual Export**: Click "Export Data" button anytime to download cache

### Clustering Algorithm

- **Distance-Based**: Groups jobs within ~50km at low zoom levels
- **Dynamic**: Cluster distance decreases as you zoom in
- **Performance**: No clustering above zoom level 10 for crisp detail
- **Visual Feedback**: Size and color indicate cluster density

### Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Mapbox GL JS** - Map rendering
- **react-map-gl** - React wrapper for Mapbox
- **PapaParse** - CSV parsing
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility styles

## Data Format

The app expects a CSV with these columns:

- `url` - Link to job posting
- `title` - Job title
- `location` - Location string (e.g., "San Francisco, California, United States")
- `company` - Company name
- `ats_id` - ATS identifier
- `id` - Unique job ID

## Customization

### Adjust Sample Size

Edit the sample size in `src/App.tsx`:

```typescript
const sampledJobs = sampleJobsStrategically(jobs, 5000); // Change 5000 to your desired size
```

### Change Map Style

Edit the map style in `src/components/JobMap.tsx`:

```typescript
mapStyle="mapbox://styles/mapbox/dark-v11" // Try: streets-v12, light-v11, satellite-v9
```

### Modify Cluster Colors

Update the `getClusterColor` function in `JobMap.tsx`:

```typescript
const getClusterColor = (count: number): string => {
  if (count < 5) return '#your-color';
  // ... customize color thresholds
};
```

## Geocoding System

The app uses a smart multi-layer caching system with **automatic progress saving**. You can reload the page or switch browsers without losing progress!

### Progress Persistence

**Auto-Save Features:**
- ✅ Saves to localStorage every 5 seconds
- ✅ Immediate save every 10 locations
- ✅ Backup copy in case of corruption
- ✅ Cleanup on page close/refresh
- ✅ Works across browser tabs
- ✅ Survives page reloads

**Multi-Browser Sharing:**
1. Geocode locations in Chrome
2. Download `jobs_map.csv` (auto-exported when done)
3. Place in `public/` folder
4. Open in Firefox/Safari - instantly loads your progress!

### Tier 1: Hardcoded Cities (80+ locations)

Pre-configured coordinates for major global cities:
- **US**: San Francisco, NYC, LA, Chicago, Seattle, Austin, Boston, etc.
- **Canada**: Toronto, Vancouver, Montreal, Calgary
- **Europe**: London, Paris, Berlin, Amsterdam, Barcelona, etc.
- **Asia**: Tokyo, Singapore, Seoul, Hong Kong, Shanghai, Bangalore
- **Other**: Sydney, Dubai, São Paulo, Mexico City, etc.

**Benefits**: Instant, zero API calls, works offline

### Tier 2: CSV Cache (`jobs_map.csv`)

Pre-populated with 80+ major cities, grows as new locations are geocoded.

**Format**:
```csv
location,lat,lng
"San Francisco, California, United States",37.7749,-122.4194
"New York, New York, United States",40.7128,-74.0060
```

**Usage**:
1. **First Run**: Loads pre-populated cache (80+ cities ready to go)
2. **New Locations**: Geocoded via API, added to cache
3. **Auto-Export**: Downloads updated `jobs_map.csv` after completion
4. **Manual Export**: Click "Export Data" button anytime

**Benefits**: Shareable, version-controllable, persistent

### Tier 3: Nominatim API

OpenStreetMap's free geocoding API for locations not in Tier 1 or 2.
- Rate limit: 1 request/second
- No API key needed
- Results automatically cached

## Performance

- **Initial Load**: Instant (with cache), 1-5 minutes (without cache)
- **Geocoding**: ~1 second per location (only for new locations)
- **Cache**: Persistent via CSV file in `public/` folder
- **Map Rendering**: 60fps with smooth animations and progressive loading
- **Progressive Loading**: Map interactive immediately, jobs appear as geocoded

## Troubleshooting

### "No Mapbox token found" warning
Make sure you've created a `.env` file with your `VITE_MAPBOX_TOKEN`

### Geocoding is slow
This is normal on first run. The app geocodes locations at 1 request/second to respect API rate limits. Results are cached, so subsequent loads are instant.

### Map doesn't load
1. Check your Mapbox token is valid
2. Ensure you have internet connection
3. Check browser console for errors

## Future Enhancements

- Search/filter functionality
- Company and location filters
- Export selected jobs to CSV
- Custom marker icons per company/industry
- Heatmap view option
- Mobile-optimized interface

## License

MIT
