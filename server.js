require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Supabase Connection
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error("Missing Supabase environment variables!");
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Setup Multer for media uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Generate a unique filename using timestamp and random string
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Accept images and gifs for MVP
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed for now.'));
        }
    }
});

// Messages expire strictly after 24 hours
const MS_IN_24_HOURS = 24 * 60 * 60 * 1000;

// Helper to clean up expired messages and their associated files
const cleanupExpiredMessages = async () => {
    try {
        const twentyFourHoursAgo = Date.now() - MS_IN_24_HOURS;
        
        // Find expired messages to delete associated local files
        const { data: expiredMessages, error: fetchError } = await supabase
            .from('messages')
            .select('*')
            .lt('createdAt', twentyFourHoursAgo);

        if (fetchError) {
            console.error('Error fetching expired messages from Supabase:', fetchError);
            return;
        }

        if (expiredMessages && expiredMessages.length > 0) {
            expiredMessages.forEach(msg => {
                if (msg.fileUrl) {
                    const filename = msg.fileUrl.split('/').pop();
                    const filePath = path.join(UPLOADS_DIR, filename);
                    if (fs.existsSync(filePath)) {
                        try {
                            fs.unlinkSync(filePath);
                            console.log(`Deleted expired file: ${filename}`);
                        } catch (err) {
                            console.error(`Failed to delete file: ${filename}`, err);
                        }
                    }
                }
            });

            // Delete from Supabase
            const { error: deleteError } = await supabase
                .from('messages')
                .delete()
                .lt('createdAt', twentyFourHoursAgo);
            
            if (deleteError) {
                console.error("Error deleting old messages from Supabase:", deleteError);
            } else {
                console.log(`Cleaned up ${expiredMessages.length} expired messages from database.`);
            }
        }
    } catch (err) {
        console.error("Cleanup error:", err);
    }
};

// Run cleanup every hour
setInterval(cleanupExpiredMessages, 60 * 60 * 1000);

// Media upload endpoint
app.post('/upload', upload.single('media'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded or invalid file type.' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ fileUrl });
});

io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send history of current unexpired messages to new user
    try {
        const twentyFourHoursAgo = Date.now() - MS_IN_24_HOURS;
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .gt('createdAt', twentyFourHoursAgo)
            .order('createdAt', { ascending: true });

        if (error) {
            console.error("Error fetching message history:", error);
            socket.emit('message_history', []);
        } else {
            socket.emit('message_history', messages || []);
        }
    } catch (err) {
        console.error("Error on connection history fetch:", err);
    }

    // Handle new incoming chat message
    socket.on('chat_message', async (data) => {
        const { userId, text, emoji, fileUrl } = data;
        
        const messageObject = {
            messageId: Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            userId: userId || `user_${Math.floor(Math.random() * 9000) + 1000}`,
            text: text || '',
            emoji: emoji || '',
            fileUrl: fileUrl || '',
            createdAt: Date.now()
        };

        // Store message in Supabase
        const { error } = await supabase.from('messages').insert([messageObject]);
        if (error) {
            console.error("Error saving message to Supabase:", error);
        }

        // Broadcast to everyone including sender
        io.emit('chat_message', messageObject);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`Ghost Chat server running on port ${PORT}`);
});
