// Roblox GamePass Proxy API
// Deploy this to Heroku, Vercel, Railway, or any Node.js hosting

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (or specify your Roblox game domain)
app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Roblox GamePass Proxy',
        endpoints: {
            '/api/gamepasses/:gameId': 'Get all gamepasses for a game',
            '/api/gamepass/:passId': 'Get details for specific gamepass',
            '/health': 'Health check'
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Get all gamepasses for a game
app.get('/api/gamepasses/:gameId', async (req, res) => {
    const { gameId } = req.params;
    
    console.log(`[API] Fetching gamepasses for game: ${gameId}`);
    
    try {
        // Fetch from Roblox Games API
        const response = await axios.get(
            `https://games.roblox.com/v1/games/${gameId}/game-passes`,
            {
                params: {
                    limit: 100,
                    sortOrder: 'Asc'
                },
                headers: {
                    'User-Agent': 'Roblox/WinInet',
                    'Accept': 'application/json'
                },
                timeout: 10000
            }
        );
        
        if (!response.data || !response.data.data) {
            console.log(`[API] No gamepasses found for game ${gameId}`);
            return res.json({
                success: true,
                gameId: gameId,
                count: 0,
                gamepasses: []
            });
        }
        
        const gamepasses = response.data.data;
        console.log(`[API] Found ${gamepasses.length} gamepasses`);
        
        // Fetch detailed info for each gamepass (including price)
        const detailedPasses = await Promise.all(
            gamepasses.map(async (pass) => {
                try {
                    const detailResponse = await axios.get(
                        `https://apis.roblox.com/marketplace-sales/v1/item/${pass.id}`,
                        { timeout: 5000 }
                    );
                    
                    // Also get economy info for price
                    const economyResponse = await axios.get(
                        `https://economy.roblox.com/v2/assets/${pass.id}/details`,
                        { timeout: 5000 }
                    );
                    
                    return {
                        id: pass.id,
                        name: pass.name,
                        displayName: pass.displayName || pass.name,
                        description: pass.description || '',
                        price: economyResponse.data?.PriceInRobux || 0,
                        isForSale: economyResponse.data?.IsForSale || false,
                        iconImageAssetId: pass.iconImageAssetId || 0
                    };
                } catch (error) {
                    console.log(`[API] Failed to get details for pass ${pass.id}:`, error.message);
                    return {
                        id: pass.id,
                        name: pass.name,
                        displayName: pass.displayName || pass.name,
                        description: pass.description || '',
                        price: 0,
                        isForSale: false,
                        iconImageAssetId: pass.iconImageAssetId || 0
                    };
                }
            })
        );
        
        // Filter only passes that are for sale
        const forSalePasses = detailedPasses.filter(pass => pass.isForSale);
        
        console.log(`[API] Returning ${forSalePasses.length} gamepasses for sale`);
        
        res.json({
            success: true,
            gameId: gameId,
            count: forSalePasses.length,
            gamepasses: forSalePasses
        });
        
    } catch (error) {
        console.error(`[API] Error fetching gamepasses:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            gameId: gameId
        });
    }
});

// Get specific gamepass details
app.get('/api/gamepass/:passId', async (req, res) => {
    const { passId } = req.params;
    
    console.log(`[API] Fetching details for gamepass: ${passId}`);
    
    try {
        const response = await axios.get(
            `https://economy.roblox.com/v2/assets/${passId}/details`,
            { timeout: 5000 }
        );
        
        res.json({
            success: true,
            gamepass: {
                id: response.data.AssetId,
                name: response.data.Name,
                description: response.data.Description,
                price: response.data.PriceInRobux,
                isForSale: response.data.IsForSale
            }
        });
        
    } catch (error) {
        console.error(`[API] Error fetching gamepass ${passId}:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`[SERVER] Roblox GamePass Proxy running on port ${PORT}`);
    console.log(`[SERVER] Access at: http://localhost:${PORT}`);
});

// Export for serverless platforms (Vercel, etc)
module.exports = app;
