const db = require('../config/db');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

function generateMCQOptions(content, correctAnswer) {
    const sentences = content
        .split(/[.!?]/)
        .filter(s => s.length > 20 && s !== correctAnswer)
        .map(s => s.trim());

    const wrongOptions = sentences
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(sentence => sentence.replace(/\r\n/g, ' ').trim());

    return [
        correctAnswer.replace(/\r\n/g, ' ').trim(),
        ...wrongOptions
    ].sort(() => Math.random() - 0.5);
}

function generateQuestionText(sentence, keyTerm) {
    const questionTypes = [
        `What is ${keyTerm}?`,
        `What does ${keyTerm} mean?`,
        `How is ${keyTerm} defined?`,
        `Which statement is correct about ${keyTerm}?`,
        `According to the text, ${keyTerm} refers to:`,
        `Which of the following describes ${keyTerm}?`,
        `What can be said about ${keyTerm}?`,
        `How would you describe ${keyTerm}?`,
        `Identify what ${keyTerm} is:`,
        `The concept of ${keyTerm} involves:`
    ];

    return questionTypes[Math.floor(Math.random() * questionTypes.length)];
}

async function generateQuestionsFromContent(content) {
    const keyPoints = content
        .replace(/\r\n/g, ' ')
        .split(/[.!?]/)
        .filter(sentence => sentence.length > 30 && (
            sentence.includes('is') ||
            sentence.includes('are') ||
            sentence.includes('means') ||
            sentence.includes('defined as') ||
            sentence.includes('refers to') ||
            sentence.includes('known as')
        ))
        .map(sentence => sentence.trim());

    return keyPoints.slice(0, 10).map((point, index) => {
        const words = point.split(' ').filter(word => word.length > 4);
        const keyTerm = words[Math.floor(Math.random() * words.length)];

        const options = generateMCQOptions(content, point);
        const questionText = generateQuestionText(point, keyTerm);

        return {
            id: index + 1,
            questionNumber: index + 1,
            prize: calculatePrize(index + 1),
            lifelines: {
                fiftyFifty: true,
                audiencePoll: true,
                phoneAFriend: true,
                expertAdvice: true
            },
            question: questionText,
            optionA: options[0],
            optionB: options[1],
            optionC: options[2],
            optionD: options[3],
            correctAnswer: options[0]
        };
    });
}

function calculatePrize(questionNumber) {
    const prizes = [
        2000, 5000, 8000, 10000, 15000,
        18000, 25000, 30000, 40000, 50000
    ];
    return prizes[questionNumber - 1];
}

// Calculate cumulative cash prize based on correct answers
function calculateCumulativePrize(userAnswers, questions) {
    let totalCash = 0;
    const prizes = [2000, 5000, 8000, 10000, 15000, 18000, 25000, 30000, 40000, 50000];
    
    console.log('=== CALCULATING CUMULATIVE PRIZE ===');
    console.log('User answers received:', userAnswers);
    console.log('Total questions:', questions.length);
    
    if (!Array.isArray(userAnswers) || userAnswers.length === 0) {
        console.log('No valid answers provided');
        return 0;
    }
    
    userAnswers.forEach((answer, index) => {
        console.log(`\n--- Processing Answer ${index + 1} ---`);
        console.log('Answer object:', answer);
        
        const question = questions.find(q => q.id === answer.questionId);
        if (question) {
            console.log(`Question ${question.questionNumber} found`);
            console.log('Question options:', question.options);
            console.log('Correct answer:', question.correctAnswer);
            
            // Find the correct answer option (A, B, C, or D)
            const correctOption = Object.keys(question.options).find(key => 
                question.options[key] === question.correctAnswer
            );
            
            console.log(`Selected option: ${answer.selectedOption}`);
            console.log(`Correct option: ${correctOption}`);
            
            // If user's selected option matches correct option, add prize money
            if (correctOption === answer.selectedOption) {
                const prizeAmount = prizes[question.questionNumber - 1];
                totalCash += prizeAmount;
                console.log(`✅ CORRECT! Added ₹${prizeAmount.toLocaleString()}`);
                console.log(`Running total: ₹${totalCash.toLocaleString()}`);
            } else {
                console.log(`❌ WRONG! No prize added`);
            }
        } else {
            console.log(`❌ Question with ID ${answer.questionId} not found`);
        }
    });
    
    console.log(`\n=== FINAL CALCULATION ===`);
    console.log(`Total cash won: ₹${totalCash.toLocaleString()}`);
    console.log('===============================\n');
    
    return totalCash;
}

