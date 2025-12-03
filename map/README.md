# Stapply Job Map

A dark-mode interactive map for exploring AI job opportunities from top companies worldwide. Built with **Next.js**, **React**, **TypeScript**, and **Mapbox GL**.

**Stapply Job Map** helps you discover AI jobs from leading companies like OpenAI, Anthropic, Mistral AI, DeepMind, Cohere, Hugging Face, and more. Filter by location, company, and job title with the built-in AI assistant.

<blockquote class="twitter-tweet" data-media-max-width="560"><p lang="en" dir="ltr">Find your next top job at leading AI companies super fast using Stapply Map. <a href="https://t.co/CUjHVa7xcT">pic.twitter.com/CUjHVa7xcT</a></p>&mdash; Kalil (@kalil0321) <a href="https://twitter.com/kalil0321/status/1992360484780253555?ref_src=twsrc%5Etfw">November 22, 2025</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

## Setup

### 1. Prerequisites

- Node.js 18+ (LTS recommended)
- npm (comes with Node)

### 2. Get a Mapbox Token

1. Sign up for a free account at [Mapbox](https://www.mapbox.com/)
2. Create an access token from your account dashboard
3. Copy the token

### 3. Configure Environment

Create a local env file from the example:

```bash
cp env.example .env.local
```

Edit `.env.local` and set at least:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieW91ciIsImEiOiJ0b2tlbiJ9...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Optional variables:

- `MISTRAL_API_KEY` – enables the AI assistant for search and explanations
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` – enable Redis-backed job alerts

### 4. Install Dependencies

From the `map` directory:

```bash
npm install
```

### 5. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## How It Works

### Data Processing

1. **CSV Loading**: Loads the pre-processed job dataset from `public/ai.csv`
2. **Coordinate Parsing**: Parses `lat` and `lon`/`lng` columns into map markers
3. **Filtering**: Supports filtering by company, location, and search text
4. **Progressive Rendering**: Markers and clusters update as you move/zoom the map

### Clustering Algorithm

- **Distance-Based**: Groups jobs within ~50km at low zoom levels
- **Dynamic**: Cluster distance decreases as you zoom in
- **Performance**: No clustering above zoom level 10 for crisp detail
- **Visual Feedback**: Size and color indicate cluster density

### Tech Stack

- **Next.js 16** - App framework and routing
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Mapbox GL JS** - Map rendering
- **react-map-gl** - React wrapper for Mapbox
- **PapaParse** - CSV parsing
- **Tailwind CSS** - Utility styles

## Data Format

The app expects `public/ai.csv` with at least these columns:

- `url` - Link to job posting
- `title` - Job title
- `location` - Location string (e.g., "San Francisco, California, United States")
- `company` - Company name
- `ats_id` - ATS identifier
- `id` - Unique job ID
- `lat` - Latitude (number)
- `lon` or `lng` - Longitude (number)

## Customization

### Change Map Style

Edit the map style in `src/components/job-map.tsx`:

```typescript
mapStyle="mapbox://styles/mapbox/dark-v11" // Try: streets-v12, light-v11, satellite-v9
```

### Modify Cluster Colors

Update the `getClusterColor` function in `src/components/job-map.tsx`:

```typescript
const getClusterColor = (count: number): string => {
  if (count < 5) return '#your-color';
  // ... customize color thresholds
};
```

## Performance

- **Initial Load**: Instant (with cache), 1-5 minutes (without cache)
- **Geocoding**: ~1 second per location (only for new locations)
- **Cache**: Persistent via CSV file in `public/` folder
- **Map Rendering**: 60fps with smooth animations and progressive loading
- **Progressive Loading**: Map interactive immediately, jobs appear as geocoded

## Troubleshooting

### "No Mapbox token found" warning
Make sure you've created a `.env.local` file with your `NEXT_PUBLIC_MAPBOX_TOKEN`.

### Map doesn't load
1. Check your Mapbox token is valid (verify all domains are allowed if runing locally)
2. Ensure you have internet connection
3. Check browser console for errors

## License

MIT
