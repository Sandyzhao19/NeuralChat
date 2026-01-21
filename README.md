# NeuralChat

An AI-powered chatbot using Hugging Face's Inference API with Qwen2.5-7B-Instruct model.

## Features

- Modern, responsive chat interface
- Powered by Hugging Face's free Inference API
- Serverless architecture using Vercel
- Conversation history management
- Multiple model fallback support

## Setup

### 1. Get a Hugging Face API Token

1. Sign up at [huggingface.co](https://huggingface.co)
2. Go to Settings → Access Tokens
3. Create a new token (read permissions are sufficient)

### 2. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

1. Click the button above or go to [vercel.com](https://vercel.com)
2. Import this repository
3. Add environment variable:
   - **Name**: `HF_API_TOKEN`
   - **Value**: Your Hugging Face API token
4. Deploy!

### 3. Local Development

1. Clone the repository
2. Create a `.env.local` file with:
   ```
   HF_API_TOKEN=your_token_here
   ```
3. Install Vercel CLI: `npm i -g vercel`
4. Run: `vercel dev`
5. Open `http://localhost:3000`

## Models Used

The chatbot tries these models in order:
1. Qwen/Qwen2.5-7B-Instruct (primary)
2. mistralai/Mistral-7B-Instruct-v0.2 (fallback)
3. microsoft/Phi-3-mini-4k-instruct (fallback)

## Tech Stack

- Pure JavaScript (no frameworks)
- Vercel Serverless Functions
- Hugging Face Inference API
- HTML/CSS for UI

## Project Structure

```
├── index.html          # Main UI
├── style.css          # Styles
├── app.js             # Frontend logic
├── api/
│   └── chat.js        # Serverless API endpoint
└── .env.local         # Local environment variables (create this)
```

## Notes

- The free Hugging Face API may have rate limits
- Models may take ~20 seconds to "warm up" on first use
- Get your own API token for better performance
- All conversation history is stored client-side only

## License

MIT
