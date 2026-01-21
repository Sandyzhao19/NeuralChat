// API Configuration - use our proxy endpoint to avoid CORS issues
const API_URL = '/api/chat';

// State management
let conversationHistory = [];
let isReady = false;
let isGenerating = false;

// DOM elements
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const loadingContainer = document.getElementById('loadingContainer');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// Initialize the AI model
async function initializeAI() {
    try {
        statusDot.classList.add('loading');
        statusText.textContent = 'Connecting to AI...';

        // Test the API connection - but be lenient with errors
        const testResponse = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: "Hi",
                parameters: {
                    max_new_tokens: 5,
                    temperature: 0.7
                }
            })
        });

        const testData = await testResponse.json();

        // Check if it's a model loading error (503) - this is okay, we can proceed
        if (!testResponse.ok && testResponse.status !== 503) {
            // If we get an actual error response, log it but still allow the app to work
            console.warn('API test returned error:', testResponse.status, testData);
        }

        isReady = true;
        statusDot.classList.remove('loading');
        statusDot.classList.add('ready');
        statusText.textContent = 'Ready to Chat';
        sendButton.disabled = false;

        // Remove welcome message and add initial bot message
        removeWelcomeMessage();

        // Determine which model is being used from the test
        let modelInfo = "I'm NeuralChat, powered by Hugging Face's AI models.";
        if (testData && testData.model) {
            modelInfo = `I'm NeuralChat, powered by ${testData.model}.`;
        }

        addMessage('bot', `Hi there! ${modelInfo} I'm a capable AI assistant ready to help with questions, creative tasks, and conversations. What would you like to talk about?`);

    } catch (error) {
        console.error('Error connecting to AI:', error);

        // Even on connection error, let's allow the user to try
        isReady = true;
        statusDot.classList.remove('loading');
        statusDot.classList.add('ready');
        statusText.textContent = 'Ready to Chat';
        sendButton.disabled = false;

        removeWelcomeMessage();
        addMessage('bot', 'Hi there! I\'m NeuralChat. The connection test had some issues, but let\'s try chatting anyway. Send me a message!');
    }
}

// Remove welcome message
function removeWelcomeMessage() {
    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => welcomeMessage.remove(), 300);
    }
}

// Add message to chat
function addMessage(sender, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = sender === 'user' ? '👤' : '🤖';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = text;
    
    content.appendChild(textDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Add to conversation history
    conversationHistory.push({ role: sender, content: text });
}

// Generate AI response
async function generateResponse(userMessage) {
    if (!isReady || isGenerating) return;

    isGenerating = true;
    loadingContainer.classList.add('active');

    try {
        // Build conversation context for Qwen model
        const contextLength = 5; // Keep last 5 exchanges
        const recentHistory = conversationHistory.slice(-contextLength * 2);

        // Build messages array for chat format
        const messages = [
            {
                role: "system",
                content: "You are NeuralChat, a helpful, friendly, and knowledgeable AI assistant. Provide clear, concise, and helpful responses."
            }
        ];

        // Add conversation history
        recentHistory.forEach(msg => {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        });

        // Add current user message
        messages.push({
            role: "user",
            content: userMessage
        });

        // Format for Qwen model (using ChatML format)
        let prompt = messages.map(msg => {
            if (msg.role === 'system') {
                return `<|im_start|>system\n${msg.content}<|im_end|>`;
            } else if (msg.role === 'user') {
                return `<|im_start|>user\n${msg.content}<|im_end|>`;
            } else {
                return `<|im_start|>assistant\n${msg.content}<|im_end|>`;
            }
        }).join('\n') + '\n<|im_start|>assistant\n';

        // Call Hugging Face API via proxy
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                parameters: {
                    max_new_tokens: 512,
                    temperature: 0.7,
                    top_p: 0.9,
                    do_sample: true,
                    return_full_text: false
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            // Handle model loading state (503)
            if (response.status === 503 || (errorData.error && errorData.error.includes('loading'))) {
                const waitTime = errorData.estimated_time || 20;
                addMessage('bot', `The AI model is starting up. This usually takes about ${Math.ceil(waitTime)} seconds. Please try sending your message again in a moment!`);
                return;
            }

            // Handle rate limiting
            if (response.status === 429) {
                addMessage('bot', "I'm receiving too many requests right now. Please wait a moment and try again.");
                return;
            }

            // Handle other errors
            console.error('API error:', response.status, errorData);
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();

        // Extract the generated text
        let generatedText = '';
        if (Array.isArray(data) && data[0]?.generated_text) {
            generatedText = data[0].generated_text.trim();
        } else if (data.generated_text) {
            generatedText = data.generated_text.trim();
        }

        // Clean up the response
        generatedText = generatedText
            .replace(/<\|im_end\|>.*$/s, '') // Remove any trailing tokens
            .replace(/<\|im_start\|>.*$/s, '')
            .trim();

        // Fallback for empty responses
        if (!generatedText || generatedText.length < 5) {
            generatedText = "I apologize, but I didn't generate a proper response. Could you please try asking again?";
        }

        addMessage('bot', generatedText);

    } catch (error) {
        console.error('Error generating response:', error);
        addMessage('bot', "I'm having trouble generating a response. The AI service might be temporarily unavailable. Please try again in a moment.");
    } finally {
        isGenerating = false;
        loadingContainer.classList.remove('active');
    }
}

// Send message
async function sendMessage() {
    const message = userInput.value.trim();
    
    if (!message || !isReady || isGenerating) return;
    
    // Add user message
    addMessage('user', message);
    userInput.value = '';
    adjustTextareaHeight();
    
    // Generate AI response
    await generateResponse(message);
}

// Auto-resize textarea
function adjustTextareaHeight() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

userInput.addEventListener('input', adjustTextareaHeight);

// Initialize on load
initializeAI();