function calculateScore(userAnswers, questions) {
    let score = 0;
    
    console.log('=== CALCULATING SCORE ===');
    
        if (!Array.isArray(userAnswers) || userAnswers.length === 0) {
        console.log('No valid answers provided for score calculation');
        return 0;
    }
    
    userAnswers.forEach((answer, index) => {
        console.log(`\n--- Scoring Answer ${index + 1} ---`);
        const question = questions.find(q => q.id === answer.questionId);
        if (question) {
            // Find the correct answer option (A, B, C, or D)
            const correctOption = Object.keys(question.options).find(key => 
                question.options[key] === question.correctAnswer
            );
            
            console.log(`Question ${question.questionNumber}: Selected ${answer.selectedOption}, Correct ${correctOption}`);
            
            // If user's selected option matches correct option, increment score
            if (correctOption === answer.selectedOption) {
                score += 1;
                console.log(`✅ Correct! Score: ${score}`);
            } else {
                console.log(`❌ Wrong! Score remains: ${score}`);
            }
        }
    });
    
    console.log(`Final score: ${score}/${questions.length}`);
    console.log('========================\n');
    
    return score;
}

// Check if cash_won column exists and add it if it doesn't
async function ensureCashWonColumn() {
    try {
        await db.query(`
            ALTER TABLE quiz_results 
            ADD COLUMN IF NOT EXISTS cash_won INT DEFAULT 0
        `);
        console.log('✅ Cash_won column ensured');
    } catch (error) {
        // Column might already exist, that's okay
        console.log('Cash_won column check:', error.message);
    }
}

