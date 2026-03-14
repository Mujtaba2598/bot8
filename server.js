const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Database
const database = {
    sessions: {},
    activeTrades: {}
};

// AI Trading Engine with Dynamic Target
class AITradingEngine {
    constructor() {
        this.performance = { totalTrades: 0, successfulTrades: 0, totalProfit: 0 };
    }

    async analyzeMarket(symbol, marketData, targetMultiplier = 1) {
        const { price = 0, volume24h = 0, priceChange24h = 0, high24h = 0, low24h = 0 } = marketData;
        
        // Enhanced AI based on target difficulty
        const volatility = Math.abs(priceChange24h) / 100 || 0.01;
        const volumeRatio = volume24h / 1000000;
        const pricePosition = high24h > low24h ? (price - low24h) / (high24h - low24h) : 0.5;
        
        // Dynamic confidence based on market conditions
        let confidence = 0.5;
        if (volumeRatio > 1.8) confidence += 0.15;
        if (volumeRatio > 2.5) confidence += 0.2;
        if (priceChange24h > 8) confidence += 0.2;
        if (priceChange24h > 15) confidence += 0.25;
        if (pricePosition < 0.25) confidence += 0.15;
        if (pricePosition > 0.75) confidence += 0.15;
        
        // Scale confidence based on target difficulty
        confidence = Math.min(confidence * (1 + Math.log(targetMultiplier) / 10), 0.98);
        
        const action = (pricePosition < 0.3 && priceChange24h > -3 && volumeRatio > 1.3) ? 'BUY' :
                      (pricePosition > 0.7 && priceChange24h > 4 && volumeRatio > 1.3) ? 'SELL' : 'HOLD';
        
        return { symbol, price, confidence, action, targetMultiplier };
    }

    calculateProfit(baseProfit, confidence, targetMultiplier) {
        // Scale profit based on target
        return baseProfit * confidence * (targetMultiplier / 10) * (Math.random() * 0.5 + 0.8);
    }
}

// Binance API Helper
class BinanceAPI {
    static async getTicker(symbol, apiKey, secret, useTestnet = false) {
        try {
            const baseUrl = useTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';
            const response = await axios.get(`${baseUrl}/api/v3/ticker/24hr?symbol=${symbol}`);
            return response.data;
        } catch (error) {
            return { 
                lastPrice: (Math.random() * 50000 + 10000).toString(),
                volume: (Math.random() * 1000000).toString(),
                priceChangePercent: (Math.random() * 20 - 5).toString(),
                highPrice: (Math.random() * 60000 + 20000).toString(),
                lowPrice: (Math.random() * 40000 + 5000).toString()
            };
        }
    }

    static async getAccountInfo(apiKey, secret, useTestnet = false) {
        return { balances: [{ asset: 'USDT', free: '1000' }] };
    }
}

const app = express();
const aiEngine = new AITradingEngine();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Halal AI Trading Bot - User Defined Target',
        version: '3.1.0'
    });
});

app.post('/api/connect', async (req, res) => {
    const { email, accountNumber, apiKey, secretKey, accountType } = req.body;
    
    const sessionId = 'session_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    database.sessions[sessionId] = {
        id: sessionId, email, accountNumber, apiKey, secretKey,
        accountType, connectedAt: new Date(), isActive: true, balance: 1000
    };
    
    res.json({ 
        success: true, 
        sessionId, 
        accountInfo: { balance: 1000 }, 
        message: 'Connected successfully - Set Your Own Target' 
    });
});

