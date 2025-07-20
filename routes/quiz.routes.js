const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('../middleware/authMiddleware');
const quizController = require('../controllers/quiz.controller');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Quiz routes
router.post('/upload', verifyToken, upload.single('pdf'), quizController.uploadPDF);
router.get('/generate', verifyToken, quizController.generateQuiz);
router.post('/submit', verifyToken, quizController.submitQuiz);

// Additional routes for results and leaderboard
router.get('/results', verifyToken, quizController.getQuizResults);
router.get('/leaderboard', verifyToken, quizController.getLeaderboard);
router.get('/latest-result', verifyToken, quizController.getLatestResult);
router.get('/stats-overview', verifyToken, quizController.getStatsOverview);
module.exports = router;
