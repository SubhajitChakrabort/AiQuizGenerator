const express = require('express');
const dotenv = require('dotenv');
const quizRoutes = require('./routes/quiz.routes');
const authRoutes = require('./routes/auth.routes');
const db = require('./config/db');

dotenv.config();
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('views'));

// Routes - Make sure these match your frontend calls
app.use('/api/quiz', quizRoutes);  // This should handle /api/quiz/generate
app.use('/api/auth', authRoutes);

// Additional API routes for cash
// Additional API routes for cash won and results
app.get('/api/user/quiz-history', async (req, res) => {
    try {
        const userId = req.user?.userId || 1;
        
        const [results] = await db.query(`
            SELECT 
                qr.id,
                qr.score,
                qr.cash_won,
                qr.time_taken,
                qr.created_at
            FROM quiz_results qr 
            WHERE qr.user_id = ? 
            ORDER BY qr.created_at DESC 
            LIMIT 20
        `, [userId]);

        res.json({
            status: true,
            history: results,
            totalCashWon: results.reduce((sum, result) => sum + (result.cash_won || 0), 0),
            message: "Quiz history retrieved successfully"
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Failed to retrieve quiz history",
            error: error.message
        });
    }
});

app.get('/api/leaderboard/cash', async (req, res) => {
    try {
        const [leaderboard] = await db.query(`
            SELECT 
                u.username,
                qr.cash_won,
                qr.score,
                qr.time_taken,
                qr.created_at
            FROM quiz_results qr
            JOIN users u ON qr.user_id = u.id
            ORDER BY qr.cash_won DESC, qr.score DESC, qr.time_taken ASC
            LIMIT 50
        `);

        res.json({
            status: true,
            leaderboard: leaderboard,
            message: "Cash leaderboard retrieved successfully"
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Failed to retrieve cash leaderboard",
            error: error.message
        });
    }
});

app.get('/api/user/rank', async (req, res) => {
    try {
        const userId = req.user?.userId || 1;

        const [userStats] = await db.query(`
            SELECT 
                qr.cash_won,
                qr.score,
                (SELECT COUNT(*) FROM quiz_results WHERE cash_won > qr.cash_won) + 1 as cash_rank
            FROM quiz_results qr 
            WHERE qr.user_id = ? 
            ORDER BY qr.created_at DESC 
            LIMIT 1
        `, [userId]);

        res.json({
            status: true,
            userRank: userStats[0] || {},
            message: "User rank retrieved successfully"
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Failed to retrieve user rank",
            error: error.message
        });
    }
});
app.get('/api/stats/overview', (req, res) => {
    res.redirect('/api/quiz/stats-overview');
});

// Serve pages
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './views' });
});

app.get('/cashboard', (req, res) => {
    res.sendFile('cashboard.html', { root: './views' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
