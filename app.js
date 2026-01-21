import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// State management
let generator;
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
        statusText.textContent = 'Loading AI Model...';
        
        // DistilGPT-2 - Proven to work in browser
        generator = await pipeline(
            'text-generation',
            'Xenova/distilgpt2',
            {
                progress_callback: (progress) => {
                    if (progress.status === 'progress') {
                        const percent = Math.round(progress.progress);
                        statusText.textContent = `Loading: ${percent}%`;
                    }
                }
            }
        );
        
        isReady = true;
        statusDot.classList.remove('loading');
        statusDot.classList.add('ready');
        statusText.textContent = 'Ready to Chat';
        sendButton.disabled = false;
        
        // Remove welcome message and add initial bot message
        removeWelcomeMessage();
        addMessage('bot', "Hi there! I'm NeuralChat, an AI running entirely in your browser. I'm powered by a smaller language model, so while I might not be as advanced as cloud-based AIs, I'm fast, private, and always available. What would you like to talk about?");
        
    } catch (error) {
        console.error('Error loading AI:', error);
        statusDot.classList.remove('loading');
        statusText.textContent = 'Error Loading AI';
        addMessage('bot', 'Sorry, I encountered an error loading the AI model. Please refresh the page and try again.');
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
        // Build conversational prompt for DistilGPT-2
        const contextLength = 2;
        const recentHistory = conversationHistory.slice(-contextLength * 2);
        
        let prompt = "The following is a helpful conversation with an AI assistant.\n\n";
        
        if (recentHistory.length > 0) {
            prompt += recentHistory
                .map(msg => `${msg.role === 'user' ? 'Human' : 'AI'}: ${msg.content}`)
                .join('\n') + '\n';
        }
        
        prompt += `Human: ${userMessage}\nAI:`;
        
        // Generate response
        const output = await generator(prompt, {
            max_new_tokens: 100,
            temperature: 0.8,
            do_sample: true,
            top_k: 50,
            top_p: 0.92,
            repetition_penalty: 1.3,
        });
        
        // Extract and clean the generated text
        let generatedText = output[0].generated_text;
        
        // Remove the prompt and extract only the AI's response
        generatedText = generatedText.substring(prompt.length).trim();
        
        // Stop at the first newline or "Human:" to avoid continuation
        generatedText = generatedText.split('\n')[0].split('Human:')[0].trim();
        
        // Clean up artifacts
        generatedText = generatedText.replace(/^(AI:|Assistant:)\s*/i, '');
        
        // Ensure proper sentence ending
        if (generatedText && !generatedText.match(/[.!?]$/)) {
            const lastPeriod = Math.max(
                generatedText.lastIndexOf('.'),
                generatedText.lastIndexOf('!'),
                generatedText.lastIndexOf('?')
            );
            if (lastPeriod > 15) {
                generatedText = generatedText.substring(0, lastPeriod + 1);
            }
        }
        
        // Fallback for empty responses
        if (!generatedText || generatedText.length < 10) {
            generatedText = "I understand. Could you tell me more about that?";
        }
        
        addMessage('bot', generatedText);
        
    } catch (error) {
        console.error('Error generating response:', error);
        addMessage('bot', "I'm having trouble generating a response. Could you try rephrasing your message?");
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