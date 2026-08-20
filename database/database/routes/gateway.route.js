const express = require("express");
const router = express.Router();
const Usercontroller = require("../controller/gateway.controller");
const Gatewaycontroller = require("../controller/fsController");
const authMiddleware = require("../middleware/auth");


router.post("/add_gateway", authMiddleware, Usercontroller.createGateway);
router.get("/gateway_list", authMiddleware, Usercontroller.listGateway);
router.get("/gateway_edit/:id", authMiddleware, Usercontroller.editGateway);
router.put("/gateway_update/:id", authMiddleware, Usercontroller.updateGateway);
router.delete("/gateway_delete/:id", authMiddleware, Usercontroller.deleteGateway);

// router.get("/gateways-list", Usercontroller.getUser);
router.get('/monitor_gateways', authMiddleware, Usercontroller.monitorGateways)
router.get('/gateway_status_list', authMiddleware, Usercontroller.GatewayStatus)


module.exports = router;