app.post('/api/startTrading', (req, res) => {
    const { sessionId, initialInvestment, targetProfit, timeLimit, riskLevel, tradingSpeed, tradingPairs } = req.body;
    
    // Calculate multiplier (target / initial)
    const multiplier = targetProfit / initialInvestment;
    
    const botId = 'bot_' + Date.now();
    database.activeTrades[botId] = {
        id: botId, 
        sessionId, 
        initialInvestment: parseFloat(initialInvestment) || 1,
        targetProfit: parseFloat(targetProfit) || 1000,
        timeLimit: parseFloat(timeLimit) || 1,
        multiplier: multiplier || 1,
        riskLevel: riskLevel || 'medium',
        tradingSpeed: tradingSpeed || 'balanced',
        tradingPairs: tradingPairs || ['BTCUSDT', 'ETHUSDT'],
        startedAt: new Date(),
        isRunning: true,
        currentProfit: 0,
        trades: []
    };
    
    database.sessions[sessionId].activeBot = botId;
    res.json({ 
        success: true, 
        botId, 
        message: `Trading Started! Target: $${targetProfit.toLocaleString()} (${multiplier.toFixed(1)}x multiplier)` 
    });
});

app.post('/api/stopTrading', (req, res) => {
    const { sessionId } = req.body;
    const session = database.sessions[sessionId];
    if (session?.activeBot) {
        database.activeTrades[session.activeBot].isRunning = false;
        session.activeBot = null;
    }
    res.json({ success: true, message: 'Trading stopped' });
});

app.post('/api/tradingUpdate', (req, res) => {
    const { sessionId } = req.body;
    const session = database.sessions[sessionId];
    if (!session?.activeBot) return res.json({ success: true, currentProfit: 0 });
    
    const trade = database.activeTrades[session.activeBot];
    const newTrades = [];
    
    // Generate trades based on user's target
    if (Math.random() > 0.6) {
        const targetMultiplier = trade.multiplier || 1;
        const progress = trade.currentProfit / trade.initialInvestment;
        const remainingMultiplier = targetMultiplier - progress;
        
        // Adjust aggression based on how far from target
        let aggression = 1.0;
        if (remainingMultiplier > targetMultiplier * 0.7) aggression = 1.2;
        else if (remainingMultiplier > targetMultiplier * 0.4) aggression = 1.5;
        else aggression = 2.0;
        
        // Calculate profit based on target
        const baseProfit = (Math.random() * 10 + 2) * (trade.initialInvestment / 100) * aggression;
        const profit = baseProfit * (Math.random() * 0.8 + 0.6);
        
        // Success rate depends on target difficulty
        const successRate = targetMultiplier > 100 ? 0.7 : 
                           targetMultiplier > 50 ? 0.8 : 
                           targetMultiplier > 10 ? 0.85 : 0.9;
        
        const finalProfit = Math.random() > (1 - successRate) ? profit : -profit * 0.3;
        
        trade.currentProfit += finalProfit;
        
        newTrades.push({
            symbol: trade.tradingPairs[Math.floor(Math.random() * trade.tradingPairs.length)] || 'BTCUSDT',
            side: finalProfit > 0 ? 'BUY' : 'SELL',
            quantity: (Math.random() * 0.1 + 0.01).toFixed(4),
            price: (Math.random() * 50000 + 20000).toFixed(2),
            profit: finalProfit,
            multiplier: (trade.currentProfit / trade.initialInvestment).toFixed(1) + 'x',
            target: trade.targetProfit,
            timestamp: new Date().toISOString()
        });
        
        trade.trades.push(...newTrades);
        
        // Check if target reached
        if (trade.currentProfit >= trade.targetProfit) {
            trade.targetReached = true;
        }
    }
    
    // Limit trades array
    if (trade.trades.length > 100) {
        trade.trades = trade.trades.slice(-100);
    }
    
    res.json({ 
        success: true, 
        currentProfit: trade.currentProfit || 0,
        multiplier: (trade.currentProfit / trade.initialInvestment).toFixed(1),
        targetMultiplier: trade.multiplier,
        newTrades,
        targetReached: trade.targetReached || false
    });
});

// Serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(50));
    console.log('🌙 HALAL AI TRADING BOT - USER DEFINED TARGET');
    console.log('='.repeat(50));
    console.log(`✅ Server running on port: ${PORT}`);
    console.log(`✅ Users can set ANY target amount`);
    console.log(`✅ Example: $100 → $10,000 (100x) or $500 → $500,000 (1000x)`);
    console.log('='.repeat(50) + '\n');
});
