document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // DOM Elements
    const userIdDisplay = document.getElementById('user-id-display');
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const fileBtn = document.getElementById('file-btn');
    const fileInput = document.getElementById('file-input');
    const emojiBtn = document.getElementById('emoji-btn');
    const uploadPreview = document.getElementById('upload-preview');
    const previewText = document.getElementById('preview-text');
    const removeUploadBtn = document.getElementById('remove-upload-btn');

    // State
    let currentUser = null;
    let selectedFile = null;

    // Initialization: Generate or Retrieve User ID
    const initializeUser = () => {
        let storedId = localStorage.getItem('ghost_chat_user_id');
        if (!storedId) {
            // Generate random 4 digit ID logic as requested
            const randomCode = Math.floor(Math.random() * 9000) + 1000;
            storedId = `user_${randomCode}`;
            localStorage.setItem('ghost_chat_user_id', storedId);
        }
        currentUser = storedId;
        userIdDisplay.textContent = currentUser;
    };

    initializeUser();

    // Utility: Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value === '') {
            this.style.height = 'auto'; // Reset if empty
        }
    });

    // Utility: Scroll to bottom
    const scrollToBottom = () => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    // Socket.IO Events
    socket.on('connect', () => {
        console.log('Connected to server');
        // Visual indicator handled by CSS .online
    });

    socket.on('message_history', (messages) => {
        chatMessages.innerHTML = ''; // Clear current
        messages.forEach(msg => appendMessage(msg));
        scrollToBottom();
    });

    socket.on('chat_message', (msg) => {
        appendMessage(msg);
        scrollToBottom();
    });

    // Message Rendering Logic
    const appendMessage = (msgData) => {
        const { userId, text, emoji, fileUrl, createdAt } = msgData;
        const isMe = userId === currentUser;

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(isMe ? 'my-message' : 'other-message');

        // Formatter for time
        const timeString = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Meta info
        const metaDiv = document.createElement('div');
        metaDiv.classList.add('message-meta');
        metaDiv.textContent = `${userId} • ${timeString}`;

        // Bubble
        const bubbleDiv = document.createElement('div');
        bubbleDiv.classList.add('message-bubble');

        // Text Content
        if (text) {
            // Very simple linkification and basic escaping for safety
            const escapedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const p = document.createElement('p');
            p.innerHTML = escapedText.replace(/\n/g, '<br>');
            bubbleDiv.appendChild(p);
        }

        // Emoji Content (If we send just a large emoji)
        if (emoji && !text) {
            const span = document.createElement('span');
            span.classList.add('emoji');
            span.textContent = emoji;
            bubbleDiv.appendChild(span);
        }

        // Image Content
        if (fileUrl) {
            const img = document.createElement('img');
            img.src = fileUrl;
            img.classList.add('message-image');
            img.alt = "Uploaded image";
            // Wait for image to load to scroll correctly
            img.onload = scrollToBottom;
            bubbleDiv.appendChild(img);
        }

        messageDiv.appendChild(metaDiv);
        messageDiv.appendChild(bubbleDiv);
        chatMessages.appendChild(messageDiv);
    };

    // File Upload Handling
    fileBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            selectedFile = e.target.files[0];
            
            // Check size (10MB limit)
            if (selectedFile.size > 10 * 1024 * 1024) {
                alert('File is too large. Limit is 10MB.');
                clearUpload();
                return;
            }

            previewText.textContent = `📎 ${selectedFile.name}`;
            uploadPreview.classList.remove('hidden');
        }
    });

    removeUploadBtn.addEventListener('click', () => {
        clearUpload();
    });

    const clearUpload = () => {
        selectedFile = null;
        fileInput.value = '';
        uploadPreview.classList.add('hidden');
        previewText.textContent = '';
    };

    // Send Message Logic
    const sendMessage = async () => {
        const text = messageInput.value.trim();
        
        if (!text && !selectedFile) return;

        // Visual feedback
        sendBtn.style.opacity = '0.5';
        sendBtn.disabled = true;

        let finalFileUrl = '';

        try {
            // Handle file upload if exists
            if (selectedFile) {
                const formData = new FormData();
                formData.append('media', selectedFile);

                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error('Upload failed');
                
                const data = await response.json();
                finalFileUrl = data.fileUrl;
            }

            // Emit via socket
            socket.emit('chat_message', {
                userId: currentUser,
                text: text,
                emoji: '', // Can expand to dedicated emoji picker if needed
                fileUrl: finalFileUrl
            });

            // Cleanup
            messageInput.value = '';
            messageInput.style.height = 'auto';
            clearUpload();
            messageInput.focus();

        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            sendBtn.style.opacity = '1';
            sendBtn.disabled = false;
        }
    };

    // Submit on Enter (Shift+Enter for new line)
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent default new line
            sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);

    // Simple Emoji feature implementation (inserts random for MVP demonstration, or opens picker)
    const emojis = ['🚀', '✨', '🪐', '👽', '☄️', '🌌', '👾', '💥'];
    emojiBtn.addEventListener('click', () => {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        messageInput.value += randomEmoji;
        messageInput.focus();
    });
});