const quizController = {
    uploadPDF: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    message: "No PDF file uploaded",
                    status: false
                });
            }

            const uploadsDir = path.join(__dirname, '../uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir);
            }

            const timestamp = Date.now();
            const filename = `pdf_${timestamp}.pdf`;
            const filePath = path.join(uploadsDir, filename);

            fs.writeFileSync(filePath, req.file.buffer);

            const pdfData = await pdfParse(req.file.buffer);
            const content = pdfData.text;

            const topics = content
                .split(/[.!?]/)
                .filter(s => s.length > 30)
                .slice(0, 5)
                .map(s => s.trim())
                .join(', ');

            await db.query('INSERT INTO pdfs (content, file_path, topics) VALUES (?, ?, ?)',
                [content, filePath, topics]);

            res.json({
                message: "PDF uploaded successfully",
                status: true,
                filename: filename,
                topics: topics
            });
        } catch (error) {
            res.status(500).json({
                message: error.message,
                status: false
            });
        }
    },

    generateQuiz: async (req, res) => {
        try {
            const [pdfs] = await db.query('SELECT content, topics FROM pdfs ORDER BY id DESC LIMIT 1');

            if (!pdfs.length) {
                return res.status(404).json({
                    message: "No PDF content found",
                    status: false
                });
            }

            const questions = await generateQuestionsFromContent(pdfs[0].content);

            const formattedQuestions = questions.map(q => ({
                id: q.id,
                questionNumber: q.questionNumber,
                prize: q.prize,
                lifelines: q.lifelines,
                question: q.question,
                options: {
                    A: q.optionA,
                    B: q.optionB,
                    C: q.optionC,
                    D: q.optionD
                },
                correctAnswer: q.correctAnswer
            }));

            const quiz = {
                status: true,
                questions: formattedQuestions,
                topics: pdfs[0].topics,
                totalTime: 600,
                totalPrize: "₹2,53,000",
                prizeStructure: [2000, 5000, 8000, 10000, 15000, 18000, 25000, 30000, 40000, 50000]
            };

            await db.query(
                'INSERT INTO quiz_sessions (user_id, questions, start_time, total_time) VALUES (?, ?, ?, ?)',
                [req.user.userId, JSON.stringify(formattedQuestions), new Date().getTime(), quiz.totalTime]
            );

            console.log('✅ Quiz generated successfully with', formattedQuestions.length, 'questions');
            res.json(quiz);
        } catch (error) {
            console.error('Generate Quiz Error:', error);
            res.status(500).json({
                status: false,
                message: "Failed to generate quiz",
                error: error.message
            });
        }
    },

    submitQuiz: async (req, res) => {
        try {
            console.log('\n🎯 === QUIZ SUBMISSION STARTED ===');
            
            // Ensure cash_won column exists
            await ensureCashWonColumn();

            const { answers, timeRemaining, currentCash } = req.body;
            const userId = req.user.userId;

            console.log('📥 Received submit data:');
            console.log('- Answers:', answers);
            console.log('- Time remaining:', timeRemaining);
            console.log('- Frontend current cash:', currentCash);
            console.log('- User ID:', userId);

            const validAnswers = Array.isArray(answers) ? answers : [];
            console.log('✅ Valid answers count:', validAnswers.length);

            // Get the quiz session
            const [sessions] = await db.query(
                'SELECT questions FROM quiz_sessions WHERE user_id = ? ORDER BY start_time DESC LIMIT 1',
                [userId]
            );

            if (!sessions.length) {
                console.log('❌ No quiz session found');
                return res.status(404).json({
                    message: "Quiz session not found",
                    status: false,
                    cashWon: 0,
                    correctAnswers: 0,
                    totalQuestions: 0,
                    timeTaken: 0
                });
            }

            let questions = typeof sessions[0].questions === 'string'
                ? JSON.parse(sessions[0].questions)
                : sessions[0].questions;

            console.log('📚 Questions loaded:', questions.length);

            // Calculate results
            const correctAnswers = calculateScore(validAnswers, questions);
            const totalCashWon = calculateCumulativePrize(validAnswers, questions);
            const timeTaken = 600 - (timeRemaining || 0);

            console.log('\n📊 CALCULATION RESULTS:');
            console.log('- Correct answers:', correctAnswers);
            console.log('- Total questions:', questions.length);
            console.log('- Time taken:', timeTaken, 'seconds');
            console.log('- Cash won (calculated):', totalCashWon);
            console.log('- Cash won (frontend):', currentCash);

            // Save to database
            try {
                const insertResult = await db.query(
                    'INSERT INTO quiz_results (user_id, answers, time_taken, score, cash_won) VALUES (?, ?, ?, ?, ?)',
                    [userId, JSON.stringify(validAnswers), timeTaken, correctAnswers, totalCashWon]
                );
                console.log('✅ Results saved to database with ID:', insertResult[0].insertId);
            } catch (dbError) {
                console.log('⚠️ Database insert error:', dbError.message);
                if (dbError.code === 'ER_BAD_FIELD_ERROR') {
                    // Fallback: Insert without cash_won column
                    await db.query(
                        'INSERT INTO quiz_results (user_id, answers, time_taken, score) VALUES (?, ?, ?, ?)',
                        [userId, JSON.stringify(validAnswers), timeTaken, correctAnswers]
                    );
                    console.log('✅ Results saved without cash_won column');
                } else {
                    throw dbError;
                }
            }

            // Prepare comprehensive response
            const result = {
                message: "Quiz submitted successfully",
                status: true,
                correctAnswers: correctAnswers,
                totalQuestions: questions.length,
                timeTaken: timeTaken,
                cashWon: totalCashWon, // This is the key field
                accuracy: Math.round((correctAnswers / questions.length) * 100),
                userAnswers: validAnswers.length,
                // Additional debugging data
                debug: {
                    receivedCash: currentCash,
                    calculatedCash: totalCashWon,
                    answersReceived: validAnswers.length,
                    questionsTotal: questions.length,
                    prizeStructure: [2000, 5000, 8000, 10000, 15000, 18000, 25000, 30000, 40000, 50000]
                }
            };

            console.log('\n📤 SENDING RESPONSE:');
            console.log('- Status:', result.status);
            console.log('- Cash Won:', result.cashWon);
            console.log('- Correct Answers:', result.correctAnswers);
            console.log('- Total Questions:', result.totalQuestions);
            console.log('=== QUIZ SUBMISSION COMPLETED ===\n');

            res.json(result);

        } catch (error) {
            console.error('❌ Submit Quiz Error:', error);
            res.status(500).json({
                message: "Failed to submit quiz",
                error: error.message,
                status: false,
                cashWon: 0,
                correctAnswers: 0,
                totalQuestions: 0,
                timeTaken: 0
            });
        }
    },

    // Get quiz results
    getQuizResults: async (req, res) => {
        try {
            const userId = req.user.userId;
            
            const [results] = await db.query(
                'SELECT * FROM quiz_results WHERE user_id = ? ORDER BY id DESC LIMIT 10',
                [userId]
            );

            res.json({
                status: true,
                results: results,
                message: "Quiz results retrieved successfully"
            });
        } catch (error) {
            console.error('Get Quiz Results Error:', error);
            res.status(500).json({
                status: false,
                message: "Failed to retrieve quiz results",
                error: error.message
            });
        }
    },

    // Get leaderboard
    getLeaderboard: async (req, res) => {
        try {
            const [leaderboard] = await db.query(`
                SELECT 
                    u.username,
                    qr.score,
                    qr.cash_won,
                    qr.time_taken,
                    qr.created_at
                FROM quiz_results qr
                JOIN users u ON qr.user_id = u.id
                ORDER BY qr.cash_won DESC, qr.score DESC, qr.time_taken ASC
                LIMIT 20
            `);

            res.json({
                status: true,
                leaderboard: leaderboard,
                message: "Leaderboard retrieved successfully"
            });
        } catch (error) {
            console.error('Get Leaderboard Error:', error);
            res.status(500).json({
                status: false,
                message: "Failed to retrieve leaderboard",
                error: error.message
            });
        }
    },

    // Get latest quiz result for current user
    getLatestResult: async (req, res) => {
        try {
            const userId = req.user.userId;
            
            const [results] = await db.query(`
                SELECT 
                    qr.*,
                    (SELECT COUNT(*) FROM quiz_results WHERE user_id = ? AND score > qr.score) + 1 as rank
                FROM quiz_results qr 
                WHERE qr.user_id = ? 
                ORDER BY qr.id DESC 
                LIMIT 1
            `, [userId, userId]);

            if (!results.length) {
                return res.status(404).json({
                    status: false,
                    message: "No quiz results found"
                });
            }

            const result = results[0];
            
            // Calculate additional data
            const correctAnswers = result.score || 0;
            const totalQuestions = 10;
            const cashWon = result.cash_won || 0;
            const accuracy = Math.round((correctAnswers / totalQuestions) * 100);

            res.json({
                status: true,
                result: {
                    ...result,
                    correctAnswers,
                    totalQuestions,
                    cashWon,
                    accuracy
                },
                message: "Latest result retrieved successfully"
            });
        } catch (error) {
            console.error('Get Latest Result Error:', error);
            res.status(500).json({
                status: false,
                message: "Failed to retrieve latest result",
                error: error.message
            });
        }
    },
    
    // Get overall statistics
    getStatsOverview: async (req, res) => {
        try {
            // Get overall stats
            const [overallStats] = await db.query(`
                SELECT 
                    COUNT(*) as total_quizzes,
                    COUNT(DISTINCT user_id) as total_users,
                    SUM(cash_won) as total_cash_distributed,
                    AVG(score) as average_score,
                    MAX(cash_won) as highest_cash_won,
                    MAX(score) as highest_score,
                    AVG(time_taken) as average_time_taken
                FROM quiz_results
            `);

            // Get recent activity
            const [recentActivity] = await db.query(`
                SELECT 
                    u.username,
                    qr.cash_won,
                    qr.score,
                    qr.created_at
                FROM quiz_results qr
                JOIN users u ON qr.user_id = u.id
                ORDER BY qr.created_at DESC
                LIMIT 10
            `);

            // Get top performers
            const [topPerformers] = await db.query(`
                SELECT 
                    u.username,
                    qr.cash_won,
                    qr.score,
                    qr.created_at
                FROM quiz_results qr
                JOIN users u ON qr.user_id = u.id
                ORDER BY qr.cash_won DESC, qr.score DESC
                LIMIT 5
            `);

            res.json({
                status: true,
                stats: overallStats[0] || {},
                recentActivity: recentActivity || [],
                topPerformers: topPerformers || [],
                message: "Statistics overview retrieved successfully"
            });
        } catch (error) {
            console.error('Get Stats Overview Error:', error);
            res.status(500).json({
                status: false,
                message: "Failed to retrieve statistics overview",
                error: error.message
            });
        }
    }
};


module.exports = quizController;

