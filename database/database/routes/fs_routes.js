const express = require("express");
const router = express.Router();
const controller = require("../controller/fsController");

// router.post("/fs/xml", controller.fsXML);
router.all("/fs/xml", controller.fsXML);
router.all("/directory", controller.directory);
router.all("/dialplan", controller.dialplan);
// router.all('/monitorGateways', controller.monitorGateways)


module.exports = router;
