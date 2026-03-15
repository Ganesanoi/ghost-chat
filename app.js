const SUPABASE_URL = 'https://bzdxjrlfzgclstydtaja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZHhqcmxmemdjbHN0eWR0YWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjcwNTAsImV4cCI6MjA4OTE0MzA1MH0.auHFtrSQ2qazyKEuDGlyg1j3AdLYQVbFNkTQYx8-Gd0';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
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
            this.style.height = 'auto';
        }
    });

    // Utility: Scroll to bottom
    const scrollToBottom = () => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    // Message Rendering Logic
    const appendMessage = (msgData) => {
        const { userId, text, emoji, fileUrl, createdAt } = msgData;
        
        // Prevent duplicate rendering
        if (document.getElementById(`msg-${msgData.messageId}`)) return;

        const isMe = userId === currentUser;

        const messageDiv = document.createElement('div');
        messageDiv.id = `msg-${msgData.messageId}`;
        messageDiv.classList.add('message');
        messageDiv.classList.add(isMe ? 'my-message' : 'other-message');

        const timeString = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const metaDiv = document.createElement('div');
        metaDiv.classList.add('message-meta');
        metaDiv.textContent = `${userId} • ${timeString}`;

        const bubbleDiv = document.createElement('div');
        bubbleDiv.classList.add('message-bubble');

        if (text) {
            const escapedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const p = document.createElement('p');
            p.innerHTML = escapedText.replace(/\n/g, '<br>');
            bubbleDiv.appendChild(p);
        }

        if (emoji && !text) {
            const span = document.createElement('span');
            span.classList.add('emoji');
            span.textContent = emoji;
            bubbleDiv.appendChild(span);
        }

        if (fileUrl) {
            const img = document.createElement('img');
            img.src = fileUrl;
            img.classList.add('message-image');
            img.alt = "Uploaded image";
            img.onload = scrollToBottom;
            bubbleDiv.appendChild(img);
        }

        messageDiv.appendChild(metaDiv);
        messageDiv.appendChild(bubbleDiv);
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    };

    // Load History
    const loadHistory = async () => {
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .gt('createdAt', twentyFourHoursAgo)
            .order('createdAt', { ascending: true });

        if (!error && messages) {
            chatMessages.innerHTML = '';
            messages.forEach(appendMessage);
            scrollToBottom();
        }
    };

    loadHistory();

    // Subscribe to Realtime Inserts
    supabase
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            appendMessage(payload.new);
            scrollToBottom();
        })
        .subscribe();


    // File Upload Handling
    fileBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            selectedFile = e.target.files[0];
            
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

        sendBtn.style.opacity = '0.5';
        sendBtn.disabled = true;

        let finalFileUrl = '';

        try {
            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
                
                const { data, error } = await supabase.storage
                    .from('uploads')
                    .upload(fileName, selectedFile);

                if (error) {
                    console.error('Storage Upload Error:', error);
                    alert("Failed to upload image. Please ensure a public storage bucket named 'uploads' exists in your Supabase project.");
                    throw error;
                }
                
                const { data: publicUrlData } = supabase.storage
                    .from('uploads')
                    .getPublicUrl(fileName);
                    
                finalFileUrl = publicUrlData.publicUrl;
            }

            const messageObject = {
                messageId: Date.now() + '-' + Math.random().toString(36).substring(2, 9),
                userId: currentUser,
                text: text,
                emoji: '',
                fileUrl: finalFileUrl,
                createdAt: Date.now()
            };

            const { error } = await supabase.from('messages').insert([messageObject]);
            
            if (error) {
                console.error("Database Insert Error:", error);
                alert('Failed to send message. Please ensure Row Level Security (RLS) policies allow anonymous inserts.');
            } else {
                messageInput.value = '';
                messageInput.style.height = 'auto';
                clearUpload();
                messageInput.focus();
            }

        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            sendBtn.style.opacity = '1';
            sendBtn.disabled = false;
        }
    };

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);

    const emojis = ['🚀', '✨', '🪐', '👽', '☄️', '🌌', '👾', '💥'];
    emojiBtn.addEventListener('click', () => {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        messageInput.value += randomEmoji;
        messageInput.focus();
    });
});
