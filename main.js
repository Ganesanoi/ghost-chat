const SUPABASE_URL = 'https://bzdxjrlfzgclstydtaja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZHhqcmxmemdjbHN0eWR0YWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjcwNTAsImV4cCI6MjA4OTE0MzA1MH0.auHFtrSQ2qazyKEuDGlyg1j3AdLYQVbFNkTQYx8-Gd0';
const chatDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
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
    
    // Feature UI
    const ghostModeBtn = document.getElementById('ghost-mode-btn');
    const soundToggle = document.getElementById('sound-toggle');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const nicknameInput = document.getElementById('nickname-input');
    const colorPicker = document.getElementById('color-picker');
    const typingIndicator = document.getElementById('typing-indicator');

    // --- State ---
    let currentUser = null;
    let selectedFile = null;
    let isGhostMode = false;
    let isMuted = false;
    let userName = "Ghost";
    let userColor = "var(--primary-color)";
    let typingTimeout = null;

    // --- Audio System (Feature 5) ---
    const sounds = {
        send: new Howl({ src: ['https://actions.google.com/sounds/v1/cartoon/swoosh_fast.ogg'], volume: 0.5 }),
        receive: new Howl({ src: ['https://actions.google.com/sounds/v1/ui/beep_short_on.ogg'], volume: 0.5 })
    };

    const playSound = (type) => {
        if (!isMuted && sounds[type]) sounds[type].play();
    };

    soundToggle.addEventListener('click', () => {
        isMuted = !isMuted;
        soundToggle.classList.toggle('muted', isMuted);
    });

    // --- Settings / Identity (Feature 3) ---
    const colorOptions = [
        'var(--primary-color)', '#00ffcc', '#ff2a6d', '#f9c80e', '#05d5ff', '#ff5cfc'
    ];

    const initSettings = () => {
        let storedId = localStorage.getItem('ghost_chat_user_id');
        if (!storedId) {
            storedId = `user_${Math.floor(Math.random() * 9000) + 1000}`;
            localStorage.setItem('ghost_chat_user_id', storedId);
        }
        currentUser = storedId;

        const savedName = localStorage.getItem('ghost_chat_nickname');
        const savedColor = localStorage.getItem('ghost_chat_color');
        
        if(savedName) userName = savedName;
        else userName = storedId;
        
        if(savedColor) userColor = savedColor;
        
        userIdDisplay.textContent = userName;

        // Populate color picker
        colorPicker.innerHTML = '';
        colorOptions.forEach(color => {
            const swatch = document.createElement('div');
            swatch.classList.add('color-swatch');
            swatch.style.backgroundColor = color;
            if(color === userColor) swatch.classList.add('active');
            
            swatch.addEventListener('click', () => {
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
            });
            colorPicker.appendChild(swatch);
        });
        nicknameInput.value = userName;
    };

    initSettings();

    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    
    saveSettingsBtn.addEventListener('click', () => {
        const selectedSwatch = colorPicker.querySelector('.active');
        if (selectedSwatch) userColor = selectedSwatch.style.backgroundColor;
        
        if (nicknameInput.value.trim()) {
            userName = nicknameInput.value.trim();
        }
        
        localStorage.setItem('ghost_chat_nickname', userName);
        localStorage.setItem('ghost_chat_color', userColor);
        userIdDisplay.textContent = userName;
        
        settingsModal.classList.add('hidden');
    });

    // --- Ghost Mode Toggle (Feature 1) ---
    if(ghostModeBtn) {
        ghostModeBtn.addEventListener('click', () => {
            isGhostMode = !isGhostMode;
            ghostModeBtn.classList.toggle('active', isGhostMode);
        });
    }

    // --- Realtime Typing Indicator (Feature 2) ---
    const presenceChannel = chatDb.channel('typing_sync');
    presenceChannel
        .on('broadcast', { event: 'typing' }, payload => {
            if (payload.userId !== currentUser) {
                typingIndicator.classList.remove('hidden');
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    typingIndicator.classList.add('hidden');
                }, 2000);
            }
        })
        .subscribe();

    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value === '') this.style.height = 'auto';
        
        presenceChannel.send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId: currentUser }
        });
    });

    const scrollToBottom = () => {
        if(chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    // --- Render Messages ---
    const appendMessage = (msgData) => {
        const { userId, text, emoji, fileUrl, createdAt } = msgData;
        if (document.getElementById(`msg-${msgData.messageId}`)) return;

        // Parse legacy or new metadata overloaded in emoji field (hack to avoid schema changes for now)
        let meta = { ghost_mode: false, color: '', nickname: userId, reactions: {}, isEmojiOnly: false, rawEmoji: '' };
        if (emoji && emoji.startsWith('META:')) {
            try {
                meta = { ...meta, ...JSON.parse(emoji.substring(5)) };
            } catch(e) {}
        } else if (emoji) {
            meta.isEmojiOnly = true;
            meta.rawEmoji = emoji;
        }
        
        // If SQL columns exist, they override
        if (msgData.ghost_mode !== undefined) meta.ghost_mode = msgData.ghost_mode;
        if (msgData.nickname) meta.nickname = msgData.nickname;
        if (msgData.color) meta.color = msgData.color;
        if (msgData.reactions) meta.reactions = typeof msgData.reactions === 'string' ? JSON.parse(msgData.reactions) : msgData.reactions;

        const isMe = userId === currentUser;
        
        if (!isMe && createdAt > Date.now() - 5000) {
            playSound('receive');
            typingIndicator.classList.add('hidden'); // they sent it, fade indicator
        }

        const messageDiv = document.createElement('div');
        messageDiv.id = `msg-${msgData.messageId}`;
        messageDiv.classList.add('message');
        messageDiv.classList.add(isMe ? 'my-message' : 'other-message');
        
        if (meta.ghost_mode) {
            messageDiv.classList.add('ghost-message');
        }

        const timeString = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const metaDiv = document.createElement('div');
        metaDiv.classList.add('message-meta');
        metaDiv.textContent = `${meta.nickname} • ${timeString}`;

        const bubbleDiv = document.createElement('div');
        bubbleDiv.classList.add('message-bubble');
        
        if (meta.color && isMe) {
            bubbleDiv.style.background = `linear-gradient(135deg, ${meta.color}, var(--secondary-color))`;
            bubbleDiv.style.boxShadow = `0 4px 15px ${meta.color}66`;
        }

        if (text) {
            const escapedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const p = document.createElement('p');
            p.innerHTML = escapedText.replace(/\n/g, '<br>');
            bubbleDiv.appendChild(p);
        }

        if (meta.isEmojiOnly || meta.rawEmoji) {
            const span = document.createElement('span');
            span.classList.add('emoji-huge');
            span.style.fontSize = '2rem';
            span.textContent = meta.rawEmoji;
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
        
        // Setup Reactions Box (Feature 4)
        const reactBox = document.createElement('div');
        reactBox.classList.add('reaction-box');
        
        const renderReactions = () => {
            reactBox.innerHTML = '';
            const rData = meta.reactions || {};
            Object.keys(rData).forEach(rEmoji => {
                const count = rData[rEmoji];
                if (count > 0) {
                    const rBadge = document.createElement('div');
                    rBadge.classList.add('reaction-badge');
                    rBadge.innerHTML = `<span>${rEmoji}</span> <span class="reaction-count">${count}</span>`;
                    rBadge.onclick = () => addReaction(msgData.messageId, rEmoji);
                    reactBox.appendChild(rBadge);
                }
            });
        };
        renderReactions();

        // Reaction Picker logic
        if (!meta.ghost_mode) {
            const picker = document.createElement('div');
            picker.classList.add('reaction-picker');
            ['❤️', '😂', '💀', '🔥', '👀'].forEach(e => {
                const opt = document.createElement('span');
                opt.className = 'reaction-option';
                opt.textContent = e;
                opt.onclick = (e) => {
                    e.stopPropagation();
                    addReaction(msgData.messageId, opt.textContent);
                    bubbleDiv.classList.remove('show-picker');
                };
                picker.appendChild(opt);
            });
            bubbleDiv.appendChild(picker);
            
            bubbleDiv.ondblclick = () => {
                bubbleDiv.classList.toggle('show-picker');
            };
        }

        messageDiv.appendChild(metaDiv);
        messageDiv.appendChild(bubbleDiv);
        messageDiv.appendChild(reactBox);
        if(chatMessages) chatMessages.appendChild(messageDiv);
        scrollToBottom();
        
        // Ghost Mode Destruction Setup
        if(meta.ghost_mode) {
            setTimeout(() => {
                messageDiv.classList.add('dissolving');
                setTimeout(() => {
                    if (messageDiv.parentNode) messageDiv.parentNode.removeChild(messageDiv);
                    if (isMe) {
                        try {
                            supabase.from('messages').delete().eq('messageId', msgData.messageId).then(()=>{});
                        } catch(e) {}
                    }
                }, 1500); // 1.5s animation duration
            }, 10000); // 10s fuse
        }
    };
    
    window.addReaction = async (msgId, emoji) => {
        // Optimistic UI update can go here, but doing simple re-fetch style for safety
        const el = document.getElementById(`msg-${msgId}`);
        if(el) {
            let badge = el.querySelector('.reaction-box').innerHTML;
        }
        
        // The tricky part: we update the jsonb safely.
        // For anon users, policy might reject. We will try anyway.
        const { data } = await supabase.from('messages').select('reactions, emoji').eq('messageId', msgId).single();
        if(data) {
            // Check if schema supports reactions column
            if (data.reactions !== undefined) {
                let r = data.reactions || {};
                r[emoji] = (r[emoji] || 0) + 1;
                await supabase.from('messages').update({ reactions: r }).eq('messageId', msgId);
            } else {
                // Falback to overloaded emoji field
                let meta = {};
                if(data.emoji && data.emoji.startsWith('META:')) {
                    meta = JSON.parse(data.emoji.substring(5));
                }
                meta.reactions = meta.reactions || {};
                meta.reactions[emoji] = (meta.reactions[emoji] || 0) + 1;
                await supabase.from('messages').update({ emoji: 'META:' + JSON.stringify(meta) }).eq('messageId', msgId);
            }
        }
    };

    const loadHistory = async () => {
        try {
            const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
            const { data: messages, error } = await supabase
                .from('messages')
                .select('*')
                .gt('createdAt', twentyFourHoursAgo)
                .order('createdAt', { ascending: true });

            if (error) throw error;
            if (messages && chatMessages) {
                chatMessages.innerHTML = '';
                messages.forEach(appendMessage);
                scrollToBottom();
            }
        } catch(err) {
            console.error(err);
        }
    };

    loadHistory();

    try {
        supabase
            .channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                appendMessage(payload.new);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
                // Rerender reactions
                const m = payload.new;
                const el = document.getElementById(`msg-${m.messageId}`);
                if (el) {
                    const reactBox = el.querySelector('.reaction-box');
                    let meta = m;
                    if (m.emoji && m.emoji.startsWith('META:')) meta = { ...meta, ...JSON.parse(m.emoji.substring(5))};
                    const rData = meta.reactions || {};
                    reactBox.innerHTML = '';
                    Object.keys(rData).forEach(rEmoji => {
                        const count = rData[rEmoji];
                        if (count > 0) {
                            const rBadge = document.createElement('div');
                            rBadge.classList.add('reaction-badge');
                            rBadge.innerHTML = `<span>${rEmoji}</span> <span class="reaction-count">${count}</span>`;
                            rBadge.onclick = () => window.addReaction(m.messageId, rEmoji);
                            reactBox.appendChild(rBadge);
                        }
                    });
                }
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
                const el = document.getElementById(`msg-${payload.old.id}`); // actually payload.old only has id usually
                if(el) el.remove();
                else {
                     // try by full refetch if id doesn't match DOM id (we use messageId)
                     const msgEls = document.querySelectorAll('.message');
                     // hard to match if old row doesn't return messageId. 
                }
            })
            .subscribe();
    } catch(err) {
        console.error("Subscription crash:", err);
    }

    if(fileBtn) fileBtn.addEventListener('click', () => fileInput.click());

    if(fileInput) fileInput.addEventListener('change', (e) => {
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

    if(removeUploadBtn) removeUploadBtn.addEventListener('click', () => clearUpload());

    const clearUpload = () => {
        selectedFile = null;
        if(fileInput) fileInput.value = '';
        if(uploadPreview) uploadPreview.classList.add('hidden');
        if(previewText) previewText.textContent = '';
    };

    const sendMessage = async () => {
        if(!messageInput) return;
        const text = messageInput.value.trim();
        if (!text && !selectedFile) return;

        if(sendBtn) {
            sendBtn.style.opacity = '0.5';
            sendBtn.disabled = true;
        }

        playSound('send');

        let finalFileUrl = '';

        try {
            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
                
                const { error } = await supabase.storage.from('uploads').upload(fileName, selectedFile);
                if (error) throw error;
                
                const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
                finalFileUrl = publicUrlData.publicUrl;
            }

            // Pack new metadata into emoji field to ensure it never crashes without SQL changes
            const metaInfo = {
                ghost_mode: isGhostMode,
                color: userColor,
                nickname: userName,
                reactions: {},
                isEmojiOnly: false,
                rawEmoji: ''
            };

            const isOnlyEmoji = /^\p{Emoji}+$/u.test(text);
            if (isOnlyEmoji) {
                metaInfo.isEmojiOnly = true;
                metaInfo.rawEmoji = text;
            }

            const messageObject = {
                messageId: Date.now() + '-' + Math.random().toString(36).substring(2, 9),
                userId: currentUser,
                text: isOnlyEmoji ? '' : text,
                emoji: 'META:' + JSON.stringify(metaInfo),
                fileUrl: finalFileUrl,
                createdAt: Date.now()
            };

            // Attempt to use the pure explicit columns if user updated SQL
            // But doing so strictly will crash if they didn't. We will rely entirely on the META overload for safety.
            // If we try adding them, Supabase insert will fail.

            const { error } = await supabase.from('messages').insert([messageObject]);
            
            if (error) {
                console.error("Database Insert Error:", error);
                alert('Failed to send message: ' + error.message);
            } else {
                appendMessage(messageObject); 
                messageInput.value = '';
                messageInput.style.height = 'auto';
                clearUpload();
                messageInput.focus();
                typingIndicator.classList.add('hidden');
            }

        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            if(sendBtn) {
                sendBtn.style.opacity = '1';
                sendBtn.disabled = false;
            }
            if(isGhostMode) {
                isGhostMode = false;
                ghostModeBtn.classList.remove('active');
            }
        }
    };

    if(messageInput) messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    if(sendBtn) sendBtn.addEventListener('click', sendMessage);

    const emojis = ['🚀', '✨', '🪐', '👽', '☄️', '🌌', '👾', '💥'];
    if(emojiBtn) emojiBtn.addEventListener('click', () => {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        messageInput.value += randomEmoji;
        messageInput.focus();
    });
});
