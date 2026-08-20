const express = require("express");
const router = express.Router();
const loginController = require("../controller/loginController");
const authMiddleware = require("../middleware/auth");

router.post('/login', loginController.login)
// router.get('get_ai_proiveder',)


module.exports = router;
