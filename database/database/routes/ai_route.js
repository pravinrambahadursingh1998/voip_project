const express = require("express");
const router = express.Router();
const ai = require("../controller/ai_controller");
const authMiddleware = require("../middleware/auth");

router.post("/voice", express.raw({ type: '*/*', limit: '10mb' }), ai.aiAgent)
router.get("/greet", ai.greet);
router.post('/models', authMiddleware, ai.fetchModels);
router.post('/ai_settings', authMiddleware, ai.addAiSeeting);
router.get('/ai_settings/list', authMiddleware, ai.getAiSettingList);
router.get('/ai_settings/:id', authMiddleware, ai.getAiSettingById);
router.put('/ai_settings/update/:id', authMiddleware, ai.updateAiSetting);
router.delete('/ai_settings/delete/:id', authMiddleware, ai.deleteAiSetting);
router.post('/ai-function/create', authMiddleware, ai.createAiFunction);
router.get('/ai-function/list', authMiddleware, ai.getAiFunctions);
router.get('/ai-function/get/:id', authMiddleware, ai.getAiFunction);
router.post('/ai-function/test', authMiddleware, ai.testAiFunction);
router.post('/ai-prompt/create', authMiddleware, ai.createAiPrompt);
router.get('/ai-prompt/list', authMiddleware, ai.getAiPrompts);
router.get('/ai-prompt/get/:id', authMiddleware, ai.getAiPrompt);
router.delete('/ai-prompt/delete/:id', authMiddleware, ai.deleteAiPrompt);
router.get('/extensions/list', authMiddleware, ai.getExtensionList);

router.post('/ai-integration/create', authMiddleware, ai.createAiIntegration);
router.get('/ai-integration/list', authMiddleware, ai.getAiIntegrations);
router.get('/ai-integration/get/:id', authMiddleware, ai.getAiIntegration);
router.put('/ai-integration/update/:id', authMiddleware, ai.updateAiIntegration);
router.delete('/ai-integration/delete/:id', authMiddleware, ai.deleteAiIntegration);
router.get('/ai-integration/gateway-extensions', authMiddleware, ai.getGatewayExtensions);

module.exports = router;
