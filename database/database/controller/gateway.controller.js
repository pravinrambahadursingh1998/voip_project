const Gateway = require("../models/gate_way");
const fsConn = require("../config/esl");
const gatewayService = require("../services/gateway.service");

//Insert Gateway Api
const createGateway = async (req, res) => {
  try {
    console.log('createGateway', req.body);
    // return false
    const created_at = new Date()
    const proxy = req.body.proxy
      ? `${req.body.from_domain}:${req.body.proxy}`
      : req.body.from_domain;

    await Gateway.forge({
      gateway_name: !!req.body.gateway_name ? req.body.gateway_name : null,
      username: !!req.body.user_name ? req.body.user_name : null,
      password: !!req.body.gateway_password ? req.body.gateway_password : null,
      extension: !!req.body.extension ? req.body.extension : null,
      realm: !!req.body.from_domain ? req.body.from_domain : null,
      proxy: proxy,
      register: !!req.body.register ? req.body.register : false,
      from_user: !!req.body.from_user ? req.body.from_user : null,
      from_domain: !!req.body.from_domain ? req.body.from_domain : null,
      enabled: !!req.body.enabled ? req.body.enabled : false,
      description: !!req.body.description ? req.body.description : null,
      register_transport: !!req.body.register_transport ? req.body.register_transport : null,
      created_by: !!req.body.user_id ? req.body.user_id : null,
      created_at: created_at,
      company_id: !!req.body.company_id ? req.body.company_id : null
    }).save();

    // Pick up new gateway from DB via xml_curl + register with FreeSWITCH
    await gatewayService.refreshFreeSWITCH();

    return res.json({ success: true, message: 'Data Created Succesfully' });
  } catch (error) {
    console.log('error', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong'
    });
  }

};

//Gateway List
const listGateway = async (req, res) => {
  try {
    console.log('listGateway');

    const gateways = await Gateway.fetchAll();

    return res.json({
      success: true,
      data: gateways
    });

  } catch (error) {
    console.log('error', error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
//Monitor Gateways
const monitorGateways = async (req, res) => {
  try {
    // console.log("Gateway monitoring...");

    const rows = await Gateway.fetchAll();
    const gateways = rows.toJSON();
    const results = [];

    const conn = fsConn(); // always fresh ESL instance

    if (!conn) {
      return res.json([{ error: "ESL not connected" }]);
    }

    for (let gw of gateways) {
      console.log('gw');

      const name = !!gw.gateway_name ? gw.gateway_name : null;
      if (!name) {
        results.push({ name, status: "Not Loaded" });
        continue;
      }

      const raw = await new Promise(resolve => {
        conn.api(`sofia status gateway ${name}`, r => {
          resolve(r.getBody());
        });
      });
      // console.log('raw', raw);

      let status = "Not Connected";

      if (/REGED/i.test(raw)) status = "Connected";
      else if (/FAILED/i.test(raw)) status = "Failed";
      else if (/UNREGED/i.test(raw)) status = "Unregistered";
      else if (/Invalid Gateway/i.test(raw)) status = "Not Loaded";
      results.push({ name, status, raw });
    }

    return res.json(results);

  } catch (err) {
    console.error("Monitor error:", err);
    return res.status(500).json({ error: "Monitoring failed" });
  }
};

// Gateway Status
const GatewayStatus = async (req, res) => {
  try {

    const rows = await Gateway.fetchAll();
    const gateways = rows.toJSON();

    const conn = fsConn();

    if (!conn) {
      return res.status(500).json({
        success: false,
        message: "ESL not connected"
      });
    }

    const result = [];

    for (const gateway of gateways) {

      const gatewayName = gateway.gateway_name;
      let status = "Not Loaded";
      let raw = "";

      if (gatewayName) {

        raw = await new Promise((resolve) => {
          conn.api(`sofia status gateway ${gatewayName}`, (response) => {
            resolve(response.getBody());
          });
        });

        if (/REGED/i.test(raw)) {
          status = "Connected";
        } else if (/FAILED/i.test(raw)) {
          status = "Failed";
        } else if (/UNREGED/i.test(raw)) {
          status = "Unregistered";
        } else if (/Invalid Gateway/i.test(raw)) {
          status = "Not Loaded";
        } else {
          status = "Not Connected";
        }
      }

      result.push({
        ...gateway,
        gateway_status: status,
        gateway_response: raw
      });
    }

    return res.json({
      success: true,
      data: result
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Single data
const editGateway = async (req, res) => {
  try {

    const gateway = await Gateway.where({ id: req.params.id }).fetch();

    if (!gateway) {
      return res.json({
        success: false,
        message: "Gateway not found"
      });
    }

    return res.json({
      success: true,
      data: gateway
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

//update Record
const updateGateway = async (req, res) => {
  try {
    const updated_at = new Date();

    const gateway = await Gateway.where({ id: req.body.id }).fetch();

    if (!gateway) {
      return res.json({
        success: false,
        message: "Gateway not found"
      });
    }

    await gateway.save({
      gateway_name: !!req.body.gateway_name ? req.body.gateway_name : gateway.gateway_name,
      username: !!req.body.user_name ? req.body.user_name : gateway.username,
      password: !!req.body.gateway_password ? req.body.gateway_password : gateway.password,
      extension: !!req.body.extension ? req.body.extension : gateway.extension,
      realm: !!req.body.realm ? req.body.realm : gateway.realm,
      proxy: !!req.body.proxy ? req.body.proxy : gateway.proxy,
      register: !!req.body.register ? req.body.register : gateway.register,
      from_user: !!req.body.from_user ? req.body.from_user : gateway.from_user,
      from_domain: !!req.body.from_domain ? req.body.from_domain : gateway.from_domain,
      enabled: !!req.body.enabled ? req.body.enabled : gateway.enabled,
      description: !!req.body.description ? req.body.description : gateway.description,
      register_transport: !!req.body.register_transport ? req.body.register_transport : gateway.register_transport,
      company_id: !!req.body.company_id ? req.body.company_id : gateway.company_id,
      updated_at: updated_at
    });

    await gatewayService.refreshFreeSWITCH();

    return res.json({
      success: true,
      message: "Gateway Updated Successfully"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Gateway
const deleteGateway = async (req, res) => {
  try {

    const gateway = await Gateway.where({ id: req.params.id }).fetch();

    if (!gateway) {
      return res.json({
        success: false,
        message: "Gateway not found"
      });
    }

    await gateway.destroy();

    await gatewayService.refreshFreeSWITCH();

    return res.json({
      success: true,
      message: "Gateway Deleted Successfully"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


const getUser = async (req, res) => {
  try {
    console.log('fetch');
    const getUser = await Gateway.fetchAll()
    return res.status(200).json({
      message: "Users fetched successfully",
      success: true,
      users: getUser
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ message: "Server Error", success: false });
  }
}



module.exports = {
  createGateway, listGateway,
  editGateway, updateGateway, deleteGateway,
  getUser, monitorGateways, GatewayStatus
}
