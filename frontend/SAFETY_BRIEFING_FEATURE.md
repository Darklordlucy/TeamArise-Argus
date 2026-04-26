# Safety Briefing Modal Feature

## Overview
The Safety Briefing Modal provides AI-generated, personalized safety tips for motorcycle riders based on their chosen route's specific characteristics.

## Files Created/Modified

### New Files:
1. **`frontend/src/components/SafetyBriefingModal.jsx`**
   - React component that displays the safety briefing modal
   - Fetches AI-generated safety tips from OpenRouter API
   - Shows route comparison metrics (danger reduction, hazards avoided, extra distance)

2. **`frontend/.env`**
   - Contains the OpenRouter API key
   - Key: `REACT_APP_OPENROUTER_API_KEY`

### Modified Files:
1. **`frontend/src/pages/MapPage.jsx`**
   - Added import for SafetyBriefingModal
   - Added `briefingData` state
   - Modified `handleFindRoute` to prepare briefing data after route calculation
   - Added modal component to JSX

## How It Works

### 1. Route Calculation
When a user clicks "Find Safe Route":
- The app calls the `/api/route-comparison` endpoint
- Receives both safe and fast route data with metrics
- Prepares briefing data with:
  - Origin and destination coordinates
  - Safe route metrics (distance, time, danger score, hazard count)
  - Fast route metrics
  - Safety improvement stats (danger reduction %, hazards avoided, extra distance)

### 2. Modal Display
After route calculation completes:
- The SafetyBriefingModal automatically appears
- Shows 3 key metrics at the top:
  - **DANGER CUT**: Percentage reduction in danger score
  - **HAZARDS AVOIDED**: Number of hazards avoided vs fast route
  - **EXTRA DIST**: Additional distance for safety

### 3. AI Briefing Generation
The modal calls OpenRouter API with:
- **Model**: `google/gemma-3-8b-it:free`
- **Prompt**: Includes route stats and asks for 3 specific safety tips
- **Output**: 3 actionable sentences tailored to the route

Example prompt:
```
You are ArgusAI, a road safety advisor for Indian motorcycle riders in Navi Mumbai.

A rider is about to travel from 18.9894, 73.1175 to 19.0477, 73.0769.

Safe route stats:
- Distance: 5.2 km
- Duration: 12.5 minutes
- Average danger score: 0.15 (scale 0–1)
- Hazards on route: 8

Compared to the fast route:
- Danger reduced by: 57.1%
- Hazards avoided: 10
- Extra distance: 0.5 km

Write exactly 3 sentences. Each sentence must be a specific, actionable safety tip...
```

### 4. User Actions
Users can:
- **↻ Regenerate**: Get a new AI-generated briefing
- **Start Riding →**: Close modal and proceed with the route
- **✕ (Close)**: Dismiss the modal

## API Configuration

### OpenRouter API
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Model**: `google/gemma-3-8b-it:free` (free tier)
- **Max Tokens**: 200
- **Temperature**: 0.7

### Environment Variable
Add to `frontend/.env`:
```
REACT_APP_OPENROUTER_API_KEY=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
```

## Styling

The modal features a dark, cyberpunk-inspired design:
- **Background**: Dark overlay with blur effect
- **Modal**: Dark card with neon green accents
- **Font**: JetBrains Mono (monospace)
- **Colors**:
  - Primary: `#4ade80` (neon green)
  - Warning: `#fbbf24` (amber)
  - Neutral: `#94a3b8` (slate)
  - Background: `#0d1117` (dark)

## Error Handling

The modal handles errors gracefully:
- Shows loading spinner while generating briefing
- Displays error message if API call fails
- Allows regeneration if initial attempt fails

Common errors:
- **API Key Invalid**: Check `.env` file
- **Rate Limit**: OpenRouter free tier limits
- **Network Error**: Check internet connection

## Testing

### Manual Test:
1. Start the frontend: `npm start`
2. Navigate to `/map`
3. Select origin and destination (or use quick routes)
4. Click "Find Safe Route"
5. Modal should appear automatically with AI briefing

### Expected Behavior:
- Modal appears after route calculation
- Shows 3 metrics at top
- Displays loading spinner initially
- Shows 3-sentence safety briefing after ~2-3 seconds
- Buttons work correctly (Regenerate, Start Riding, Close)

## Integration Points

### Data Flow:
```
MapPage.jsx
  ↓ (user clicks "Find Safe Route")
routeService.compareRoutes()
  ↓ (API call to backend)
/api/route-comparison endpoint
  ↓ (returns route data)
MapPage.handleFindRoute()
  ↓ (prepares briefingData)
SafetyBriefingModal
  ↓ (calls OpenRouter API)
AI-generated safety tips
```

### Props Interface:
```javascript
SafetyBriefingModal({
  routeData: {
    originText: string,
    destText: string,
    safeMetrics: {
      distance_km: number,
      time_min: number,
      avg_danger: number,
      hazard_count: number
    },
    fastMetrics: { ... },
    improvement: {
      danger_reduction_pct: number,
      extra_distance_km: number,
      extra_time_min: number,
      avoided_hazards: number
    }
  },
  onClose: () => void
})
```

## Future Enhancements

Potential improvements:
1. **Voice Briefing**: Text-to-speech for hands-free listening
2. **Save Briefings**: Store past briefings for reference
3. **Weather Integration**: Include current weather in tips
4. **Time-of-Day Tips**: Adjust tips for night/day riding
5. **Multilingual**: Support Hindi, Marathi, etc.
6. **Offline Mode**: Cache common tips for offline use

## Troubleshooting

### Modal doesn't appear:
- Check console for errors
- Verify route data is being set correctly
- Check `briefingData` state in React DevTools

### AI briefing fails:
- Verify OpenRouter API key in `.env`
- Check browser console for API errors
- Test API key with curl:
  ```bash
  curl https://openrouter.ai/api/v1/chat/completions \
    -H "Authorization: Bearer YOUR_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model":"google/gemma-3-8b-it:free","messages":[{"role":"user","content":"test"}]}'
  ```

### Styling issues:
- Ensure JetBrains Mono font is loaded
- Check z-index conflicts with other components
- Verify CSS animations are working

## Dependencies

Required packages (already in package.json):
- `react` - Core React library
- `react-dom` - React DOM rendering

No additional dependencies needed!

## Security Notes

- API key is stored in `.env` (not committed to git)
- Add `frontend/.env` to `.gitignore`
- For production, use environment variables on hosting platform
- Consider rate limiting on backend to prevent API abuse

## Performance

- Modal renders only when `briefingData` is set
- API call is async and doesn't block UI
- Loading state prevents multiple simultaneous requests
- Modal unmounts cleanly when closed
