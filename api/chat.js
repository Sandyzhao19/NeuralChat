export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { prompt, parameters } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Get API token from environment variable
        const HF_API_TOKEN = process.env.HF_API_TOKEN;

        if (!HF_API_TOKEN) {
            return res.status(500).json({ error: 'API token not configured' });
        }

        // Use Hugging Face Router API v1 with OpenAI-compatible format
        // Try multiple models in order of preference
        const models = [
            'Qwen/Qwen2.5-7B-Instruct',
            'mistralai/Mistral-7B-Instruct-v0.3',
            'microsoft/Phi-3-mini-4k-instruct',
            'meta-llama/Meta-Llama-3-8B-Instruct'
        ];

        let response;
        let data;
        let lastError;
        let usedModel;

        for (const model of models) {
            try {
                // Use OpenAI-compatible chat completions endpoint
                response = await fetch(
                    'https://api-inference.huggingface.co/models/' + model + '/v1/chat/completions',
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${HF_API_TOKEN}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            messages: [
                                { role: 'user', content: prompt }
                            ],
                            max_tokens: parameters?.max_new_tokens || 512,
                            temperature: parameters?.temperature || 0.7,
                            top_p: parameters?.top_p || 0.9
                        })
                    }
                );

                // Read the response body once
                data = await response.json();

                // If successful or model is loading, use this response
                if (response.ok) {
                    usedModel = model;
                    break;
                }

                // If model is loading (503), wait and retry once
                if (response.status === 503) {
                    usedModel = model;
                    break;
                }

                // If not successful, save error and try next model
                lastError = { status: response.status, data: data, model: model };
                response = null;
                data = null;
            } catch (error) {
                lastError = { error: error.message, model: model };
                response = null;
                data = null;
                continue;
            }
        }

        if (!response || !data) {
            console.error('All models failed:', lastError);
            return res.status(500).json({
                error: 'All models failed to respond',
                details: lastError
            });
        }

        // Return the response with model info
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        // Convert OpenAI format to HF Inference format for compatibility
        let responseData;
        if (data.choices && data.choices[0]?.message?.content) {
            // OpenAI format - convert to HF format
            responseData = [{
                generated_text: data.choices[0].message.content,
                model: usedModel
            }];
        } else if (Array.isArray(data)) {
            // Already in HF format
            responseData = data;
            responseData[0] = { ...responseData[0], model: usedModel };
        } else if (data.generated_text) {
            // HF format single object
            responseData = [{ ...data, model: usedModel }];
        } else {
            responseData = data;
        }

        return res.status(200).json(responseData);

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
